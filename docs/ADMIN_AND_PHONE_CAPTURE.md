# Administration and phone capture review

## Folder selection

Selecting a folder selects only its ID. It does not select descendants. Existing saved folder assignments remain unchanged until an administrator saves a user form. Ancestors remain visible as context in the directory tree; context-only ancestors cannot be opened by a restricted user through that tree. This UI behavior does not close the existing backend access-control gaps documented in PROJECT_REVIEW_2026-10-07.md.

The directory groups children once, renders expanded branches, and includes a folder-name filter. User forms group children once and initially expand only root folders. The form uses two columns on wide screens, one on smaller screens, and keeps its actions outside the scrolling body.

## Roles

The five built-in roles originate in V1__init_schema.sql. V5 stores their existing defaults and adds custom role templates. Built-in roles are protected. Creating or editing a custom template does not overwrite existing user permission records. Selecting a role in the user form applies its defaults, which remain individually editable. Role catalog mutations authenticate the current database user and require permission-management access.

## Phone capture

Desktop: select a destination folder, open Mobile Scan QR, enter the application's address reachable by the phone, and generate a QR. Phone: open the link, capture or choose photos, review order, rotate/trim/remove pages, and upload. The backend assembles one PDF and submits it to the existing repository and OCR pipeline. The original simulation remains available through Open existing demo.

The upload-only link lasts 15 minutes and completes once. Retrying a completed upload returns its existing document ID. Only a token hash is stored. The upload rechecks the owner's current status, upload permission, exact folder assignment, and folder existence. Limits: 30 pages, 10 MB per input image, 100 MB total input, 20 million pixels per image. The phone preserves images up to 3200 pixels on the longest side, without upscaling, and encodes JPEG at quality 0.92. JPEG/PNG are accepted by the server. There is no automatic perspective correction or persistent offline draft; refresh discards unuploaded pages.

Recommendation: upload reviewed images and assemble the PDF on the backend. This centralizes validation and avoids building a large PDF in phone memory. A browser-native camera/photo picker keeps the flow lightweight. A dedicated scanning library can add edge detection later after real-device quality measurements.

## Deployment

Localhost QR addresses work only on this computer. Set NEXT_PUBLIC_EDRMS_PUBLIC_URL to the actual reachable HTTPS application origin before building, or enter it in the dialog. This does not publish the application.

A subdomain such as edrms.arkaadigital.com works with the current root-path routing. Hosting at arkaadigital.com/edrms additionally requires coordinated Next.js base-path, API proxy, static asset/worker, and redirect configuration. Merely entering /edrms in the QR address is insufficient. Public deployment must also address the existing authorization findings in the project review. Real phone, HTTPS/network, NAS outage, and production load acceptance remain outstanding.

## Verification

17 backend tests pass, including two-image PDF assembly, completed-upload idempotency, expiry, exact-folder denial, custom-role validation, built-in-role protection, NAS failure behavior, and OCR beyond 25 pages. Browser review confirmed role catalog loading, parent selection leaving its child unchecked, QR generation, and a 390-pixel user form with no horizontal document overflow and visible Save/Cancel actions. These checks do not establish that every existing feature is regression-free or certify production throughput.

The production build passed. The PDF viewer and mobile scanner now load when opened; the measured repository first-load JavaScript decreased from 309 kB to 291 kB across this change. A synthetic image uploaded through the QR capture page became Phone_scan_2026-10-07.pdf (document ID 4ed49622-bb04-4e4e-b4f6-4443696f5cac), and OCR search found “EDRMS scanner verification page”. This test PDF remains in Med Docs for review. No existing document or user permission was modified in that verification.

## Guided mobile review update

Camera captures now open a confirmation preview. Use this page confirms it; Use & next photo confirms it and invokes the native camera picker again in the same tap. Retake and rotation are available before confirmation. Gallery selection still supports multiple photos. Confirmed pages use a thumbnail strip and a single large editable preview, retaining rotation, border trim, ordering, and removal. Upload is disabled until the pending camera photo is confirmed.

Image preparation runs sequentially and yields between photos so progress can paint. Upload reports percentage progress followed by a saving message. A two-minute network timeout and retryable errors retain the pages; completed-token idempotency prevents duplicate documents after a lost response. Navigating away with unsaved pages triggers the browser's normal warning. Images remain in memory, not persistent offline storage. Camera behavior is provided by the phone's native file/camera picker and must still be validated on physical Android/iOS devices.

The production build passed after this update. Browser verification at 390 × 844 checked capture preview, confirmation followed by next capture, a two-page thumbnail review with only one large preview, no horizontal overflow, and the saving progress message.

## Full-screen capture and mandatory quality gate

The phone route now fills the available viewport with a compact Arkaa Digital / EDRMS header, safe-area padding, camera/gallery source sheet, and a large document preview. Landscape places the preview beside the controls. The photo payload size appears per page and in the upload action; progress shows transferred MB and percentage. Completion reports the generated PDF size when returned by the server. This uses the phone's native camera picker, not a custom live camera stream.

Every prepared photo is checked on the backend before it can be confirmed or uploaded. The final upload also requires all checks to pass, independently of browser state. Rejected pages show corrective instructions and can be retaken, removed, or checked again. Corrupt, unsupported, oversized, undersized, dark, faint/blank, blurred, unreadable, and low OCR-confidence images cannot pass. Temporary OCR/network failure blocks eligibility and keeps the local pages for retry.

Current thresholds: reject thumbnail-sized images below 300 pixels on the shorter side or 400 on the longer; larger images are assessed by actual OCR readability rather than a full-page dimension cutoff; sampled grayscale mean at least 45; contrast at least 12; Laplacian sharpness variance at least 15; at least 8 recognized letters/digits; character-weighted Tesseract word confidence at least 60, with at least 60% of characters belonging to words scoring 50 or more. The new capture gate uses actual TSV confidence, not the legacy pipeline's fixed confidence metadata. See [Tesseract TSV documentation](https://tesseract-ocr.github.io/tessdoc/Command-Line-Usage.html#tsv-output).

Checks run sequentially on the phone; the server permits at most two simultaneous OCR checks. A bounded cache of up to 512 token/image-hash results lasts five minutes, avoiding repeat OCR for unchanged pages immediately uploaded. No images or recognized text are retained in this cache. Link check, quality request, native OCR process, and upload each have bounded timeouts. These are initial guardrails, not proof of complete or error-free recognition. Page-edge completeness, perspective, handwriting, mixed scripts, glare, small text, and physical camera behavior still require representative phone/document acceptance tests. The configured language must have matching installed Tesseract data.

27 backend tests pass. Browser verification rejected a generated blank photo, disabled confirmation, displayed the retake guidance, accepted a readable replacement using real OCR, and saved its PDF with size feedback. Portrait checks at 390 × 844 and 320 × 568 confirmed full viewport use and no horizontal overflow. No existing document was altered; generated test PDFs remain in Med Docs. Design reference: [Apple's iPhone website](https://www.apple.com/iphone/).

Final landscape verification at 844 × 390 measured a 272-pixel-high preview, all edit controls visible, footer bottom exactly at 390 pixels, and document width exactly 844 pixels. The production build passed and both local services were restarted with the final changes.

## Scanner responsiveness and controls refinement

The scanner now uses a consistent icon toolbar, clearer quality status, a compact brand header, and a fixed upload action. Existing camera/gallery, confirmation, rotate, trim, reorder, remove, and PDF upload workflows remain available.

Image decoding, resizing, rotation, and JPEG encoding run in a disposable worker on supported browsers. Jobs run one at a time with a 30-second preparation deadline and worker termination on completion, failure, or cancellation. Browsers/formats without worker support retain bounded native image/canvas fallback. Preview URLs and request controllers are released when leaving the page. Gallery pages appear incrementally, and a later unreadable image keeps already added pages. Stop cancels active client preparation/check/request work; it cannot roll back a server save that has already completed, and completed-token retries remain idempotent.

The production build passed. Browser checks confirmed a valid synthetic page surviving a subsequent corrupt image, Stop returning controls while preserving that page, and camera-selected confirmation followed by two-page review. Viewports 390 x 844, 320 x 568, and 844 x 390 had matching document/viewport widths and heights with the upload footer visible. Browser console contained no warnings/errors during the photo recovery check. These are functional checks, not a load benchmark or a guarantee against all device-specific stalls. Physical Android/iOS cameras, lower-memory phones, real scan quality, and poor-network testing remain necessary before production acceptance.

Readability correction: the old 700/1000 dimension gate rejected an otherwise readable 803 x 916 capture before running OCR. The corrected gate permits it to undergo actual text-confidence checks. Browser recheck of the existing user capture returned Ready to upload without retaking or replacing it. All 29 backend tests passed, including smaller readable and low-confidence screenshot cases.
