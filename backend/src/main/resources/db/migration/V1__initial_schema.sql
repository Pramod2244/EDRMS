-- =============================================================================
-- EDRMS Initial Schema Migration (V1)
-- Enterprise Document Repository Management System
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Identity & Access Control (Users, Roles, Permissions)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keycloak_id VARCHAR(64) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_system BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255)
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- -----------------------------------------------------------------------------
-- 2. Folders & Materialized Hierarchies
-- -----------------------------------------------------------------------------
CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    materialized_path VARCHAR(1000) NOT NULL,
    depth INT NOT NULL DEFAULT 0,
    owner_id UUID NOT NULL REFERENCES users(id),
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_folders_materialized_path ON folders (materialized_path varchar_pattern_ops);
CREATE INDEX idx_folders_parent_id ON folders (parent_id) WHERE is_deleted = false;

CREATE TABLE folder_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission VARCHAR(50) NOT NULL,
    is_inherited BOOLEAN NOT NULL DEFAULT true,
    granted_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_folder_perm_target CHECK (user_id IS NOT NULL OR role_id IS NOT NULL)
);

CREATE INDEX idx_folder_perms_lookup ON folder_permissions (folder_id, user_id, role_id);

-- -----------------------------------------------------------------------------
-- 3. Documents, Versions & Granular Overrides
-- -----------------------------------------------------------------------------
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(150) NOT NULL,
    extension VARCHAR(20) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    checksum_sha256 VARCHAR(64) NOT NULL,
    current_version INT NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    storage_provider VARCHAR(50) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    page_count INT,
    owner_id UUID NOT NULL REFERENCES users(id),
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_documents_folder_status ON documents (folder_id, status) WHERE is_deleted = false;
CREATE INDEX idx_documents_checksum ON documents (checksum_sha256);

CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    storage_provider VARCHAR(50) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    checksum_sha256 VARCHAR(64) NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (document_id, version_number)
);

CREATE TABLE document_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission VARCHAR(50) NOT NULL,
    access_type VARCHAR(10) NOT NULL DEFAULT 'ALLOW',
    granted_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_doc_perm_target CHECK (user_id IS NOT NULL OR role_id IS NOT NULL)
);

CREATE INDEX idx_doc_perms_lookup ON document_permissions (document_id, user_id, role_id);

-- -----------------------------------------------------------------------------
-- 4. Document Pages & OCR Coordinates (Direct Search Hit Navigation)
-- -----------------------------------------------------------------------------
CREATE TABLE document_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    text_content TEXT,
    ocr_confidence DOUBLE PRECISION,
    thumbnail_storage_key VARCHAR(500),
    page_width INT,
    page_height INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (document_id, page_number)
);

CREATE INDEX idx_doc_pages_doc_page ON document_pages (document_id, page_number);

-- -----------------------------------------------------------------------------
-- 5. Processing Tasks (Asynchronous Pipeline Queue & Worker State)
-- -----------------------------------------------------------------------------
CREATE TABLE processing_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    task_type VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    retry_count INT NOT NULL DEFAULT 0,
    error_message TEXT,
    metadata JSONB,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tasks_status ON processing_tasks (status, task_type);

-- -----------------------------------------------------------------------------
-- 6. Temporary Access Grants
-- -----------------------------------------------------------------------------
CREATE TABLE temporary_access_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    target_type VARCHAR(30) NOT NULL,
    target_id UUID NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    permissions_mask VARCHAR(100) NOT NULL DEFAULT 'VIEW',
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    max_views INT,
    view_count INT NOT NULL DEFAULT 0,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    password_hash VARCHAR(255),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_temp_access_lookup ON temporary_access_grants (token_hash) WHERE is_revoked = false;

-- -----------------------------------------------------------------------------
-- 7. Audit Logging (Immutable Compliance Trail)
-- -----------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    trace_id VARCHAR(64) NOT NULL,
    actor_user_id UUID,
    actor_username VARCHAR(100),
    client_ip VARCHAR(45) NOT NULL,
    user_agent VARCHAR(500),
    action VARCHAR(60) NOT NULL,
    entity_type VARCHAR(60) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',
    details_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_created_at ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_actor ON audit_logs (actor_user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 8. Dynamic System Configurations (Runtime Storage Provider Switch)
-- -----------------------------------------------------------------------------
CREATE TABLE system_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    is_encrypted BOOLEAN NOT NULL DEFAULT false,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 9. Initial Seed Data
-- -----------------------------------------------------------------------------
INSERT INTO permissions (name, description) VALUES
    ('VIEW', 'Read metadata and preview document pages'),
    ('UPLOAD', 'Upload new documents or create folders'),
    ('DOWNLOAD', 'Download original binary document'),
    ('DELETE', 'Soft-delete documents or folders'),
    ('SHARE', 'Generate temporary access share links'),
    ('PRINT', 'Authorize document watermarked printing'),
    ('MANAGE_PERMISSIONS', 'Configure folder or document access control lists'),
    ('AUDIT_READ', 'Inspect and export system compliance audit logs');

INSERT INTO roles (name, description, is_system) VALUES
    ('SUPER_ADMIN', 'Full system administration privileges', true),
    ('DEPARTMENT_MANAGER', 'Departmental management and approval', true),
    ('CONTRIBUTOR', 'Standard user with upload and edit capabilities', true),
    ('VIEWER', 'Read-only observer access', true),
    ('AUDITOR', 'Compliance and audit inspector', true);

-- Grant all permissions to SUPER_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'SUPER_ADMIN';

-- Initial Storage Provider Setting
INSERT INTO system_configurations (config_key, config_value, category) VALUES
    ('STORAGE_ACTIVE_PROVIDER', 'LOCAL', 'STORAGE'),
    ('OCR_ACTIVE_ENGINE', 'AWS_TEXTRACT', 'OCR');
