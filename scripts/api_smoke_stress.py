"""Bounded, read-only HTTP checks. Never logs response bodies or authentication secrets."""
import argparse
import concurrent.futures
import json
import math
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone

ROUTES = {
    "/api/v1/auth/users": {401, 403},
    "/api/v1/documents": {401, 403},
    "/api/v1/folders": {401, 403},
    "/api/v1/recycle-bin": {401, 403},
    "/api/v1/roles": {401, 403},
    "/api/v1/admin/config/application": {401, 403},
    "/actuator/health": {200},
}

def check(base, route):
    started = time.perf_counter()
    try:
        request = urllib.request.Request(base + route, headers={"Accept": "application/json"})
        with urllib.request.urlopen(request, timeout=10) as response:
            status = response.status
            # Do not download/log repository contents for an unauthorized success.
    except urllib.error.HTTPError as error:
        status = error.code
        error.close()
    except (urllib.error.URLError, TimeoutError, OSError):
        status = "NETWORK_ERROR"
    return route, status, round((time.perf_counter() - started) * 1000, 2)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8081")
    parser.add_argument("--requests", type=int, default=100)
    parser.add_argument("--workers", type=int, default=10)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    if not 1 <= args.requests <= 1000 or not 1 <= args.workers <= 20:
        parser.error("Use 1–1000 requests and 1–20 workers. This is a bounded smoke test.")
    if not args.base_url.startswith(("http://127.0.0.1:", "http://localhost:")):
        parser.error("Only localhost targets are supported; use a dedicated staging load tool for remote targets.")
    routes = list(ROUTES)
    samples = defaultdict(list)
    started = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(check, args.base_url.rstrip("/"), routes[i % len(routes)]) for i in range(args.requests)]
        for future in concurrent.futures.as_completed(futures):
            route, status, elapsed = future.result()
            samples[route].append((status, elapsed))
    report = {
        "utc_time": datetime.now(timezone.utc).isoformat(),
        "base_url": args.base_url, "requests": args.requests, "workers": args.workers,
        "duration_seconds": round(time.perf_counter() - started, 3),
        "scope": "Unauthenticated read-only status smoke; not upload/OCR/NAS capacity certification",
        "routes": {},
    }
    failures = 0
    for route, items in sorted(samples.items()):
        durations = sorted(elapsed for _, elapsed in items)
        unexpected = sum(status not in ROUTES[route] for status, _ in items)
        failures += unexpected
        report["routes"][route] = {
            "count": len(items), "status_counts": dict(Counter(str(status) for status, _ in items)),
            "expected_statuses": sorted(ROUTES[route]), "unexpected_count": unexpected,
            "p50_ms": durations[math.ceil(len(durations) * .5) - 1],
            "p95_ms": durations[math.ceil(len(durations) * .95) - 1], "max_ms": durations[-1],
        }
    report["unexpected_responses"] = failures
    with open(args.output, "w", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2)
        stream.write("\n")
    print(json.dumps(report, indent=2))
    return 1 if failures else 0

if __name__ == "__main__":
    raise SystemExit(main())
