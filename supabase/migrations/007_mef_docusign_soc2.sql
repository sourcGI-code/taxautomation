-- =============================================================================
-- IRS MeF e-file · DocuSign e-sign · SOC 2 control evidence
-- Safe to re-run
-- =============================================================================

-- Client e-file / e-sign linkage
ALTER TABLE clients ADD COLUMN IF NOT EXISTS efile_status TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS docusign_envelope_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS docusign_status TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS mef_submission_id TEXT;

-- ---------------------------------------------------------------------------
-- IRS Modernized e-File (MeF) submissions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mef_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tax_year INTEGER NOT NULL,
  form_type TEXT NOT NULL DEFAULT '1040',
  submission_id TEXT UNIQUE,
  transmission_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'validated',
      'ready_to_transmit',
      'transmitting',
      'accepted',
      'rejected',
      'exception',
      'cancelled'
    )),
  package_xml TEXT,
  manifest_xml TEXT,
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  ack_xml TEXT,
  ack_code TEXT,
  ack_message TEXT,
  efin TEXT,
  etin TEXT,
  environment TEXT NOT NULL DEFAULT 'sandbox'
    CHECK (environment IN ('sandbox', 'production')),
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
CREATE INDEX IF NOT EXISTS idx_mef_submission_id ON mef_submissions(submission_id);

-- ---------------------------------------------------------------------------
-- DocuSign envelopes (certified e-sign)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS docusign_envelopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  envelope_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN (
      'created',
      'sent',
      'delivered',
      'signed',
      'completed',
      'declined',
      'voided',
      'error'
    )),
  subject TEXT,
  signer_email TEXT NOT NULL,
  signer_name TEXT NOT NULL,
  document_name TEXT,
  signing_url TEXT,
  completed_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  webhook_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  certificate_of_completion_path TEXT,
  environment TEXT NOT NULL DEFAULT 'demo'
    CHECK (environment IN ('demo', 'production')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_docusign_client ON docusign_envelopes(client_id);
CREATE INDEX IF NOT EXISTS idx_docusign_envelope ON docusign_envelopes(envelope_id);
CREATE INDEX IF NOT EXISTS idx_docusign_status ON docusign_envelopes(status);

-- ---------------------------------------------------------------------------
-- SOC 2 continuous control evidence + security events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compliance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
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

CREATE INDEX IF NOT EXISTS idx_compliance_events_type ON compliance_events(event_type);
CREATE INDEX IF NOT EXISTS idx_compliance_events_control ON compliance_events(control_id);
CREATE INDEX IF NOT EXISTS idx_compliance_events_created ON compliance_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_events_severity ON compliance_events(severity);

CREATE TABLE IF NOT EXISTS soc2_control_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'collected'
    CHECK (status IN ('collected', 'reviewed', 'gap', 'remediated')),
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soc2_evidence_control ON soc2_control_evidence(control_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_soc2_evidence_unique
  ON soc2_control_evidence(control_id, evidence_type, title);

COMMENT ON TABLE mef_submissions IS 'IRS MeF e-file packages and acknowledgments (sandbox or production transmitter)';
COMMENT ON TABLE docusign_envelopes IS 'DocuSign eSignature envelopes for certified electronic signatures';
COMMENT ON TABLE compliance_events IS 'Immutable-style SOC2 security/compliance event log';
COMMENT ON TABLE soc2_control_evidence IS 'Mapped evidence artifacts for Trust Services Criteria controls';
