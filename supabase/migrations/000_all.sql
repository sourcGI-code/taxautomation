-- =============================================================================
-- TAX PORTAL — FINISHED DATABASE (run entire file in Supabase SQL Editor)
-- Safe to re-run: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables (full finished shape)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'booked',
  onboarding_step TEXT NOT NULL DEFAULT 'welcome_sent',
  magic_token TEXT UNIQUE,
  magic_token_expires_at TIMESTAMPTZ,
  tax_year INTEGER,
  staff_notes TEXT,
  signature_acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  cal_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intake_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  category TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outbound',
  subject TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS availability_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  sequence_key TEXT NOT NULL,
  channel TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, sequence_key, channel)
);

-- ---------------------------------------------------------------------------
-- Upgrade path: add missing columns if tables were created from older SQL
-- (CREATE TABLE IF NOT EXISTS will NOT add columns to existing tables)
-- ---------------------------------------------------------------------------

ALTER TABLE clients ADD COLUMN IF NOT EXISTS tax_year INTEGER;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS staff_notes TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS signature_acknowledged_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS assigned_preparer_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS assigned_preparer_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS signature_typed_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS signature_method TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS signature_ip TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS signature_user_agent TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS encrypted BOOLEAN DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS encryption_iv TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS encryption_auth_tag TEXT;

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

UPDATE clients
SET tax_year = EXTRACT(YEAR FROM NOW())::INTEGER - 1
WHERE tax_year IS NULL;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_tax_year ON clients(tax_year);
CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_starts_at ON appointments(starts_at);
CREATE INDEX IF NOT EXISTS idx_documents_client ON documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_activity_client ON activity_log(client_id);
CREATE INDEX IF NOT EXISTS idx_communications_client ON communications(client_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_client ON notification_log(client_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_sequence ON notification_log(sequence_key);

-- ---------------------------------------------------------------------------
-- Default booking hours: Mon–Fri 9am–5pm, 30-minute slots
-- ---------------------------------------------------------------------------

INSERT INTO availability_rules (day_of_week, start_time, end_time, slot_duration_minutes)
SELECT d, '09:00'::time, '17:00'::time, 30
FROM generate_series(1, 5) AS d
WHERE NOT EXISTS (SELECT 1 FROM availability_rules LIMIT 1);

-- ---------------------------------------------------------------------------
-- Optional test client (safe if already exists)
-- ---------------------------------------------------------------------------

INSERT INTO clients (email, name, phone, status, onboarding_step, tax_year)
VALUES (
  'test@example.com',
  'Test Client',
  '+15551234567',
  'booked',
  'intake_pending',
  EXTRACT(YEAR FROM NOW())::INTEGER - 1
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  tax_year = COALESCE(clients.tax_year, EXCLUDED.tax_year),
  updated_at = NOW();

INSERT INTO appointments (client_id, starts_at, ends_at, status)
SELECT
  c.id,
  date_trunc('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day' + INTERVAL '15 hours',
  date_trunc('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day' + INTERVAL '15 hours 30 minutes',
  'scheduled'
FROM clients c
WHERE c.email = 'test@example.com'
  AND NOT EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.client_id = c.id AND a.status = 'scheduled'
  );

INSERT INTO intake_forms (client_id, data)
SELECT c.id, '{}'::jsonb
FROM clients c
WHERE c.email = 'test@example.com'
ON CONFLICT (client_id) DO NOTHING;

INSERT INTO activity_log (client_id, action, description)
SELECT c.id, 'seeded', 'Test client ready for portal testing'
FROM clients c
WHERE c.email = 'test@example.com'
  AND NOT EXISTS (
    SELECT 1 FROM activity_log al
    WHERE al.client_id = c.id AND al.action = 'seeded'
  );

-- ---------------------------------------------------------------------------
-- Column comments
-- ---------------------------------------------------------------------------

COMMENT ON COLUMN clients.staff_notes IS 'Internal only — never expose to client portal';
COMMENT ON COLUMN clients.signature_acknowledged_at IS 'Client acknowledged ready-for-signature return';
COMMENT ON COLUMN clients.tax_year IS 'Tax year being prepared (e.g. 2025)';
COMMENT ON COLUMN documents.category IS 'Checklist id: w2, 1099, id, prior_return, other, return_draft';
COMMENT ON COLUMN clients.status IS 'booked | intake_complete | documents_received | in_review | ready_for_signature | filed';
COMMENT ON COLUMN clients.onboarding_step IS 'welcome_sent | intake_pending | intake_complete | documents_pending | documents_complete | done';
COMMENT ON COLUMN appointments.status IS 'scheduled | cancelled | completed';
