-- =============================================================================
-- PEAK OPS: multi-staff, preparer assignment, full e-sign audit trail
-- Safe to re-run
-- =============================================================================

-- Assigned preparer (free-text name + optional staff id for env/db staff)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS assigned_preparer_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS assigned_preparer_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS signature_typed_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS signature_method TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS signature_ip TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS signature_user_agent TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'preparer'
    CHECK (role IN ('owner', 'preparer', 'viewer')),
  password_hash TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS e_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  typed_name TEXT NOT NULL,
  method TEXT NOT NULL,
  consent_text TEXT NOT NULL,
  signature_data_url TEXT,
  ip TEXT,
  user_agent TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_preparer ON clients(assigned_preparer_id);
CREATE INDEX IF NOT EXISTS idx_e_signatures_client ON e_signatures(client_id);
CREATE INDEX IF NOT EXISTS idx_staff_members_email ON staff_members(email);

-- Extend document encryption columns if missing (from 005)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS encrypted BOOLEAN DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS encryption_iv TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS encryption_auth_tag TEXT;

CREATE TABLE IF NOT EXISTS document_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL DEFAULT 'download',
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_access_doc ON document_access_log(document_id);
CREATE INDEX IF NOT EXISTS idx_document_access_client ON document_access_log(client_id);

COMMENT ON COLUMN clients.assigned_preparer_name IS 'Display name of assigned staff preparer';
COMMENT ON COLUMN clients.signed_at IS 'When client completed electronic signature';
COMMENT ON TABLE e_signatures IS 'Immutable e-sign audit records (one or more per client over time)';
COMMENT ON TABLE staff_members IS 'Optional DB-backed staff accounts (env STAFF_USERS also supported)';
