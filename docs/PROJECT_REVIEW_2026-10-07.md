# EDRMS project review — 7 October 2026

Reviewed remote branch `origin/main_changes`, commit `a455ba1` (file upload fix), in an isolated checkout. The original New_change checkout and its uncommitted files were preserved. No application code was changed.

## Assessment

The repository has useful foundations: storage interfaces, document/version/asset records, PDF processing, page text storage, search, and a processing-status UI. It is not ready for enterprise deployment in its current form. NAS integration is a filesystem adapter with unsafe fallback behavior; OCR can silently omit or fail pages; backend access control is substantially incomplete.

This is a source review across backend, frontend ingestion, deployment configuration, scanner agent, mobile capture, audit, sharing, and existing tests. It is not a live NAS connectivity test, full UI acceptance test, load test, or reproduction of the user's failing PDF. The real deployment configuration and a representative failing PDF are needed to establish the exact incident cause.

## NAS connectivity and integrity

`NasStorageProvider` uses Java filesystem operations. There is no application-level NAS login or SMB/NFS connection setup. The backend host must already have access to the share, through a UNC path on Windows or a mounted filesystem on Linux. Authentication and share permissions are therefore handled by the operating system and the backend service account.

The effective path can come from the provider constructor property `edrms.storage.nas.root-path` (default `./data/nas_storage`) or database configuration `STORAGE_NAS_ROOT_PATH`. The application defaults to LOCAL; selecting NAS alone does not prove network storage is active. The checked-in application.yml has no explicit NAS path mapping.

Critical findings:

- Reconfiguration silently substitutes local storage for an unavailable path containing `/Volumes/NAS`. Reads and existence checks also search local directories. A document labelled NAS can therefore be served from local disk.
- Creating a directory and writing a tiny probe proves filesystem access, not that the intended NAS is mounted. A missing mount can leave a writable local directory and produce a misleading success result.
- Reconfiguring a provider's root changes how all existing keys are resolved. Existing documents retain a provider name and relative key, not a stable storage-location identity. Changing roots can make historical documents inaccessible.
- Atomic rename is required with no fallback if the filesystem does not support it. Failed writes can leave temporary files; there is no explicit persistence flush or crash-recovery cleanup.
- Provider switching is not a migration. In particular, page editing and thumbnail generation write to the currently active provider, while document reads use the recorded original provider. Switching providers can cause edited bytes or thumbnails to be written elsewhere and later reads to return stale data or fail.
- Upload storage writes occur inside a database transaction without compensating cleanup. A database failure after the file write can leave an orphan file.

Recommended NAS design: use a dedicated, pre-provisioned share and backend service account; require a validated absolute location; verify mount/share identity and a sentinel; fail explicitly when unavailable; check write/read/hash/delete behavior; retain stable location metadata; expose storage health; and validate NAS outage/recovery and backup/restore. Keep the cloud provider outside the current delivery scope.

Before connecting the real device, obtain NAS manufacturer/model, address, share name, supported protocol, backend OS/deployment method, service account permissions, expected concurrent users/file sizes, and backup ownership. Prefer the existing filesystem adapter once these details are confirmed rather than assuming a proprietary NAS API is needed.

## Scanned PDF OCR

The pipeline first extracts embedded PDF text. If total text exceeds `20 * pageCount`, it treats the entire document as digital. Otherwise Tesseract renders PDF pages and performs OCR.

Confirmed defects:

1. Tesseract processes at most 25 PDF pages. The pipeline then sets the document page count to the number of returned OCR pages. A 100-page scan can be represented as 25 pages and never searched beyond page 25, although the original file remains intact.
2. Native OCR exceptions and 25-second page timeouts become empty text with zero confidence. The worker still labels those pages COMPLETED and can label the whole document READY.
3. `isAvailable()` always returns true, even with a missing binary or language data. Native OCR process errors are caught inside the image routine, so the outer Tika fallback is not a dependable response to a missing executable. Embedded-text extraction is not a replacement for OCR of image-only pages.
4. The process exit code and diagnostics are not checked/read. Failures are difficult to diagnose, and undrained process output can contribute to process blocking.
5. Mixed PDFs are classified at document level. A few text-rich digital pages can cause image-only pages to skip OCR completely.
6. PDF rasterization is fixed at 150 DPI, and larger images are reduced to 2000 pixels. This can reduce recognition of small or faint text. There is no implemented deskew, orientation correction, perspective correction, or scan-quality assessment.
7. Nonempty OCR receives a fixed confidence of 92 rather than measured recognition confidence. The configured text threshold is not wired into the hardcoded pipeline decision.
8. Resized image temporary files are not removed in the image routine's cleanup.

The screenshot-versus-scan symptom is consistent with these paths: crisp screenshots can be easy to recognize, while phone PDFs introduce rotation, skew, low contrast, or rasterization loss. That is a likely explanation, not a confirmed diagnosis for the user's file. Password-protected or malformed PDFs and deployment-specific Tesseract configuration remain additional possibilities.

Required repair: preserve actual PDF page count; decide embedded text versus OCR per page; process all pages with bounded resource use; check executable/languages and process exit; preserve diagnostics; track FAILED/PARTIAL/COMPLETED per page; offer retry; make resolution/timeouts configurable; and measure recognition quality on representative phone scans. A blank page must remain distinguishable from an OCR failure.

## Upload speed and smoothness

The branch name/commit message does not establish a measured speed improvement. Against latest origin/New_change, the reviewed branch adds synchronous PDF page counting and changes OCR availability to always report available. The existing asynchronous architecture helps separate processing from the upload response, but several costs remain:

- Upload validation hashes the full file; storage hashes it again; the worker copies it from storage and hashes it again. Malware scanning occurs both before storage and in processing. PDF loading also occurs repeatedly across stages.
- Upload still waits for validation, the full storage write, PDF page counting, and database persistence. There is no resumable/chunked upload or idempotent upload key.
- Pipeline work runs inside one REQUIRES_NEW transaction. Ordinary polling connections do not see its saved intermediate progress until commit, and long OCR work retains database resources. A database error can also invalidate the transaction that is supposed to save failure status.
- Dispatch uses an in-process AFTER_COMMIT asynchronous event. Jobs are persisted, but no scheduled claiming/recovery/retry worker was found. A crash can leave a job pending indefinitely.
- The browser polls every 350 ms, using async intervals without backoff, a deadline, or in-flight protection. This creates unnecessary load and can overlap requests; errors can leave polling running indefinitely.
- On-demand thumbnails load the PDF again for each uncached page. Large scanned PDFs can make this expensive, especially over NAS.
- The all-documents endpoint loads all records and filters in memory. Search fallback is unbounded; OpenSearch indexes pages individually; search hydrates database records per hit. Search query pagination is incomplete.

Recommended approach: distinguish transfer progress from processing progress; stream and hash during durable ingest; use a persistent worker with job claiming and retries; commit short stage/page updates; limit concurrent render/OCR work; cache thumbnails; paginate repository/search results; bulk-index search; and measure transfer-to-stored and stored-to-searchable times separately on the actual NAS.

## Release-blocking security

- SecurityConfig permits `/api/v1/**`, `/api/**`, and `/actuator/**` without authentication. Document read, upload, delete, search, and storage administration do not enforce appropriate backend authorization. PermissionEvaluator returns true for both document and folder checks.
- Account creation stores supplied passwords directly in passwordHash, and login compares strings directly. A built-in JWT signing-secret fallback and default administrator password also exist.
- Upload ownership/audit actors can come from client parameters/headers. Identity must be derived from a verified principal, not client labels.
- Search has no enforced tenant or ACL filter, including its database fallback.
- Legacy temporary-share tokens can be derived from a document ID without an existing grant; that path bypasses expiry, password, and download restrictions.
- Share passcodes are placed in URLs. The final allowed view is consumed at unlock, after which preview can be rejected as exhausted. Concurrent view limits lack an atomic consume operation.
- Credentialed CORS accepts any origin. The default malware scanner only inspects 2048 bytes for a few signatures; it is a development helper, not a production antivirus check.

These are implementation findings, not hypothetical deployment concerns. Backend enforcement must precede enterprise rollout, regardless of UI restrictions.

## Other functional/integrity gaps

- PDF page deletion overwrites original/version storage instead of creating an immutable new version; stored version/asset metadata is not consistently updated. Search is not reindexed after deletion, so page hits can point at stale text/page numbers.
- Search indexing catches errors and returns normally. The pipeline consequently records indexing success and READY even if OpenSearch indexing failed. Database fallback can provide some search coverage, but does not repair the index.
- Invalid upload folder IDs silently select another folder rather than returning a clear error. This risks unintended filing.
- The scanner agent reports a hardcoded scanner and only implements status/devices HTTP handlers. It does not implement the documented real scanning/WebSocket workflow.
- Mobile capture adds simulated filenames; perspective correction returns the original URI; the Review & Upload button has no action. Phone scanning is a scaffold.
- Both frontend and backend now restrict uploads to PDF, while README/configuration describe broader formats. The screenshot image upload behavior reported by the user may belong to another branch or route and needs comparison with the running deployment.
- AuditService inserts asynchronous records; the documented cryptographic verification chain is not implemented there. Some actions record success before storage access finishes, and actor values are client-controlled.
- Development-oriented infrastructure settings, exposed service ports, OpenSearch security disabled, and no demonstrated automated coordinated NAS/database restore need a production deployment review.
- Actual uploaded files and thumbnails are tracked in Git. Move runtime storage outside source control and review whether committed documents contain sensitive information.

## Verification performed

Ran backend `mvn test` against the isolated latest branch. Five tests ran: four passed and one errored. FileValidationServiceTest.testValidTextFileInspection expects a TXT upload to pass, but the current implementation only permits PDF. Both OCR tests passed on this machine, including the generated-image recognition test. Tesseract exists at the common Windows installation path.

Only two backend test classes were found. There is no scanned-PDF regression coverage, NAS integration/outage coverage, permission isolation coverage, or restart recovery coverage in these tests. No frontend production build, live infrastructure acceptance test, or NAS benchmark was performed. Passing the image test does not establish scanned-PDF reliability.

## Suggested implementation order

1. Close unauthenticated APIs, enforce folder/document/tenant permissions, hash passwords properly, remove insecure identity/token fallbacks.
2. Make NAS writes fail explicitly when the share is unavailable; verify the real share; fix location/provider consistency and immutable versions.
3. Repair OCR page completeness and truthful status; reproduce and test the failing scan alongside rotated, faint, mixed, encrypted, and >25-page examples.
4. Introduce persistent processing/recovery and short progress transactions, then tune upload/thumbnail/search throughput using real NAS measurements.
5. Complete actual scanner/mobile workflows if required; verify audit, sharing limits, backup/restore, and an agreed acceptance suite before release.

Acceptance must include: correct search hits on every expected scan page; no silent local fallback; safe NAS disconnect/reconnect; no unauthorized read/delete/configuration; restart recovery; accurate visible progress; stable search after page edits; and verified coordinated database/file restoration.
