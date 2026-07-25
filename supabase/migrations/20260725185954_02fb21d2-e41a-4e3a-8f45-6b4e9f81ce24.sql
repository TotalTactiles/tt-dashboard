
CREATE TABLE IF NOT EXISTS public.project_forecast_snapshots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  zoho_deal_id      text,
  snapshot_type     text NOT NULL CHECK (snapshot_type IN ('original','restated')),
  captured_at       timestamptz NOT NULL DEFAULT now(),
  captured_reason   text NOT NULL CHECK (captured_reason IN ('project_created','stage_split')),
  contract_value    numeric(14,2),
  labour_cost       numeric(14,2),
  tactile_cost      numeric(14,2),
  other_cost        numeric(14,2),
  total_cogs        numeric(14,2),
  gross_margin      numeric(14,2),
  gp_percent        numeric(7,3),
  invoice_month     date,
  due_month         date,
  labour_month      date,
  tactile_month     date,
  tactile_rem_month date,
  other_month       date,
  source_row        jsonb,
  note              text
);

GRANT SELECT, INSERT ON public.project_forecast_snapshots TO authenticated;
GRANT ALL ON public.project_forecast_snapshots TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS pfs_one_original_per_project
  ON public.project_forecast_snapshots (project_id)
  WHERE snapshot_type = 'original';

CREATE INDEX IF NOT EXISTS pfs_project_captured
  ON public.project_forecast_snapshots (project_id, captured_at DESC);

CREATE OR REPLACE FUNCTION public.pfs_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION
    'project_forecast_snapshots is append-only. To restate a forecast, insert a new row with snapshot_type = ''restated''.';
END;
$$;

DROP TRIGGER IF EXISTS pfs_no_update ON public.project_forecast_snapshots;
CREATE TRIGGER pfs_no_update
  BEFORE UPDATE OR DELETE ON public.project_forecast_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.pfs_block_mutation();

CREATE OR REPLACE VIEW public.v_project_forecast AS
SELECT DISTINCT ON (s.project_id)
       s.project_id,
       s.zoho_deal_id,
       s.snapshot_type      AS effective_type,
       s.captured_at        AS effective_captured_at,
       s.captured_reason,
       s.contract_value,
       s.labour_cost,
       s.tactile_cost,
       s.other_cost,
       s.total_cogs,
       s.gross_margin,
       s.gp_percent,
       s.invoice_month,
       s.due_month,
       s.labour_month,
       s.tactile_month,
       s.tactile_rem_month,
       s.other_month,
       o.contract_value     AS original_contract_value,
       o.total_cogs         AS original_total_cogs,
       o.gross_margin       AS original_gross_margin,
       o.captured_at        AS original_captured_at
FROM   public.project_forecast_snapshots s
LEFT   JOIN public.project_forecast_snapshots o
       ON o.project_id = s.project_id
      AND o.snapshot_type = 'original'
ORDER  BY s.project_id,
          CASE s.snapshot_type WHEN 'restated' THEN 0 ELSE 1 END,
          s.captured_at DESC;

GRANT SELECT ON public.v_project_forecast TO authenticated;
GRANT ALL ON public.v_project_forecast TO service_role;
