
-- Fix functions missing search_path
CREATE OR REPLACE FUNCTION public.resolve_task_dates(p_rule date_rule, p_est_start date, p_proj_start date, p_proj_end date, p_window integer DEFAULT 4)
 RETURNS TABLE(start_date date, end_date date)
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path = public
AS $function$
declare e date;
begin
  if p_rule = 'none' then return query select null::date, null::date; return; end if;
  if p_rule = 'project_start_end' then return query select p_proj_start, p_proj_end; return; end if;
  e := case p_rule
    when 'est_start'           then p_est_start
    when 'est_start_minus_10w' then p_est_start - interval '10 weeks'
    when 'est_start_minus_8w'  then p_est_start - interval '8 weeks'
    when 'est_start_minus_6w'  then p_est_start - interval '6 weeks'
    when 'est_start_minus_2w'  then p_est_start - interval '2 weeks'
    when 'est_start_plus_10d'  then p_est_start + interval '10 days'
  end;
  return query select (e - (p_window - 1))::date, e;
end $function$;

CREATE OR REPLACE FUNCTION public.tasks_stamp_completed()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'done' AND OLD.status = 'done' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.preview_date_cascade(p_project uuid, p_new_start date)
 RETURNS TABLE(task_id uuid, task_name text, old_start date, old_end date, new_start date, new_end date, skipped boolean)
 LANGUAGE sql
 STABLE
 SET search_path = public
AS $function$
  select t.id, t.name, t.start_date, t.end_date, r.start_date, r.end_date, t.date_manual
  from tasks t
  join projects p on p.id = t.project_id
  cross join lateral resolve_task_dates(t.rule, p_new_start, p.project_start, p.project_end, 4) r
  where t.project_id = p_project and t.rule <> 'none'
  order by r.start_date nulls last;
$function$;

CREATE OR REPLACE FUNCTION public.apply_date_cascade(p_project uuid, p_new_start date)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
declare n int;
begin
  update projects set estimated_start = p_new_start where id = p_project;
  with upd as (
    update tasks t set start_date = r.start_date, end_date = r.end_date
    from projects p, lateral resolve_task_dates(t.rule, p_new_start, p.project_start, p.project_end, 4) r
    where t.project_id = p_project and p.id = p_project
      and t.rule <> 'none' and t.date_manual = false
    returning 1)
  select count(*) into n from upd;
  return n;
end $function$;

-- Switch views to security_invoker so they enforce the caller's RLS
ALTER VIEW public.v_project_progress SET (security_invoker = true);
ALTER VIEW public.v_project_hours SET (security_invoker = true);
ALTER VIEW public.v_project_labour_actual SET (security_invoker = true);
ALTER VIEW public.v_stock_leftover SET (security_invoker = true);
ALTER VIEW public.v_project_forecast SET (security_invoker = true);
ALTER VIEW public.v_pending_stock_movements SET (security_invoker = true);
ALTER VIEW public.v_calendar_tasks SET (security_invoker = true);
ALTER VIEW public.v_accessory_pool SET (security_invoker = true);
ALTER VIEW public.v_actual_invoices SET (security_invoker = true);

-- Enable RLS + authenticated-only policy on every listed table
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'accessories','accessory_usage','attachments','calc_cells','comments',
    'employee_rates','invoice_lines','invoices','profiles','project_financials',
    'project_forecast_snapshots','project_templates','projects','scope_breakdown',
    'scope_lines','stock_movements','stock_orders','stock_planning',
    'stock_reconciliation','task_lists','tasks','template_task_lists',
    'template_tasks','time_entries'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon;', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated staff full access" ON public.%I;', t);
    EXECUTE format(
      'CREATE POLICY "Authenticated staff full access" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);',
      t
    );
  END LOOP;
END $$;
