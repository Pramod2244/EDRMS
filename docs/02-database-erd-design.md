# 02 - Database Entity Relationship Design (ERD)

## 1. Schema Overview & Design Principles

The EDRMS database schema is engineered for **PostgreSQL 16** with the following design principles:
- **Hierarchical Performance**: Folders use a materialized path pattern (compatible with the PostgreSQL `LTREE` extension) allowing sub-millisecond retrieval of deeply nested trees and ancestral permission resolution in a single query.
- **Strict Immutability for Audit**: The `audit_logs` table is append-only, with cryptographically verifiable payload checksums.
- **Decoupled Module Tables**: Inter-module relationships rely on UUID foreign keys rather than tight JPA cascading, preserving clean boundaries for future microservice extraction.
- **Page-Level Granularity**: Document pages are modeled as first-class child entities to enable direct page-level search result navigation and page thumbnail caching.

---

## 2. Mermaid Entity Relationship Diagram

```mermaid
erDiagram
    USERS {
        uuid id PK
        varchar keycloak_id UK
        varchar username UK
        varchar email
        varchar full_name
        varchar status
        timestamptz created_at
        timestamptz updated_at
    }

    ROLES {
        uuid id PK
        varchar name UK
        varchar description
        boolean is_system
        timestamptz created_at
    }

    PERMISSIONS {
        uuid id PK
        varchar name UK
        varchar description
    }

    USER_ROLES {
        uuid user_id PK, FK
        uuid role_id PK, FK
        timestamptz assigned_at
    }

    ROLE_PERMISSIONS {
        uuid role_id PK, FK
        uuid permission_id PK, FK
    }

    FOLDERS {
        uuid id PK
        varchar name
        uuid parent_id FK
        varchar materialized_path
        integer depth
        uuid owner_id FK
        boolean is_deleted
        timestamptz created_at
        timestamptz updated_at
    }

    FOLDER_PERMISSIONS {
        uuid id PK
        uuid folder_id FK
        uuid user_id FK
        uuid role_id FK
        varchar permission
        boolean is_inherited
        uuid granted_by FK
        timestamptz created_at
    }

    DOCUMENTS {
        uuid id PK
        uuid folder_id FK
        varchar name
        varchar mime_type
        varchar extension
        bigint file_size_bytes
        varchar checksum_sha256
        integer current_version
        varchar status
        varchar storage_provider
        varchar storage_key
        integer page_count
        uuid owner_id FK
        boolean is_deleted
        timestamptz created_at
        timestamptz updated_at
    }

    DOCUMENT_VERSIONS {
        uuid id PK
        uuid document_id FK
        integer version_number
        varchar storage_provider
        varchar storage_key
        bigint file_size_bytes
        varchar checksum_sha256
        uuid created_by FK
        timestamptz created_at
    }

    DOCUMENT_PERMISSIONS {
        uuid id PK
        uuid document_id FK
        uuid user_id FK
        uuid role_id FK
        varchar permission
        varchar access_type
        uuid granted_by FK
        timestamptz created_at
    }

    DOCUMENT_PAGES {
        uuid id PK
        uuid document_id FK
        integer page_number
        text text_content
        float ocr_confidence
        varchar thumbnail_storage_key
        integer page_width
        integer page_height
        timestamptz created_at
    }

    TEMPORARY_ACCESS_GRANTS {
        uuid id PK
        varchar token_hash UK
        varchar target_type
        uuid target_id
        uuid user_id FK
        varchar permissions_mask
        timestamptz valid_from
        timestamptz valid_until
        integer max_views
        integer view_count
        boolean is_revoked
        varchar password_hash
        uuid created_by FK
        timestamptz created_at
    }

    PROCESSING_TASKS {
        uuid id PK
        uuid document_id FK
        varchar task_type
        varchar status
        integer retry_count
        text error_message
        jsonb metadata
        timestamptz started_at
        timestamptz completed_at
        timestamptz created_at
    }

    AUDIT_LOGS {
        bigserial id PK
        varchar trace_id
        uuid actor_user_id
        varchar actor_username
        varchar client_ip
        varchar user_agent
        varchar action
        varchar entity_type
        varchar entity_id
        varchar status
        jsonb details_json
        timestamptz created_at
    }

    SYSTEM_CONFIGURATIONS {
        uuid id PK
        varchar config_key UK
        text config_value
        varchar category
        boolean is_encrypted
        uuid updated_by
        timestamptz updated_at
    }

    USERS ||--o{ USER_ROLES : has
    ROLES ||--o{ USER_ROLES : assigned_to
    ROLES ||--o{ ROLE_PERMISSIONS : defines
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : maps_to

    USERS ||--o{ FOLDERS : owns
    FOLDERS ||--o{ FOLDERS : contains
    FOLDERS ||--o{ FOLDER_PERMISSIONS : has
    FOLDERS ||--o{ DOCUMENTS : stores
    DOCUMENTS ||--o{ DOCUMENT_VERSIONS : tracks
    DOCUMENTS ||--o{ DOCUMENT_PERMISSIONS : overrides
    DOCUMENTS ||--o{ DOCUMENT_PAGES : has
    DOCUMENTS ||--o{ PROCESSING_TASKS : spawns
```

---

## 3. Detailed Data Dictionary

### 3.1 Identity & Access (`users`, `roles`, `permissions`)
- `users`: Synchronized JIT (Just-In-Time) from Keycloak JWT claims upon login.
- `permissions`: Pre-populated system catalog (`VIEW`, `UPLOAD`, `DOWNLOAD`, `DELETE`, `SHARE`, `PRINT`, `MANAGE_PERMISSIONS`, `AUDIT_READ`).
- `user_roles` / `role_permissions`: Standard many-to-many junction tables.

### 3.2 Hierarchical Folders (`folders`, `folder_permissions`)
- `materialized_path`: Stores slash-delimited ancestor UUIDs (e.g. `/root-uuid/parent-uuid/this-uuid`).
- Querying all ancestors of folder `X` is achieved with `WHERE :path LIKE materialized_path || '%'`.
- Querying all recursive descendants is `WHERE materialized_path LIKE :parentPath || '%'`.
- `folder_permissions`: Can target either a specific `user_id` or an entire `role_id`. `is_inherited` flags whether child folders and documents should automatically receive this grant.

### 3.3 Documents & Page Navigation (`documents`, `document_versions`, `document_pages`)
- `documents.status`: Enumeration (`PENDING`, `PROCESSING`, `INDEXED`, `FAILED`).
- `documents.storage_provider`: Identifies which SPI engine holds the physical binary (`LOCAL`, `S3`).
- `documents.storage_key`: Unique path/URI in the storage backend (e.g., `documents/2026/09/uuid.pdf`).
- `document_pages`: Stores per-page OCR/extracted text, width/height, and `thumbnail_storage_key`. This table enables the search engine to return exact `page_number` hits and coordinates directly to the frontend PDF viewer.

### 3.4 Governance & Sharing (`temporary_access_grants`, `audit_logs`, `system_configurations`)
- `temporary_access_grants`: Stores secure SHA-256 hashes of one-time or time-bounded share tokens. Includes configurable `valid_from`, `valid_until`, `max_views`, and optional password protection.
- `audit_logs`: Append-only compliance log. Tracks all sensitive actions (`VIEW`, `UPLOAD`, `DOWNLOAD`, `DELETE`, `SHARE`, `PRINT`, `PERMISSION_CHANGE`). Indexed heavily on `(entity_type, entity_id)` and `created_at`.
- `system_configurations`: Key-value store for dynamic platform switches (such as `STORAGE_ACTIVE_PROVIDER = LOCAL | S3`).

---

## 4. Indexing & Optimization Strategy

1. **Hierarchy Traversal Index**:
   ```sql
   CREATE INDEX idx_folders_materialized_path ON folders USING btree (materialized_path varchar_pattern_ops);
   CREATE INDEX idx_folders_parent_id ON folders (parent_id) WHERE is_deleted = false;
   ```
2. **Permission Evaluation Index**:
   ```sql
   CREATE INDEX idx_folder_perms_lookup ON folder_permissions (folder_id, user_id, role_id);
   CREATE INDEX idx_doc_perms_lookup ON document_permissions (document_id, user_id, role_id);
   ```
3. **Document Search & Filtering Index**:
   ```sql
   CREATE INDEX idx_documents_folder_status ON documents (folder_id, status) WHERE is_deleted = false;
   CREATE INDEX idx_documents_checksum ON documents (checksum_sha256);
   CREATE INDEX idx_doc_pages_doc_page ON document_pages (document_id, page_number);
   ```
4. **Audit Trail Temporal Index**:
   ```sql
   CREATE INDEX idx_audit_created_at ON audit_logs (created_at DESC);
   CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id);
   CREATE INDEX idx_audit_actor ON audit_logs (actor_user_id, created_at DESC);
   ```
