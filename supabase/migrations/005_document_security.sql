-- Document encryption metadata + access audit log
-- Run in Supabase SQL Editor after previous migrations

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS encrypted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS encryption_iv TEXT,
  ADD COLUMN IF NOT EXISTS encryption_auth_tag TEXT;

-- New uploads set encrypted=true; legacy rows stay false

CREATE TABLE IF NOT EXISTS document_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('client', 'admin')),
  actor_id TEXT,
  action TEXT NOT NULL DEFAULT 'download',
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_access_document ON document_access_log(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_access_client ON document_access_log(client_id);
CREATE INDEX IF NOT EXISTS idx_doc_access_created ON document_access_log(created_at DESC);

ALTER TABLE document_access_log ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN documents.encrypted IS 'True when ciphertext stored; decrypt only via app with DOCUMENT_ENCRYPTION_KEY';
COMMENT ON TABLE document_access_log IS 'Audit trail for every document download';
