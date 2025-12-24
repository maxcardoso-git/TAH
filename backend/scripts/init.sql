-- =====================================================================
-- Access & Role Management Console (IAM) - PostgreSQL DDL (Multi-tenant)
-- =====================================================================

BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_status') THEN
    CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'deleted');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_status') THEN
    CREATE TYPE app_status AS ENUM ('active', 'inactive', 'maintenance', 'deprecated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_status') THEN
    CREATE TYPE role_status AS ENUM ('active', 'inactive', 'deleted');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_tenant_status') THEN
    CREATE TYPE user_tenant_status AS ENUM ('active', 'invited', 'suspended', 'revoked');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permission_lifecycle') THEN
    CREATE TYPE permission_lifecycle AS ENUM ('active', 'deprecated', 'removed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_action') THEN
    CREATE TYPE audit_action AS ENUM (
      'CREATE', 'UPDATE', 'DELETE',
      'ENABLE', 'DISABLE',
      'ASSIGN', 'UNASSIGN',
      'SYNC', 'LOGIN', 'LOGOUT'
    );
  END IF;
END $$;

-- Helper function for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE,
  name            TEXT NOT NULL,
  status          tenant_status NOT NULL DEFAULT 'active',
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON tenants;
CREATE TRIGGER trg_tenants_updated_at
BEFORE UPDATE ON tenants
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           CITEXT UNIQUE,
  display_name    TEXT,
  password_hash   TEXT,
  status          TEXT NOT NULL DEFAULT 'active',
  external_subject TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- User-Tenant membership
CREATE TABLE IF NOT EXISTS user_tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status          user_tenant_status NOT NULL DEFAULT 'active',
  invited_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  invite_token    TEXT UNIQUE,
  invite_expires_at TIMESTAMPTZ,
  joined_at       TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tenant_id)
);

DROP TRIGGER IF EXISTS trg_user_tenants_updated_at ON user_tenants;
CREATE TRIGGER trg_user_tenants_updated_at
BEFORE UPDATE ON user_tenants
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant ON user_tenants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_user ON user_tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_status ON user_tenants(status);
CREATE INDEX IF NOT EXISTS idx_user_tenants_invite_token ON user_tenants(invite_token) WHERE invite_token IS NOT NULL;

-- Applications
CREATE TABLE IF NOT EXISTS applications (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  description       TEXT,
  base_url          TEXT NOT NULL,
  status            app_status NOT NULL DEFAULT 'active',
  current_version   TEXT,
  healthcheck_url   TEXT,
  auth_mode         TEXT NOT NULL DEFAULT 'platform_jwt',
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_applications_updated_at ON applications;
CREATE TRIGGER trg_applications_updated_at
BEFORE UPDATE ON applications
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

-- Tenant Applications
CREATE TABLE IF NOT EXISTS tenant_applications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  application_id  TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  status          app_status NOT NULL DEFAULT 'active',
  enabled_at      TIMESTAMPTZ,
  disabled_at     TIMESTAMPTZ,
  config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, application_id)
);

DROP TRIGGER IF EXISTS trg_tenant_applications_updated_at ON tenant_applications;
CREATE TRIGGER trg_tenant_applications_updated_at
BEFORE UPDATE ON tenant_applications
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_tenant_apps_tenant ON tenant_applications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_apps_app ON tenant_applications(application_id);
CREATE INDEX IF NOT EXISTS idx_tenant_apps_status ON tenant_applications(status);

-- External Permissions
CREATE TABLE IF NOT EXISTS external_permissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id    TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  module_key        TEXT NOT NULL,
  module_name       TEXT,
  permission_key    TEXT NOT NULL,
  description       TEXT,
  lifecycle         permission_lifecycle NOT NULL DEFAULT 'active',
  first_seen_version TEXT,
  last_seen_version  TEXT,
  discovered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (application_id, permission_key)
);

DROP TRIGGER IF EXISTS trg_external_permissions_updated_at ON external_permissions;
CREATE TRIGGER trg_external_permissions_updated_at
BEFORE UPDATE ON external_permissions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_extperm_app ON external_permissions(application_id);
CREATE INDEX IF NOT EXISTS idx_extperm_module ON external_permissions(application_id, module_key);
CREATE INDEX IF NOT EXISTS idx_extperm_lifecycle ON external_permissions(lifecycle);

-- Permission Sync Runs
CREATE TABLE IF NOT EXISTS permission_sync_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id    TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  run_type          TEXT NOT NULL DEFAULT 'pull',
  requested_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  app_version       TEXT,
  status            TEXT NOT NULL DEFAULT 'success',
  summary           JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message     TEXT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perm_sync_app ON permission_sync_runs(application_id);
CREATE INDEX IF NOT EXISTS idx_perm_sync_status ON permission_sync_runs(status);
CREATE INDEX IF NOT EXISTS idx_perm_sync_started ON permission_sync_runs(started_at DESC);

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  status          role_status NOT NULL DEFAULT 'active',
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE (tenant_id, name)
);

DROP TRIGGER IF EXISTS trg_roles_updated_at ON roles;
CREATE TRIGGER trg_roles_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_roles_status ON roles(status);

-- Role Permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_id            UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  application_id     TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  permission_key     TEXT NOT NULL,
  granted_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, role_id, application_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_roleperm_tenant_role ON role_permissions(tenant_id, role_id);
CREATE INDEX IF NOT EXISTS idx_roleperm_app ON role_permissions(application_id);
CREATE INDEX IF NOT EXISTS idx_roleperm_perm ON role_permissions(permission_key);

-- User Roles
CREATE TABLE IF NOT EXISTS user_roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_tenant_user ON user_roles(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- User Effective Permissions (materialized)
CREATE TABLE IF NOT EXISTS user_effective_permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id  TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  permission_key  TEXT NOT NULL,
  source          TEXT NOT NULL DEFAULT 'rbac',
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id, application_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_uep_tenant_user_app ON user_effective_permissions(tenant_id, user_id, application_id);

-- Access Sessions
CREATE TABLE IF NOT EXISTS access_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID REFERENCES tenants(id) ON DELETE SET NULL,
  user_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  session_type       TEXT NOT NULL DEFAULT 'web',
  issued_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at         TIMESTAMPTZ,
  revoked_at         TIMESTAMPTZ,
  token_jti          TEXT,
  ip_address         INET,
  user_agent         TEXT,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON access_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON access_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_jti ON access_sessions(token_jti);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID REFERENCES tenants(id) ON DELETE SET NULL,
  actor_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action           audit_action NOT NULL,
  entity_type      TEXT NOT NULL,
  entity_id        TEXT,
  entity_ref       JSONB NOT NULL DEFAULT '{}'::jsonb,
  changes          JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_time ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor_time ON audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

-- Views
CREATE OR REPLACE VIEW v_role_permissions_expanded AS
SELECT
  rp.tenant_id,
  rp.role_id,
  r.name AS role_name,
  rp.application_id,
  a.name AS application_name,
  rp.permission_key,
  ep.module_key,
  COALESCE(ep.module_name, ep.module_key) AS module_name,
  ep.description AS permission_description,
  ep.lifecycle,
  rp.granted_at
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN applications a ON a.id = rp.application_id
LEFT JOIN external_permissions ep
  ON ep.application_id = rp.application_id
 AND ep.permission_key = rp.permission_key;

CREATE OR REPLACE VIEW v_user_effective_permissions_rbac AS
SELECT DISTINCT
  ur.tenant_id,
  ur.user_id,
  rp.application_id,
  rp.permission_key
FROM user_roles ur
JOIN role_permissions rp
  ON rp.tenant_id = ur.tenant_id
 AND rp.role_id = ur.role_id;

COMMIT;
