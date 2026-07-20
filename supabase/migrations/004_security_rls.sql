-- Defense in depth: enable RLS and deny direct table access for anon/authenticated.
-- The app uses the service_role key server-side, which bypasses RLS.
-- This blocks accidental use of the anon key from the browser against raw tables.

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Drop any overly permissive policies if re-run (ignore errors by using IF EXISTS via DO)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'clients', 'appointments', 'intake_forms', 'documents',
        'communications', 'activity_log', 'availability_rules',
        'blocked_dates', 'notification_log'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Explicit deny-all for anon + authenticated (no policies that grant access).
-- Service role bypasses RLS entirely.

-- Optional: allow public read of availability only if you ever query with anon key.
-- The app does not need this (server uses service role). Left locked down.

COMMENT ON TABLE clients IS 'RLS enabled — access only via service_role / server API';
