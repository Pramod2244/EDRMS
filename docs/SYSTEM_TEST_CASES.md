# EDRMS system acceptance and stress test cases

Created: 2026-10-07. Branch: `codex/system-validation`. Baseline: merged `main`, `538a469`.

This is the acceptance checklist, not a claim that every scenario passed. Execution evidence and open issues are in `SYSTEM_TEST_RESULTS.md`. Unit tests, API checks, browser workflows, real-device checks, and infrastructure/load tests prove different things. A successful build does not establish end-to-end correctness or production capacity.

## Test setup and data

Use a dedicated test database, storage root and search index for write/load scenarios. Never bulk-upload into the live repository or purge existing user documents. Prefix synthetic accounts, folders and files with `QA-`; use only invented document content. Retain failed-run evidence without retaining passwords, bearer tokens or real document contents. Restore settings after configuration tests.

Accounts: root administrator, second system administrator, manager, contributor, viewer, auditor, custom role, exact-folder restricted user, expired temporary user and disabled user. Create parent `QA-Admission`, child `QA-Admission/Child`, and unrelated `QA-Finance`. Assign restricted users only the parent, unless the test explicitly selects the child.

Fixture pack: searchable digital PDF; image-only scanned PDF; mixed PDF with image and text pages; 26-page scanned PDF; sharp PNG/JPEG with unique searchable phrase `QA ORCHID 7401`; blank image; blurry/dark image; readable 803×916 image; tiny thumbnail; corrupt PNG/PDF; encrypted PDF; office documents; empty file; unsupported executable; MIME-spoofed file; limit-minus-one, exact-limit and limit-plus-one files. Phone fixtures: one page and 30 pages, camera JPEG, gallery PNG, orientation metadata, duplicates, and large photos. These fixtures must be synthetic and reproducible.

Each test records environment/build, account, preconditions, steps, expected outcome, actual outcome, duration, evidence and issue ID. Status is PASS, FAIL, BLOCKED or NOT RUN. Run failed cases again after fixes and re-run their affected regression group.

## Login and session

| ID | Priority | Steps | Expected outcome |
|---|---|---|---|
| AUTH-01 | P0 | Sign in with valid active account; refresh; open allowed menu. | Correct identity, permissions and allowed folders; session survives refresh. |
| AUTH-02 | P0 | Sign in with incorrect password and unknown username. | Both rejected with safe, useful credential error; no token or session created. |
| AUTH-03 | P1 | Submit missing/blank credentials and username with surrounding spaces. | Missing fields rejected; valid username trimmed consistently. |
| AUTH-04 | P0 | Open protected API and page without login. | No repository, user-list or administration data returned. |
| AUTH-05 | P0 | Use expired, malformed and tampered tokens. | Access rejected; user can sign in again; no silent anonymous fallback to protected data. |
| AUTH-06 | P0 | Disable an account; attempt login and reuse its existing token. | Disabled account blocked with clear explanation. |
| AUTH-07 | P1 | First login of 2-minute temporary user; sign in again; wait for expiry. | Deadline starts once, never extends on repeat login; access stops on expiry. |
| AUTH-08 | P1 | Logout; back navigation; refresh protected page; reuse old token. | Browser session cleared; token revocation policy documented and enforced. |
| AUTH-09 | P0 | Inspect stored credentials using test fixtures only. | Passwords use a password hash; no plaintext storage, default production password or exposed signing secret. |
| AUTH-10 | P1 | Concurrent login attempts and rapid repeated failures. | Bounded work, rate-limit policy, no cross-user session contamination. |

## System administration, role and user creation

| ID | Priority | Steps | Expected outcome |
|---|---|---|---|
| ADM-01 | P0 | Root creates a second system administrator; sign in as it. | Account persists; authorized admin controls work; original root preserved. |
| ADM-02 | P0 | Viewer/contributor/anonymous client calls create/update/delete-user APIs directly. | Server rejects administrative operations; hiding a menu alone is insufficient. |
| ADM-03 | P0 | Attempt root deletion, role downgrade and removal of admin access. | Protected root remains usable; explicit error for prohibited actions. |
| ROLE-01 | P1 | Create custom role with selected permissions and menus; reload. | Saved role appears once with exact selections. |
| ROLE-02 | P1 | Create duplicate role; empty/invalid name; unknown permission/menu. | Invalid input rejected with specific field reason, no partial role. |
| ROLE-03 | P0 | Edit/delete built-in role and custom role as unprivileged user. | Built-ins protected and unauthorized modifications denied server-side. |
| ROLE-04 | P1 | Edit role template after creating a user from it. | Existing user's explicit permissions preserved; template semantics explained. |
| ROLE-05 | P0 | Assign custom role to user; sign in; directly call disallowed API. | Role/menu defaults correct; disallowed action rejected by server. |
| USER-01 | P1 | Create permanent user with menus, permissions and exact folder selection. | Saved details match form after reload and login. |
| USER-02 | P1 | Create duplicate username with case/whitespace variants. | Conflict shown; no duplicate account. |
| USER-03 | P1 | Submit blank password/name, malformed email and oversized fields. | Defined validation; no database exception or unexplained success. |
| USER-04 | P0 | Clear all permissions/menus on existing user; sign in again. | Explicit empty selection does not unexpectedly restore default access. |
| USER-05 | P0 | Assign parent only; browse/search/upload/download child and unrelated folder. | Parent access does not implicitly grant child access. |
| USER-06 | P1 | Edit user, change password, remove user, then attempt existing-session actions. | Update/deletion policy enforced consistently; no stale unrestricted access. |
| USER-07 | P1 | Simultaneously edit same user from two clients. | Defined conflict handling; no silent loss of one administrator's changes. |

## Folder structure and document naming

The latest required naming behavior is that the configured identifier becomes the visible document name, with the original filename retained internally. A separate ID badge alongside the original name does not satisfy this requirement. Examples: `ADMISSION-2025-1001.pdf`, then `ADMISSION-2025-1002.pdf`. Confirm that year comes from a defined configuration policy rather than accidentally using the machine's current year. Display, search, preview, download name and Recycle Bin must agree. Internal storage keys need not be renamed.

| ID | Priority | Steps | Expected outcome |
|---|---|---|---|
| FOLD-01 | P1 | Expand/collapse parent and nested children; filter tree; clear filter. | Correct hierarchy; matching ancestors visible; expansion stable. |
| FOLD-02 | P1 | Create root/child, duplicate name, invalid parent and deleted parent. | Valid folder saved once; failures clear; form keeps input. |
| FOLD-03 | P1 | Load deep hierarchy and 10,000 folders; resize to phone/tablet/desktop. | Bounded rendering/loading; no clipping, lost selection or unusable controls. |
| NUM-01 | P0 | Configure prefix ADMISSION, required year 2025, start 1001; upload two files. | Visible names ADMISSION-2025-1001/1002 with correct extensions; originals retained internally. |
| NUM-02 | P0 | Upload documents through desktop, phone and bulk/scanner ingestion to same folder. | All paths allocate from one atomic sequence; naming behavior identical. |
| NUM-03 | P0 | Allocate/upload concurrently into same folder with 12 and 50 clients. | No repeated reference/name, overwritten file or sequence regression. |
| NUM-04 | P0 | Set next number backwards or save a stale configuration revision. | Rejected; existing references remain immutable. |
| NUM-05 | P0 | Reserve same prefix in two folders, including historically used prefix. | Collision prevented or namespace policy demonstrably unique. |
| NUM-06 | P1 | Test NONE/YEAR/YEAR_MONTH/YEAR_MONTH_DAY, padding 1 and 10, separators and prefix bounds. | Preview and saved format match; invalid values rejected. |
| NUM-07 | P1 | Cross date/year boundary with fixed test clock. | No duplicate/reset; configured year policy honored. |
| NUM-08 | P0 | Upload fails midway; retry/double-click; delete/restore previous document. | No ID reused; retry cannot overwrite another document; restore retains name/ID. Gaps may be allowed. |
| NUM-09 | P1 | Upload original names with Unicode, spaces, multiple dots and extension case. | Format safe and consistent; original recoverable internally; extension valid. |
| NUM-10 | P1 | Change folder naming format with existing documents. | Prior IDs stable; any renaming/backfill policy explicit and tested. |

## Upload, processing and search

| ID | Priority | Steps | Expected outcome |
|---|---|---|---|
| UP-01 | P0 | Upload digital PDF; wait for processing; search exact synthetic phrase. | File stored, text indexed, correct matching pages open in preview. |
| UP-02 | P0 | Upload sharp PNG and JPEG; search their OCR phrase. | OCR result searchable; matching document/preview correct. |
| UP-03 | P0 | Upload image-only scanned PDF. | Each eligible page OCR processed; document searchable, no false success with zero usable OCR. |
| UP-04 | P1 | Upload mixed text/image PDF and 26+ page scanned PDF. | Text and scanned pages searchable; no silent 25-page truncation. |
| UP-05 | P1 | Upload supported DOCX/XLSX/PPTX and TXT. | Supported type processing/preview works; unsupported behavior explicitly explained. |
| UP-06 | P0 | Upload corrupt, empty, encrypted and extension/MIME-spoofed files. | Specific rejection or supported unlock flow; no false success or stranded partial row/file. |
| UP-07 | P1 | Upload around configured file/batch/page limits. | Exact boundaries enforced server-side; message states limit and remedy. |
| UP-08 | P0 | Viewer/restricted user uploads into forbidden folder using direct API. | Server rejects; no storage write or sequence leak granting access. |
| UP-09 | P1 | Cancel, double-click, disconnect and retry during transfer. | Clear outcome, no unintended duplicate; retained inputs; retry safe. |
| UP-10 | P0 | NAS unavailable, disk full, read-only directory, DB unavailable during upload. | Clear failure and cleanup/retry semantics; no local silent fallback. |
| UP-11 | P0 | OCR missing, timeout, blank OCR and OpenSearch unavailable. | No indefinite processing; visible reason/remedy; accurate processing/search-readiness status. |
| UP-12 | P0 | Refresh/restart service during processing. | Jobs recover or clearly fail; no permanent orphaned queue/running state. |
| UP-13 | P1 | Upload duplicate original filenames and identical content concurrently. | Document identities unique; deduplication/version behavior defined. |
| UP-14 | P1 | Download/preview every supported type; confirm MIME and checksum. | Correct bytes and name; no corrupt download or cross-document preview. |
| SRCH-01 | P0 | Search digital text, image OCR, scanned PDF OCR and phone PDF OCR. | Accurate accessible matches with page links. |
| SRCH-02 | P0 | Search as exact-folder user across parent/child/unrelated/deleted documents. | Unauthorized and recycled documents never exposed in results/snippets. |
| SRCH-03 | P1 | Rapidly type/clear/change filters with slow responses. | Stale results cannot replace latest query; cancel/debounce works. |
| SRCH-04 | P1 | No matches, Unicode, punctuation and long query. | Clear empty/error state; no crash or unsafe highlight HTML. |
| SRCH-05 | P1 | Search many hits; paginate/scroll; open distant PDF page. | Bounded payload/rendering and correct deep link; no hidden results. |
| SRCH-06 | P0 | Disable OpenSearch; query indexed and newly ingested content. | Fallback behavior accurate and explained; no unsupported claim of search readiness. |

## Phone scanning and PDF conversion

| ID | Priority | Steps | Expected outcome |
|---|---|---|---|
| MOB-01 | P0 | Generate QR, open on real iPhone Safari and Android Chrome over HTTPS. | Correct folder/session; usable full viewport and compact Arkaa Digital/EDRMS header. |
| MOB-02 | P1 | Choose camera vs gallery; capture, preview, confirm and capture next. | Native camera workflow, few steps, no blocked UI; accepted pages retained. |
| MOB-03 | P1 | Rotate, trim, reorder/remove pages, then assemble PDF. | PDF orientation/order/content matches preview; originals not accidentally lost. |
| MOB-04 | P0 | Use readable 803×916 image and blurry/dark/blank/tiny images. | Readable OCR-quality image accepted; bad scans rejected with actual reason and corrective action. |
| MOB-05 | P1 | Add multiple gallery images including one corrupt file. | Valid pages retained; corrupt page specifically identified; no entire-batch silent loss. |
| MOB-06 | P1 | Approve 1/30 pages; try 31 pages, >10 MB page, >100 MB total, >20 MP image. | Published limits match server; MB/page counters accurate; no browser memory exhaustion. |
| MOB-07 | P0 | Upload approved pages; inspect produced PDF and search unique phrase. | Conversion preserves OCR-eligible quality; saved ID/name correct; all pages searchable. |
| MOB-08 | P0 | Expired/unknown/reused QR; revoked upload permission; folder deleted after QR creation. | Upload denied with clear reason; no token reuse or folder bypass. |
| MOB-09 | P0 | Double-submit completed upload and retry after response loss. | Completion idempotent; one PDF/document/sequence allocation. |
| MOB-10 | P1 | Deny camera permission; offline; background/resume; stop slow upload. | Remedy shown, cancellation responsive, retry safe; loss-on-refresh policy visible. |
| MOB-11 | P1 | Validate concurrently from 10/50 phone sessions. | Quality checks bounded; overload rejected clearly; no cross-session cached response. |
| MOB-12 | P1 | Use landscape, notch/safe areas, keyboard and small phones. | Buttons visible, preview usable, no horizontal overflow or trapped scroll. |

## Recycle Bin and application configuration

| ID | Priority | Steps | Expected outcome |
|---|---|---|---|
| BIN-01 | P0 | Delete synthetic document with default settings. | Moves to bin; file retained; deadline is deletion +30 days; hidden from repository/search. |
| BIN-02 | P0 | Restore before deadline; download/search again. | Original folder, bytes, versions and identifier preserved; indexing restored. |
| BIN-03 | P0 | Delete twice; simultaneous delete/restore/purge. | Deadline not extended; no contradictory state or active-document purge. |
| BIN-04 | P0 | Restore at/after expiry or with missing file/deleted folder. | Clear rejection; no ghost restored document. |
| BIN-05 | P0 | Browse/restore bin as anonymous, viewer and unrelated-folder user. | Server denies unauthorized visibility and actions. |
| BIN-06 | P1 | Filter/paginate bin with thousands of entries. | Bounded results, correct totals/deadlines and useful empty/error state. |
| BIN-07 | P0 | Expire synthetic document then execute cleanup. | Original, versions and assets removed from recorded provider; tombstone/ID reservation retained. |
| BIN-08 | P0 | NAS failure during purge; active processing job; retry later. | Metadata retained for retry; no premature purge; backlog observable. |
| CFG-01 | P1 | Read/save default 30 days; set 1 and 3650. | Values persist; future deletions use selected retention. |
| CFG-02 | P1 | Submit 0, negative, fractional, text, empty and >3650 values. | Specific whole-number/range validation; previous valid value retained. |
| CFG-03 | P0 | Change retention with documents already recycled. | Existing deadlines unchanged unless explicit migration policy is introduced. |
| CFG-04 | P0 | Non-admin directly changes settings; submit unknown keys/boolean wrong type. | Server rejects unauthorized/undefined/type-invalid values. |

## Infrastructure, clarity and audit

| ID | Priority | Steps | Expected outcome |
|---|---|---|---|
| SYS-01 | P0 | Start frontend/backend/DB with correct and missing configuration. | Startup readiness accurate; actionable error for dependency failure. |
| SYS-02 | P0 | Exercise NAS SMB/NFS mounted share on Windows/Linux; restart/reconnect. | Real provider connectivity, permissions and recovery verified; no local fallback. |
| SYS-03 | P0 | Run every permission boundary through API, not only menus. | Upload/view/download/share/delete/admin/search enforced independently. |
| SYS-04 | P1 | Inspect audit for successful/failed login, administration, upload/delete/restore/config changes. | Correct actor/time/outcome; no secrets logged; gaps identified. |
| SYS-05 | P1 | Network timeouts, overloaded quality checks, disk capacity shortage and stale writes. | Definite success or failure with reason and remedy; no endless spinner. |
| SYS-06 | P1 | Keyboard navigation, screen-reader labels, phone/tablet/desktop zoom. | Inputs/errors/actions accessible and layout usable. |
| SYS-07 | P0 | Backup/restore DB+storage together; restart workers and indexes. | No references to missing files or reused sequence values; recovery procedure verified. |

## Bulk, concurrency and stress execution

These are proposed acceptance targets, not measured promises. Record hardware, network, DB/storage/search topology and versions with every result. Validate on a representative NAS before setting production capacity. An OCR acceptance request is distinct from final OCR/search-ready completion; the UI may show transient progress but must settle to a clear outcome and never report unprocessed documents as ready.

| ID | Workload and fault | Measurements and pass criteria |
|---|---|---|
| LOAD-01 | 200 sequence allocations through 12 concurrent DB workers in an isolated schema. | All unique, expected next number, no backward edit/prefix reuse; bounded completion. Implemented automated test. |
| LOAD-02 | 10, 25, 50 concurrent upload users; mixed 1/5/20 MB fixtures; 10-minute stages. | Accepted/rejected/completed counts reconcile; zero lost/corrupt/duplicate documents; record transfer and processing p50/p95/p99 separately. |
| LOAD-03 | Bulk 100/1,000/10,000 documents; mixed PDF/image/office files. | Bounded queue, storage and DB pool; no OOM; explicit per-file final result and retryable reason. |
| LOAD-04 | 10/50/100 concurrent search clients against 10k/100k/1m documents. | Authorized/correct hits; initial target p95 <2 s for indexed search and <1% unexpected errors; capacity knee documented. |
| LOAD-05 | 10/50 concurrent phone validation sessions with large images; slow Tesseract. | Semaphore/capacity bounded; predictable overload response; no unbounded temp files/memory. |
| LOAD-06 | Concurrent uploads plus deletes/restores, config edits and search. | No active-file purge, duplicate numbering, stale deletion reversal or inaccessible orphan. |
| LOAD-07 | 2-hour steady soak, then 24-hour pre-release soak. | No growing heap/temp-files/connections/queue; error rate and recovery monitored. |
| LOAD-08 | Burst to 2× observed capacity for 60 seconds, then normal load. | Controlled rejection/backpressure; no process crash; drains/recover within an agreed bound. |
| LOAD-09 | Restart backend mid-upload/processing and disconnect NAS/DB/search. | No false success or data loss; retry/idempotency reconciled; backlog recovery measured. |
| LOAD-10 | Mobile UI with 30 high-resolution pages and simultaneous PDF preview/search. | No crash; record long tasks/frame responsiveness and peak memory on low/mid-range real phones. |
| LOAD-11 | 10k expired documents and intermittent NAS errors during cleanup. | Fair retries and bounded batches; no starvation; backlog/drain-time/capacity known. |
| LOAD-12 | Read-only API smoke: 100 requests through 10 workers to local endpoints. | Status distribution and latency recorded; unauthorized success is a failure, not a performance pass. |

For load testing, record CPU/heap/GC, event-loop long tasks, DB locks/pool utilization, processing queue age, OCR timeouts, storage I/O, search errors and cleanup backlog. Use checksums and independent DB/storage reconciliation after every mutation test. Define idempotency/retry semantics before destructive chaos tests. Capture structured failure codes plus human-readable reason and next step.

## Release gate

All P0 cases must pass with evidence; known P0 defects block release. Builds/unit tests passing alone are insufficient. Real phone, real NAS, permission boundary, filename behavior, bulk recovery and representative load tests remain mandatory. Publish a signed-off test report with actual capacity limits and remaining risks; do not claim unlimited concurrency or zero possible failures.
