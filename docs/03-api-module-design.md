# 03 - API Module Design

## 1. API Architecture Principles

1. **RESTful Conventions**: Clean URL structures, resource noun identifiers, standard HTTP status codes (`200 OK`, `201 Created`, `202 Accepted`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`, `429 Too Many Requests`).
2. **Versioning**: Explicit `/api/v1/` prefix on all endpoints.
3. **Error Handling**: Adherence to **RFC 7807 Problem Details** for HTTP APIs:
   ```json
   {
     "type": "https://edrms.corp/errors/permission-denied",
     "title": "Forbidden",
     "status": 403,
     "detail": "User lacks DOWNLOAD permission on document 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
     "instance": "/api/v1/documents/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d/download",
     "timestamp": "2026-09-03T11:50:00Z"
   }
   ```
4. **Standard Pagination Envelope**:
   ```json
   {
     "content": [...],
     "page": 0,
     "size": 20,
     "totalElements": 142,
     "totalPages": 8,
     "first": true,
     "last": false
   }
   ```
5. **Auditing & Tracing**: All API requests capture `X-Trace-ID` or generate a UUID trace token, propagated into both response headers and audit logs.

---

## 2. API Endpoints Catalog

### 2.1 Folders Module (`/api/v1/folders`)

| Method | Endpoint | Description | Auth & Permission |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/folders` | List root folders or full folder tree | `Authenticated`, `VIEW` on visible nodes |
| `POST`| `/api/v1/folders` | Create a new folder (root or child) | `UPLOAD` permission on parent folder |
| `GET` | `/api/v1/folders/{id}` | Get folder metadata, subfolders, and documents | `VIEW` on target folder |
| `PUT` | `/api/v1/folders/{id}` | Rename or move folder (updates `materialized_path`) | `MANAGE_PERMISSIONS` or `UPLOAD` |
| `DELETE` | `/api/v1/folders/{id}` | Soft-delete folder and nested contents | `DELETE` on target folder |
| `GET` | `/api/v1/folders/{id}/permissions` | View folder access control list | `MANAGE_PERMISSIONS` or `VIEW` |
| `PUT` | `/api/v1/folders/{id}/permissions` | Set/override permissions for user or role | `MANAGE_PERMISSIONS` |

#### Create Folder Request Payload:
```json
{
  "name": "Financial Audits 2026",
  "parentId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

---

### 2.2 Documents Module (`/api/v1/documents`)

| Method | Endpoint | Description | Auth & Permission |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/documents/upload` | Multipart upload for documents up to 50MB | `UPLOAD` on destination folder |
| `POST` | `/api/v1/documents/upload-session` | Initiate large/chunked upload or presigned S3 URL | `UPLOAD` on destination folder |
| `GET` | `/api/v1/documents/{id}` | Get document metadata, processing status, versions | `VIEW` |
| `GET` | `/api/v1/documents/{id}/download` | Stream original binary or return S3 presigned URL | `DOWNLOAD` |
| `GET` | `/api/v1/documents/{id}/preview` | Stream web-optimized PDF stream for in-browser viewing | `VIEW` |
| `GET` | `/api/v1/documents/{id}/pages/{page}/thumbnail` | Retrieve rendered page WebP thumbnail | `VIEW` |
| `GET` | `/api/v1/documents/{id}/print-stream` | Stream document with embedded dynamic user watermark | `PRINT` |
| `DELETE` | `/api/v1/documents/{id}` | Soft-delete document | `DELETE` |
| `GET` | `/api/v1/documents/{id}/permissions` | Get document-specific permission overrides | `MANAGE_PERMISSIONS` |
| `PUT` | `/api/v1/documents/{id}/permissions` | Set explicit document-level permissions | `MANAGE_PERMISSIONS` |
| `POST` | `/api/v1/documents/{id}/versions` | Upload a new version of an existing document | `UPLOAD` |

#### Upload Response:
```json
{
  "id": "e83b8b1a-28e4-4a2e-b6a1-0f7962450892",
  "folderId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "name": "Vendor_Contract_Q3.pdf",
  "mimeType": "application/pdf",
  "extension": "pdf",
  "fileSizeBytes": 4581290,
  "currentVersion": 1,
  "status": "PROCESSING",
  "storageProvider": "LOCAL",
  "pageCount": null,
  "createdAt": "2026-09-03T11:50:00Z"
}
```

---

### 2.3 Search Module (`/api/v1/search`)

| Method | Endpoint | Description | Auth & Permission |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/search` | Full-text query with facet filtering and page hits | `Authenticated` (Results scoped by ACL) |
| `GET` | `/api/v1/search/suggestions` | Fast autocomplete suggestions for document names/tags | `Authenticated` |

#### Search Request Payload:
```json
{
  "query": "indemnification limitation of liability",
  "folderId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "includeSubfolders": true,
  "extensions": ["pdf", "docx"],
  "dateFrom": "2026-01-01T00:00:00Z",
  "dateTo": "2026-09-03T23:59:59Z",
  "page": 0,
  "size": 10
}
```

#### Search Response (Direct Page Navigation Payload):
```json
{
  "totalHits": 3,
  "hits": [
    {
      "documentId": "e83b8b1a-28e4-4a2e-b6a1-0f7962450892",
      "documentName": "Vendor_Contract_Q3.pdf",
      "folderId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "folderPath": "/Legal/Contracts",
      "fileSizeBytes": 4581290,
      "pageHits": [
        {
          "pageNumber": 7,
          "highlightSnippet": "...in no event shall the <em>limitation of liability</em> exceed...",
          "score": 8.42
        },
        {
          "pageNumber": 12,
          "highlightSnippet": "...mutual <em>indemnification</em> obligations under Section 14...",
          "score": 6.19
        }
      ]
    }
  ]
}
```

---

### 2.4 Temporary Access Module (`/api/v1/temporary-access`)

| Method | Endpoint | Description | Auth & Permission |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/temporary-access` | Generate time-bounded secure share link | `SHARE` on target resource |
| `GET` | `/api/v1/temporary-access/{token}` | Validate public share token, return resource metadata | Public / Guest |
| `POST` | `/api/v1/temporary-access/{token}/verify` | Unlock password-protected temporary share | Public / Guest |
| `GET` | `/api/v1/temporary-access/{token}/view` | Stream document for temporary viewer | Public / Guest (Checked for expiry) |
| `DELETE` | `/api/v1/temporary-access/{id}` | Revoke an existing temporary access grant | `SHARE` or `SUPER_ADMIN` |

#### Temporary Access Grant Creation:
```json
{
  "targetType": "DOCUMENT",
  "targetId": "e83b8b1a-28e4-4a2e-b6a1-0f7962450892",
  "validFrom": "2026-09-03T12:00:00Z",
  "validUntil": "2026-09-05T12:00:00Z",
  "permissions": ["VIEW"],
  "maxViews": 5,
  "password": "SecurePassword123!"
}
```

---

### 2.5 Scanner Agent & Mobile Ingestion Endpoints

| Method | Endpoint | Description | Auth & Permission |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/scanner/pair` | Issue paired authentication token for desktop agent | `UPLOAD` |
| `POST` | `/api/v1/scanner/upload` | Ingest multi-page scanned PDF directly from agent | `UPLOAD` (Paired Agent Token) |
| `POST` | `/api/v1/mobile/session` | Create ephemeral mobile upload session (QR code payload)| `UPLOAD` |
| `POST` | `/api/v1/mobile/upload` | Upload mobile camera scanned page bundle | `UPLOAD` (Mobile Session Token) |

---

### 2.6 Audit & Administration Modules

| Method | Endpoint | Description | Auth & Permission |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/audit/logs` | Query audit logs with actor, entity, date filters | `AUDIT_READ` |
| `GET` | `/api/v1/admin/config` | Retrieve system settings (active storage provider, OCR)| `SUPER_ADMIN` |
| `PUT` | `/api/v1/admin/config/storage` | Switch active storage provider (`LOCAL` <-> `S3`) | `SUPER_ADMIN` |
