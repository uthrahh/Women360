-- Row-level security on every table.
--
-- The API connects as the owner of these tables (migrations and the running server use the same DATABASE_URL),
-- and PostgreSQL does not apply row-level security to a table's owner, so Women360 itself is unaffected.
-- What it does: with RLS on and no policies, any other role sees and changes nothing. On the hosted database
-- (Supabase) that closes its automatic data API, which reaches tables in the public schema through the
-- "anon" and "authenticated" roles, so a leaked project key could not read health data around the API.
-- New tables must do the same: tests/security.rls.test.ts fails while any table has it off.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- Belt and braces on the hosted database: take away the automatic API roles' table rights too.
-- (These roles exist only on Supabase; elsewhere this does nothing.)
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
    END IF;
  END LOOP;
END $$;
