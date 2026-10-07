-- Migration V3: Add document_version_id to document_pages
ALTER TABLE document_pages 
    ADD COLUMN IF NOT EXISTS document_version_id UUID REFERENCES document_versions(id) ON DELETE CASCADE;
