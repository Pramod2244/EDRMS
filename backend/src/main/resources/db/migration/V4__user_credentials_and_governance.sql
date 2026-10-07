-- =============================================================================
-- Migration V4: User Credentials & Access Governance
-- Dynamically persist user accounts, roles, folder scopes, and credentials in the users table
-- =============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'CONTRIBUTOR';
ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_folder_ids TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS accessible_menus TEXT DEFAULT '/documents,/search';
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS duration_seconds BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Ensure root admin user has full SUPER_ADMIN access and standard password
UPDATE users
SET role = 'SUPER_ADMIN',
    password_hash = COALESCE(password_hash, 'Admin123!'),
    full_name = COALESCE(full_name, 'Administrator'),
    accessible_menus = '/documents,/search,/audit,/admin',
    permissions = 'VIEW,UPLOAD,DOWNLOAD,DELETE,SHARE,PRINT,MANAGE_PERMISSIONS,AUDIT_READ',
    status = 'ACTIVE'
WHERE username = 'admin';

-- If no admin exists in users table, insert it
INSERT INTO users (
    id, keycloak_id, username, email, full_name, status,
    role, password_hash, accessible_menus, permissions, is_temporary
)
SELECT
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'admin',
    'admin@arkaa-digital.local',
    'Administrator',
    'ACTIVE',
    'SUPER_ADMIN',
    'Admin123!',
    '/documents,/search,/audit,/admin',
    'VIEW,UPLOAD,DOWNLOAD,DELETE,SHARE,PRINT,MANAGE_PERMISSIONS,AUDIT_READ',
    false
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

-- Set default password and permissions for any existing users
UPDATE users
SET password_hash = COALESCE(password_hash, 'Admin123!'),
    role = COALESCE(role, 'CONTRIBUTOR'),
    accessible_menus = COALESCE(accessible_menus, '/documents,/search'),
    permissions = COALESCE(permissions, 'VIEW,UPLOAD,DOWNLOAD,PRINT')
WHERE password_hash IS NULL;

-- Rename any comma artifact username to a clean identifier
UPDATE users
SET username = 'manoj_user',
    full_name = 'Manoj',
    email = 'manoj_user@arkaa-digital.local'
WHERE username = 'manoj,manoj';
