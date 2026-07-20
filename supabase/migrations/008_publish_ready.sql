-- =============================================================================
-- Publish-ready: firm settings, client consents, retention support
-- =============================================================================

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
CREATE INDEX IF NOT EXISTS idx_client_consents_type ON client_consents(consent_type);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS engagement_accepted_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS retention_hold BOOLEAN DEFAULT false;

-- Seed default firm settings (safe if re-run)
INSERT INTO firm_settings (key, value, updated_by)
VALUES
  ('affirm_legal_review', 'false'::jsonb, 'migration'),
  ('affirm_data_controller', 'false'::jsonb, 'migration'),
  ('affirm_efile_policy', 'false'::jsonb, 'migration'),
  ('affirm_insurance', 'false'::jsonb, 'migration'),
  ('go_live', 'false'::jsonb, 'migration'),
  ('retention_years', '7'::jsonb, 'migration')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE firm_settings IS 'Go-live affirmations and firm-level publish configuration';
COMMENT ON TABLE client_consents IS 'Immutable consent records for privacy, terms, ESIGN, engagement';
