-- =============================================================================
-- ONE-SHOT: paste entire file into Supabase → SQL Editor → Run
-- Applies peak ops + MeF/DocuSign/SOC2 + publish tables
-- Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- =============================================================================

-- From 006
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

-- From 007
ALTER TABLE clients ADD COLUMN IF NOT EXISTS efile_status TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS docusign_envelope_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS docusign_status TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS mef_submission_id TEXT;

CREATE TABLE IF NOT EXISTS mef_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tax_year INTEGER NOT NULL,
  form_type TEXT NOT NULL DEFAULT '1040',
  submission_id TEXT UNIQUE,
  transmission_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  package_xml TEXT,
  manifest_xml TEXT,
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  ack_xml TEXT,
  ack_code TEXT,
  ack_message TEXT,
  efin TEXT,
  etin TEXT,
  environment TEXT NOT NULL DEFAULT 'sandbox',
  prepared_by TEXT,
  transmitted_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mef_client ON mef_submissions(client_id);
CREATE INDEX IF NOT EXISTS idx_mef_status ON mef_submissions(status);

CREATE TABLE IF NOT EXISTS docusign_envelopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  envelope_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'created',
  subject TEXT,
  signer_email TEXT NOT NULL,
  signer_name TEXT NOT NULL,
  document_name TEXT,
  signing_url TEXT,
  completed_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  webhook_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  certificate_of_completion_path TEXT,
  environment TEXT NOT NULL DEFAULT 'demo',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_docusign_client ON docusign_envelopes(client_id);

CREATE TABLE IF NOT EXISTS compliance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  actor_type TEXT,
  actor_id TEXT,
  actor_email TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  control_id TEXT,
  action TEXT NOT NULL,
  description TEXT,
  ip TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_events_created ON compliance_events(created_at DESC);

CREATE TABLE IF NOT EXISTS soc2_control_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'collected',
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_soc2_evidence_unique
  ON soc2_control_evidence(control_id, evidence_type, title);

-- From 008
CREATE TABLE IF NOT EXISTS firm_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT 'null'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS client_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  version TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_consents_client ON client_consents(client_id);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS engagement_accepted_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS retention_hold BOOLEAN DEFAULT false;

INSERT INTO firm_settings (key, value, updated_by)
VALUES
  ('affirm_legal_review', 'false'::jsonb, 'migration'),
  ('affirm_data_controller', 'false'::jsonb, 'migration'),
  ('affirm_efile_policy', 'false'::jsonb, 'migration'),
  ('affirm_insurance', 'false'::jsonb, 'migration'),
  ('go_live', 'false'::jsonb, 'migration'),
  ('retention_years', '7'::jsonb, 'migration')
ON CONFLICT (key) DO NOTHING;
