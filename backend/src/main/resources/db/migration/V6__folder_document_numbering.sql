CREATE TABLE folder_numbering (
    folder_id UUID PRIMARY KEY REFERENCES folders(id),
    prefix VARCHAR(40) NOT NULL,
    date_mode VARCHAR(20) NOT NULL DEFAULT 'NONE',
    padding INTEGER NOT NULL DEFAULT 4 CHECK (padding BETWEEN 1 AND 10),
    next_number BIGINT NOT NULL DEFAULT 1001 CHECK (next_number BETWEEN 1 AND 9000000000000000),
    revision BIGINT NOT NULL DEFAULT 0
);
-- Reservations survive configuration changes and document deletion.
CREATE TABLE folder_numbering_prefixes (
    prefix VARCHAR(40) PRIMARY KEY,
    folder_id UUID NOT NULL REFERENCES folders(id)
);
INSERT INTO folder_numbering(folder_id,prefix)
SELECT id, 'DOC' || upper(replace(id::text,'-','')) FROM folders;
INSERT INTO folder_numbering_prefixes(prefix,folder_id)
SELECT prefix,folder_id FROM folder_numbering;
ALTER TABLE documents ADD COLUMN reference_id VARCHAR(100);
CREATE UNIQUE INDEX documents_reference_id_unique ON documents(reference_id) WHERE reference_id IS NOT NULL;
