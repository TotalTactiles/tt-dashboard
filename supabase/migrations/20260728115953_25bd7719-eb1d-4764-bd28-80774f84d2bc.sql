do $$
declare
  t text;
  pm_tables text[] := array[
    'accessories','accessory_usage','attachments','calc_cells','comments',
    'employee_rates','invoice_lines','invoices','project_financials',
    'project_forecast_snapshots','project_templates','projects',
    'scope_breakdown','scope_lines','stock_movements','stock_orders',
    'stock_planning','stock_reconciliation','task_lists','tasks',
    'template_task_lists','template_tasks','time_entries'
  ];
begin
  foreach t in array pm_tables loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('grant select, insert, update on public.%I to anon', t);

      if not exists (
        select 1 from pg_policies
        where schemaname='public' and tablename=t and policyname='automation_read'
      ) then
        execute format(
          'create policy automation_read on public.%I for select to anon using (true)', t);
      end if;

      if not exists (
        select 1 from pg_policies
        where schemaname='public' and tablename=t and policyname='automation_insert'
      ) then
        execute format(
          'create policy automation_insert on public.%I for insert to anon with check (true)', t);
      end if;

      if not exists (
        select 1 from pg_policies
        where schemaname='public' and tablename=t and policyname='automation_update'
      ) then
        execute format(
          'create policy automation_update on public.%I for update to anon using (true) with check (true)', t);
      end if;
    else
      raise notice 'table % not found, skipped', t;
    end if;
  end loop;
end $$;

grant usage, select on all sequences in schema public to anon;