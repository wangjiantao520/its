-- Connect an approved survey record to every formal quotation created from it.
ALTER TABLE quotation_records
  ADD COLUMN IF NOT EXISTS survey_record_id bigint
  REFERENCES survey_records(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotation_records_survey_record_id
  ON quotation_records(survey_record_id)
  WHERE survey_record_id IS NOT NULL;

-- The app accesses business tables through the authenticated server-side
-- PostgreSQL connection. Supabase Data API roles have no table grants; RLS is
-- enabled as defense in depth so a future grant does not expose rows by default.
-- No policies are created, so anon/authenticated receive no row access.
DO $$
DECLARE
  target_table record;
BEGIN
  FOR target_table IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', target_table.schemaname, target_table.tablename);
  END LOOP;
END
$$;
