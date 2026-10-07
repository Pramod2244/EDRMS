ALTER TABLE documents ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN deleted_by UUID;
ALTER TABLE documents ADD COLUMN purge_after TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN purged_at TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN purge_attempted_at TIMESTAMPTZ;
-- Give previously hidden documents a fresh recovery window, never immediate expiry.
UPDATE documents SET deleted_at=CURRENT_TIMESTAMP,purge_after=CURRENT_TIMESTAMP+INTERVAL '30 days' WHERE is_deleted=true;
CREATE INDEX documents_recycle_due ON documents(purge_after) WHERE is_deleted=true AND purged_at IS NULL;
INSERT INTO system_configurations(id,config_key,config_value,category,is_encrypted,updated_at)
VALUES(gen_random_uuid(),'RECYCLE_BIN_DAYS','30','APPLICATION',false,CURRENT_TIMESTAMP)
ON CONFLICT(config_key) DO NOTHING;
