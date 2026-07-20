-- Scaffold: tax year, staff notes, signature ack, document categories
-- Run in Supabase SQL Editor after 001 + 002

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS tax_year INTEGER,
  ADD COLUMN IF NOT EXISTS staff_notes TEXT,
  ADD COLUMN IF NOT EXISTS signature_acknowledged_at TIMESTAMPTZ;

-- Default tax year for existing rows (US: prior calendar year is typical mid-season)
UPDATE clients
SET tax_year = EXTRACT(YEAR FROM NOW())::INTEGER - 1
WHERE tax_year IS NULL;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS category TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_tax_year ON clients(tax_year);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);

-- Optional: comment for operators
COMMENT ON COLUMN clients.staff_notes IS 'Internal only — never expose to client portal';
COMMENT ON COLUMN clients.signature_acknowledged_at IS 'Client acknowledged ready-for-signature return';
COMMENT ON COLUMN documents.category IS 'Checklist category id: w2, 1099, id, prior_return, other, return_draft';
