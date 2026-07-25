-- Read-only reporting view. Consumed by the Revenue Cost Engine on every run:
-- when a project appears here, its actual_cost supersedes the SOW labour
-- estimate on the REVENUE sheet. The dashboard never writes to REVENUE, so
-- this is the sole channel by which logged hours flow back to the engine.
--
-- Design choices (deliberate, see prompt):
--   * JOIN + HAVING SUM(hours) > 0 — a project with no hours must not appear.
--     Presence in this view means "actuals exist, use them"; a zero-hour row
--     would wipe the estimate to zero.
--   * billable is ignored — every logged hour is a real cost. billable is an
--     invoicing distinction, not a costing one.
--   * hours_without_rate is surfaced. Unpriced hours contribute 0 to
--     actual_cost via the LEFT JOIN, which would silently understate COGS.
--     This column makes that visible to the engine instead of hiding it.
CREATE OR REPLACE VIEW public.v_project_labour_actual AS
SELECT
  p.id                                                        AS project_id,
  p.zoho_deal_id                                              AS zoho_deal_id,
  COALESCE(SUM(te.hours), 0)                                  AS total_hours,
  COALESCE(SUM(te.hours * er.hourly_rate), 0)                 AS actual_cost,
  COUNT(te.id)                                                AS entry_count,
  MAX(te.work_date)                                           AS last_entry_date,
  COALESCE(SUM(te.hours) FILTER (WHERE er.hourly_rate IS NULL), 0)
                                                              AS hours_without_rate
FROM   public.projects p
JOIN   public.time_entries te   ON te.project_id = p.id
LEFT   JOIN public.employee_rates er ON er.user_id = te.user_id
WHERE  p.zoho_deal_id IS NOT NULL
GROUP  BY p.id, p.zoho_deal_id
HAVING COALESCE(SUM(te.hours), 0) > 0;

GRANT SELECT ON public.v_project_labour_actual TO authenticated;
GRANT SELECT ON public.v_project_labour_actual TO service_role;