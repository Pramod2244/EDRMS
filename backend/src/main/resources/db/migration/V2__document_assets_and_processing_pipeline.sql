-- =============================================================================
-- EDRMS Migration V2: Document Assets, Processing Jobs, Capture & Ingestion
-- =============================================================================

-- 1. Extend existing core tables with tenant isolation & sequence order
ALTER TABLE folders 
    ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

ALTER TABLE documents 
    ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

ALTER TABLE document_versions 
    ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

ALTER TABLE document_pages 
    ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
    ADD COLUMN IF NOT EXISTS sequence_number INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS text_source VARCHAR(30) NOT NULL DEFAULT 'EMBEDDED',
    ADD COLUMN IF NOT EXISTS ocr_status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
    ADD COLUMN IF NOT EXISTS rotation INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS checksum_sha256 VARCHAR(64);

-- -----------------------------------------------------------------------------
-- 2. document_assets (Immutable original and derived asset representations)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    document_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
    document_page_id UUID REFERENCES document_pages(id) ON DELETE SET NULL,
    asset_type VARCHAR(50) NOT NULL, -- ORIGINAL, CANONICAL_PDF, PREVIEW_PDF, THUMBNAIL, PAGE_IMAGE, OCR_TEXT, EXTRACTED_TEXT
    storage_provider VARCHAR(50) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    mime_type VARCHAR(150),
    extension VARCHAR(20),
    size_bytes BIGINT,
    checksum_sha256 VARCHAR(64),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_assets_doc ON document_assets (document_id);
CREATE INDEX IF NOT EXISTS idx_doc_assets_version ON document_assets (document_version_id);
CREATE INDEX IF NOT EXISTS idx_doc_assets_page ON document_assets (document_page_id);
CREATE INDEX IF NOT EXISTS idx_doc_assets_type ON document_assets (asset_type);
CREATE INDEX IF NOT EXISTS idx_doc_assets_tenant ON document_assets (tenant_id);

-- -----------------------------------------------------------------------------
-- 3. processing_jobs (Durable asynchronous processing state)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    document_version_id UUID REFERENCES document_versions(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- PENDING, RUNNING, COMPLETED, FAILED, PARTIAL, RETRY_PENDING
    progress_percentage INT NOT NULL DEFAULT 0,
    attempt_count INT NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_code VARCHAR(100),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proc_jobs_doc ON processing_jobs (document_id);
CREATE INDEX IF NOT EXISTS idx_proc_jobs_status ON processing_jobs (status);

-- -----------------------------------------------------------------------------
-- 4. processing_job_steps (Granular 12-stage pipeline tracking)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS processing_job_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processing_job_id UUID NOT NULL REFERENCES processing_jobs(id) ON DELETE CASCADE,
    step_name VARCHAR(100) NOT NULL, -- VALIDATE_FILE, MALWARE_SCAN, HASH_FILE, STORE_ORIGINAL, EXTRACT_TEXT, DETECT_PAGES, OCR, GENERATE_THUMBNAILS, GENERATE_PREVIEW, INDEX_SEARCH, FINALIZE
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms BIGINT,
    error_message TEXT,
    metadata_json JSONB
);

CREATE INDEX IF NOT EXISTS idx_proc_job_steps_job ON processing_job_steps (processing_job_id);

-- -----------------------------------------------------------------------------
-- 5. capture_sessions (Contract for Browser, Desktop Scanner & Future Mobile)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS capture_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id),
    capture_type VARCHAR(50) NOT NULL, -- WEB_UPLOAD, BULK_UPLOAD, SCANNER_AGENT, MOBILE_WEB, API
    status VARCHAR(30) NOT NULL DEFAULT 'CREATED', -- CREATED, ACTIVE, UPLOADING, PROCESSING, COMPLETED, FAILED, EXPIRED, CANCELLED
    expires_at TIMESTAMPTZ,
    expected_item_count INT DEFAULT 1,
    received_item_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_capture_sessions_status ON capture_sessions (status);

-- -----------------------------------------------------------------------------
-- 6. ingestion_batches (High-Volume Digitization Batches)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingestion_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
    batch_number VARCHAR(100) NOT NULL UNIQUE,
    department_id UUID,
    category_id UUID,
    created_by UUID REFERENCES users(id),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    expected_documents INT DEFAULT 0,
    received_documents INT DEFAULT 0,
    processed_documents INT DEFAULT 0,
    failed_documents INT DEFAULT 0,
    duplicate_documents INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ingestion_batches_status ON ingestion_batches (status);
