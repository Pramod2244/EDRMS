# EDRMS validation report and issue register

Date: 2026-10-07 (Asia/Kolkata). Branch: `codex/system-validation`.
Baseline: `origin/main` commit `538a469`, containing PR #2. Production behavior was not changed in this testing branch.

## Release decision

**NOT READY for production sign-off.** Successful automated tests and a fast local smoke test do not override confirmed anonymous data access, naming requirements that are not implemented, or outstanding dependency/security checks. Issues below are recorded for the next fixing pass as requested.

## Executed checks

| Check | Scope | Outcome |
|---|---|---|
| Existing backend regression suite | OCR, file validation, phone token/quality checks, roles, settings, NAS-path failure, recycle/restore/purge | Passed in initial run; optional numbering test enabled in subsequent run. |
| New authentication workflow tests | 12 controller tests: valid/invalid/missing credentials, temporary deadlines, custom-role defaults, selected permissions/folder claims, duplicate/blank user creation, root protection, invalid current-user token | PASS. Mocked user repository/audit/catalog; real local JWT generation/validation. Does not establish HTTP authorization or disabled-account enforcement. |
| Number format tests | 6 tests: four date modes, padding, digit growth, unsafe prefixes, invalid mode/padding/range, date boundary | PASS. Does not make reference IDs into visible filenames. |
| PostgreSQL numbering concurrency | 200 atomic allocations, 12 workers, one folder; stale/backward edits, historical prefix ownership, date format, DB unique constraint | PASS. Isolated schema created and dropped; next number 1201 after allocations 1001–1200; no duplicate ID. Full test took 5.45 seconds in first run, including other assertions. This is sequence contention testing, not 200 concurrent file uploads. |
| Bulk ingestion integration | 25 synthetic one-page digital PDFs, 8 submitting workers, real migrations/DB/files/PDF pipeline; document count, references, next number, per-document SHA-256, extracted text and final processing state | PASS after correcting test-context cleanup in the harness. SearchService and AuditService are mocked; no real OpenSearch, NAS or browser transfer measured. Temp storage and isolated schema removed. |
| Frontend production build | Compilation, type/lint checks and route generation from main-derived branch | PASS. No browser responsiveness or real-device capacity claim. |
| Concurrent API smoke | 100 unauthenticated GETs, 10 workers, seven endpoints, local backend | FAIL acceptance: 58 unexpected outcomes; zero network failures. Full run 0.832 seconds; per-route p95 289.64–478.11 ms. Fast unauthorized success is still a security failure. Evidence: `API_SMOKE_RESULTS_2026-10-07.json`. |

Final full backend run: **66 tests passed, 0 failures/errors, 0 skipped**, with both PostgreSQL integration tests enabled. Machine-readable per-test evidence is in `AUTOMATED_TEST_RESULTS_2026-10-07.json`. The deliberate missing-Tesseract-language error logged by an OCR negative test is expected and the test passed.

### API smoke detail

| Endpoint | Actual responses | Expected without login | Decision |
|---|---|---|---|
| `/api/v1/auth/users` | 15 × 200 | 401/403 | FAIL: anonymous account metadata access. Response bodies were not logged. |
| `/api/v1/documents` | 15 × 200 | 401/403 | FAIL: anonymous repository listing. |
| `/api/v1/folders` | 14 × 200 | 401/403 | FAIL: anonymous folder listing. |
| `/api/v1/recycle-bin` | 14 × 403 | 401/403 | PASS for anonymous rejection only. |
| `/api/v1/roles` | 14 × 403 | 401/403 | PASS for anonymous rejection only. |
| `/api/v1/admin/config/application` | 14 × 403 | 401/403 | PASS for anonymous rejection only. |
| `/actuator/health` | 14 × 503 | 200 when healthy | FAIL readiness; the application is responding but dependencies/readiness need diagnosis. |

## Open issues

Severity: P0 = blocks safe production use; P1 = required functional/reliability correction; P2 = improvement. Source-review findings require a targeted reproduction and regression test during fixing; observed failures already have runtime evidence.

| Issue | Severity / evidence | Finding and required correction | Acceptance cases |
|---|---|---|---|
| QA-001 | P0 / observed | Anonymous users receive user, document and folder listings. SecurityConfig permits all `/api/**`; several controllers do not enforce permissions. Require authentication and server-side per-action/exact-folder checks; preserve intentionally public login/share/limited QR endpoints. Audit authorization failures. | AUTH-04/05, ADM-02, USER-05, UP-08, SRCH-02, SYS-03 |
| QA-002 | P1 / source and current UI implementation | Generated identifier is a badge; `DocumentService` still sets `name` to sanitized original filename. User requires generated name as primary visible name and original retained internally. Introduce explicit original/display-name semantics and apply consistently to listing, search, previews, downloads and bin; retain immutable storage identity. | NUM-01/02/08/09 |
| QA-003 | P1 / source | YEAR uses current Asia/Kolkata date. There is no configured admission/intake year, so an admission-year 2025 cannot be selected while system date is 2026. Prefix forbids hyphens, so embedding a custom year in the prefix is not an adequate substitute. Define a configured year option separate from current-date tokens; preview must match saved name. | NUM-01/06/07 |
| QA-004 | P1 / source | `SearchService.indexDocument` catches indexing failures without returning failure; worker completes INDEX_SEARCH and marks READY/COMPLETED regardless. DB fallback may still search, but reported indexing stage can be false. Return/record explicit indexing outcome, retry durably and show truthful readiness/degraded-state messages. | UP-11, SRCH-06, SYS-05 |
| QA-005 | P1 / observed | Health endpoint repeatedly returns 503. Determine failing health component(s), restore required dependencies or define optional dependency/readiness policy. Do not label the whole application healthy merely because pages load. | SYS-01, LOAD-09 |
| QA-006 | P1 / source review; capacity not proved | All-document listing materializes `findAll()`; pipeline uses asynchronous events with no application-specific durable restart dispatcher/backpressure configuration found. Large-repository pagination, bounded worker capacity, queue visibility and crash recovery need proof and correction before bulk certification. | UP-12, FOLD-03, SRCH-05, LOAD-02/03/07/08/09 |
| QA-007 | P0 / source | Password field named `passwordHash` is compared/stored as plaintext, and default credential/signing-secret fallbacks exist. Use adaptive password hashing, provision production credentials/secrets externally and migrate accounts safely. Never include actual secret values in test reports. | AUTH-09, SYS-04 |
| QA-008 | P0 / source | Login checks temporary expiry but does not check account ACTIVE/disabled status. Verify disabled users and token behavior; enforce revocation/status policy. | AUTH-06, USER-06 |
| QA-009 | P1 / source | Explicit empty permission/menu lists fall back to role defaults, and updates ignore some empty selections. A revoked permission set may reappear at login. Distinguish absent/default from explicitly empty values; enforce latest policy server-side. | USER-04/06, ROLE-05 |
| QA-010 | P0 / dependency warning and official advisory | Next.js 14.2.7 is in the affected 14.x line of the App Router denial-of-service advisory. Upgrade to an appropriately patched supported version and rerun compatibility tests. Do not launch an exploit against the user's running service. | SYS-01, LOAD-08 |
| QA-011 | P1 / observed source capability gap | Desktop upload and backend validation accept PDF only, although broader type names remain in configuration. Direct PNG/JPEG/office upload cannot be claimed as supported. Decide and document PDF-only policy versus image-to-PDF conversion; make allowed formats consistent across UI/server/configuration. Phone image-to-PDF is a separate path. | UP-02/05/06, MOB-07 |
| QA-012 | P1 / source | Generic exception handler returns raw internal exception messages; frontend has generic failure banners in some paths. Define safe reason codes and corrective user guidance for upload, capacity, storage, processing and stale-update failures. Never turn a failed transfer/process into success. | UP-06/09/10/11, SYS-05 |

QA-010 source: [Next.js security advisory, December 11, 2025](https://nextjs.org/blog/security-update-2025-12-11). The advisory identifies App Router denial of service in the 14.x line and lists a patched 14.2 release. This report is not a complete dependency vulnerability audit.

## Not yet executed / limits

- Full browser workflows for admin creation, user editing, role assignment, file upload/search and delete/restore on this baseline: NOT RUN in this pass. Existing unit tests do not substitute for these.
- Real iPhone/Android QR, camera/gallery, low-memory, bad-network and PDF-search workflow: NOT RUN. Needs real devices and public HTTPS routing.
- Real NAS SMB/NFS, disk-full/read-only, reconnect and network throughput: BLOCKED by missing deployment/NAS details. Local provider tests are not real NAS tests.
- 1k/10k bulk documents, 50/100 concurrent upload/search users, 2/24-hour soak, restart recovery and dependency chaos: NOT RUN. Use dedicated staging infrastructure after the P0 boundaries are corrected. Initial 25-PDF local integration is not production load certification.
- OpenSearch ingestion/query performance: NOT RUN against a healthy search server. Real search dependency was not exercised by bulk integration.
- Audit completeness, backup/restore, explicit disabled-user/revocation cases and mixed mutation races: NOT RUN end-to-end; source gaps are logged above.

The 101-case checklist in `SYSTEM_TEST_CASES.md` remains the acceptance gate. Track actual results per case as subsequent rounds execute. No promise of unlimited throughput, zero failures or zero UI hangs is justified by this run.

## Repeatable execution

Backend baseline: `mvn -f backend/pom.xml test` (optional DB tests skip unless enabled). Frontend: `npm ci` followed by `npm run build` inside `frontend`.

For isolated PostgreSQL checks, set `EDRMS_NUMBERING_TEST_URL`, `EDRMS_NUMBERING_TEST_USER`, `EDRMS_NUMBERING_TEST_PASSWORD` and `EDRMS_BULK_TEST_URL` in the process environment, then run the backend suite. Bulk test URL must target localhost. Both tests create their own schemas; the bulk test also uses a temporary storage directory and mocks search/audit. Never put credentials in committed scripts or Markdown. An integration-context startup failure can leave an isolated test schema/temp directory; inspect and remove only explicitly named `bulk_test_*` / `edrms-bulk-test-*` artifacts.

Read-only smoke: `python scripts/api_smoke_stress.py --requests 100 --workers 10 --output docs/API_SMOKE_RESULTS_2026-10-07.json`. Nonzero exit means an unexpected status or network failure; it intentionally fails on anonymous-success and unhealthy readiness. It accepts only localhost targets and never logs response bodies or bearer tokens.
