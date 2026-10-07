# NAS setup

The backend accesses NAS through the operating system filesystem. Device details can be supplied later; supported deployment patterns are a Windows UNC share (for example `\\nas-server\documents`) and a Linux SMB/NFS mount (for example `/mnt/edrms`). The backend service account must have read, write, create, rename, and delete permissions. Containers need the host share mounted into the backend container.

Provision the share outside the application first. Set `STORAGE_NAS_ROOT_PATH` to the path visible to the backend, or enter that path in storage administration. Test the connection, then select NAS. The adapter does not create a missing share, and does not fall back to local disk. Atomic rename support is required; test this with the actual device before use.

The connection probe verifies directory access and a small write/read/delete cycle. It cannot establish that a Linux directory belongs to the intended remote device. The deployment must verify mount identity and prevent writes to an empty local mountpoint during a disconnect. Mount identity/sentinel enforcement and continuous storage health are still outstanding.

Selecting NAS changes where new documents are written. It does not migrate existing documents. Keep old provider roots available; changing a provider root without moving the matching files will make old keys inaccessible. Document edits and thumbnails now follow the document's recorded provider.

Before production acceptance, test representative large uploads, atomic rename, service-account access after reboot, disconnect during upload, reconnect, database/file backup restoration, and concurrent uploads. No physical NAS device has been tested in this development session.

Current development run uses local PostgreSQL and the existing local file repository. OpenSearch and Redis are not running. The backend's database search fallback is available. The security, worker recovery, mixed-page OCR, and immutable-version findings in PROJECT_REVIEW_2026-10-07.md remain outstanding.
