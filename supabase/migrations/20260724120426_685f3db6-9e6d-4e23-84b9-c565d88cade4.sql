create extension if not exists "uuid-ossp";

-- ── 1. PEOPLE ────────────────────────────────────────────────────
create type user_role as enum ('office','worker');

create table profiles (
  id         uuid primary key default uuid_generate_v4(),
  full_name  text not null,
  email      text unique,
  role       user_role not null default 'worker',
  initials   text,
  colour     text default '#3D89DA',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

insert into profiles (full_name, role, initials, colour) values
  ('Krishan',      'office', 'K', '#3D89DA'),
  ('Mehmet',       'office', 'M', '#7C5BC7'),
  ('Shania',       'office', 'S', '#2A9D8F'),
  ('Asad Afzaal',  'worker', 'A', '#BA7517'),
  ('Abdul',        'worker', 'A', '#C0703A');

create table employee_rates (
  user_id        uuid primary key references profiles(id) on delete cascade,
  hourly_rate    numeric(10,2) not null,
  effective_from date not null default current_date,
  updated_at     timestamptz not null default now()
);

-- ── 2. TEMPLATES ─────────────────────────────────────────────────
create type date_rule as enum (
  'none','project_start_end','est_start',
  'est_start_minus_10w','est_start_minus_8w','est_start_minus_6w',
  'est_start_minus_2w','est_start_plus_10d'
);

create table project_templates (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  is_default        boolean not null default false,
  trigger_condition text,
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);

create table template_task_lists (
  id           uuid primary key default uuid_generate_v4(),
  template_id  uuid not null references project_templates on delete cascade,
  name         text not null,
  position     int not null default 0,
  scope_inject boolean not null default false
);

create table template_tasks (
  id          uuid primary key default uuid_generate_v4(),
  list_id     uuid not null references template_task_lists on delete cascade,
  parent_id   uuid references template_tasks on delete cascade,
  name        text not null,
  description text,
  rule        date_rule not null default 'none',
  window_days int default 4,
  assignee_id uuid references profiles(id),
  calc_table  text,
  position    int not null default 0
);

-- ── 3. PROJECTS & TASKS ──────────────────────────────────────────
create type project_status as enum ('active','awaiting_signoff','completed','cancelled');
create type task_status    as enum ('open','done');

create table projects (
  id                 uuid primary key default uuid_generate_v4(),
  zoho_deal_id       text unique not null,
  name               text not null,
  client_name        text,
  contact_name       text,
  contact_phone      text,
  site_address       text,
  quote_number       text,
  description        text,
  estimated_start    date,
  project_start      date,
  project_end        date,
  template_id        uuid references project_templates(id),
  status             project_status not null default 'active',
  onedrive_folder_id text,
  signed_off_by      uuid references profiles(id),
  signed_off_at      timestamptz,
  created_at         timestamptz not null default now()
);

create table project_financials (
  project_id     uuid primary key references projects on delete cascade,
  contract_value numeric(12,2),
  total_costs    numeric(12,2),
  updated_at     timestamptz not null default now()
);

create table task_lists (
  id         uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects on delete cascade,
  name       text not null,
  position   int not null default 0
);

create table tasks (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid not null references projects on delete cascade,
  list_id      uuid not null references task_lists on delete cascade,
  parent_id    uuid references tasks on delete cascade,
  name         text not null,
  description  text,
  product_code text,
  assignee_id  uuid references profiles(id),
  start_date   date,
  end_date     date,
  rule         date_rule not null default 'none',
  date_manual  boolean not null default false,
  calc_table   text,
  status       task_status not null default 'open',
  position     int not null default 0,
  office_only  boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references profiles(id),
  created_at   timestamptz not null default now()
);
create index on tasks (project_id, list_id, position);
create index on tasks (project_id) where start_date is not null;

-- ── 4. SCOPE ─────────────────────────────────────────────────────
create table scope_lines (
  id               uuid primary key default uuid_generate_v4(),
  project_id       uuid not null references projects on delete cascade,
  task_id          uuid references tasks on delete cascade,
  product_code     text not null,
  location_context text,
  task_name        text,
  total_quantity   numeric(12,3) not null default 0,
  unit             text not null default 'sqm'
);

create table scope_breakdown (
  id            uuid primary key default uuid_generate_v4(),
  scope_line_id uuid not null references scope_lines on delete cascade,
  area          text not null,
  sub_qty       numeric(12,3) not null default 0,
  formula       text,
  used_qty      numeric(12,3),
  updated_by    uuid references profiles(id),
  updated_at    timestamptz
);

-- ── 5. STOCK ─────────────────────────────────────────────────────
create table stock_planning (
  id         uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects on delete cascade,
  line_label text not null,
  amount     numeric(12,2),
  source     text
);

create table stock_orders (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid not null references projects on delete cascade,
  product_code text not null,
  description  text,
  qty_needed   numeric(12,3) not null default 0,
  qty_ordered  numeric(12,3),
  unit         text
);

create table stock_reconciliation (
  id                uuid primary key default uuid_generate_v4(),
  project_id        uuid not null references projects on delete cascade,
  product_code      text not null,
  description       text,
  unit              text,
  planned_qty       numeric(12,3) not null default 0,
  used_qty          numeric(12,3),
  returned_to_stock boolean not null default false,
  returned_at       timestamptz,
  unique (project_id, product_code)
);

create table accessories (
  code          text primary key,
  description   text not null,
  stock_on_hand numeric(12,2) not null default 0,
  reorder_level numeric(12,2) not null default 2,
  active        boolean not null default true
);

insert into accessories (code, description, stock_on_hand) values
 ('ACC-ADH-SS',   'Adhesive Simseal 600mm Sausages',    0),
 ('ACC-ADH-FE',   'Adhesive Fischer Epoxy Tube 300mm',  0),
 ('ACC-DB-8MMH',  'Drill Bit 8mm Hammer',               0),
 ('ACC-DB-65MMH', 'Drill Bit 6.5mm Hammer',             0),
 ('ACC-DB-8MMT',  'Drill Bit 8mm Timber',               0),
 ('ACC-DB-8MMD',  'Drill Bit 8mm Diamond',              0),
 ('ACC-TOOL-CM',  'Tool Coring Machine',                0),
 ('ACC-TOOL-HD',  'Tool Hammer Drill',                  0),
 ('ACC-TOOL-WD',  'Tool Wireless Drill',                0),
 ('ACC-TMPL',     '600x1200mm Templates',               0);

create table accessory_usage (
  id             uuid primary key default uuid_generate_v4(),
  project_id     uuid not null references projects on delete cascade,
  accessory_code text not null references accessories(code),
  qty_used       numeric(12,2) not null default 0,
  recorded_by    uuid references profiles(id),
  updated_at     timestamptz not null default now(),
  unique (project_id, accessory_code)
);

create or replace view v_accessory_pool as
select
  a.code, a.description, a.stock_on_hand, a.reorder_level,
  p.id as project_id,
  coalesce(mine.qty_used, 0) as used_here,
  coalesce(others.qty, 0)    as other_projects,
  a.stock_on_hand - coalesce(others.qty,0) - coalesce(mine.qty_used,0) as remaining
from accessories a
cross join projects p
left join accessory_usage mine
  on mine.accessory_code = a.code and mine.project_id = p.id
left join lateral (
  select sum(au.qty_used) as qty
  from accessory_usage au
  join projects p2 on p2.id = au.project_id
  where au.accessory_code = a.code
    and au.project_id <> p.id
    and p2.status = 'active'
) others on true
where p.status = 'active' and a.active;

-- ── 6. TIME ──────────────────────────────────────────────────────
create table time_entries (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references projects on delete cascade,
  user_id     uuid not null references profiles(id),
  work_date   date not null,
  hours       numeric(5,2) not null check (hours >= 0 and hours <= 24),
  note        text,
  billable    boolean not null default true,
  invoiced_on uuid,
  created_at  timestamptz not null default now()
);
create index on time_entries (project_id, work_date);
create index on time_entries (user_id, work_date);

-- ── 7. COMMENTS & FILES ──────────────────────────────────────────
create table comments (
  id         uuid primary key default uuid_generate_v4(),
  task_id    uuid not null references tasks on delete cascade,
  user_id    uuid not null references profiles(id),
  body       text not null,
  mentions   uuid[] default '{}',
  created_at timestamptz not null default now()
);

create table attachments (
  id               uuid primary key default uuid_generate_v4(),
  task_id          uuid references tasks on delete cascade,
  comment_id       uuid references comments on delete cascade,
  onedrive_item_id text not null,
  onedrive_web_url text,
  file_name        text not null,
  size_bytes       bigint,
  mime_type        text,
  uploaded_by      uuid references profiles(id),
  uploaded_at      timestamptz not null default now()
);

-- ── 8. INVOICES ──────────────────────────────────────────────────
create type invoice_status as enum ('draft','sent','paid');

create table invoices (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references projects on delete cascade,
  task_id         uuid references tasks(id),
  period_start    date not null,
  period_end      date not null,
  status          invoice_status not null default 'draft',
  subtotal        numeric(12,2) not null default 0,
  gst             numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  xero_invoice_id text,
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);

create table invoice_lines (
  id           uuid primary key default uuid_generate_v4(),
  invoice_id   uuid not null references invoices on delete cascade,
  kind         text not null check (kind in ('scope','labour')),
  product_code text,
  location     text,
  worker_id    uuid references profiles(id),
  qty          numeric(12,3) not null default 0,
  rate         numeric(10,2) not null default 0,
  amount       numeric(12,2) not null default 0,
  breakdown_id uuid references scope_breakdown(id)
);
create unique index on invoice_lines (breakdown_id) where breakdown_id is not null;

-- ── 9. CALC CELLS ────────────────────────────────────────────────
create table calc_cells (
  id             uuid primary key default uuid_generate_v4(),
  task_id        uuid not null references tasks on delete cascade,
  table_key      text not null,
  row_key        text not null,
  col_key        text not null,
  formula        text,
  computed_value numeric(14,4),
  updated_at     timestamptz not null default now(),
  unique (task_id, table_key, row_key, col_key)
);

-- ── 10. DATE CASCADE + VIEWS ─────────────────────────────────────
create or replace function resolve_task_dates(
  p_rule date_rule, p_est_start date, p_proj_start date, p_proj_end date, p_window int default 4
) returns table (start_date date, end_date date)
language plpgsql immutable as $$
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
end $$;

create or replace function preview_date_cascade(p_project uuid, p_new_start date)
returns table (task_id uuid, task_name text, old_start date, old_end date,
               new_start date, new_end date, skipped boolean)
language sql stable as $$
  select t.id, t.name, t.start_date, t.end_date, r.start_date, r.end_date, t.date_manual
  from tasks t
  join projects p on p.id = t.project_id
  cross join lateral resolve_task_dates(t.rule, p_new_start, p.project_start, p.project_end, 4) r
  where t.project_id = p_project and t.rule <> 'none'
  order by r.start_date nulls last;
$$;

create or replace function apply_date_cascade(p_project uuid, p_new_start date)
returns int language plpgsql as $$
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
end $$;

create or replace view v_calendar_tasks as
select t.id, t.project_id, p.name as project_name, t.name as task_name,
       t.start_date, t.end_date, t.assignee_id, t.status
from tasks t join projects p on p.id = t.project_id
where t.start_date is not null and p.status <> 'cancelled';

create or replace view v_project_progress as
select p.id as project_id,
       count(t.*) filter (where not t.office_only) as total_tasks,
       count(t.*) filter (where t.status = 'done')  as done_tasks,
       round(100.0 * count(t.*) filter (where t.status='done')
             / nullif(count(t.*),0)) as pct
from projects p left join tasks t on t.project_id = p.id
group by p.id;

create or replace view v_project_hours as
select project_id,
       sum(hours)                         as total_hours,
       sum(hours) filter (where billable) as billable_hours
from time_entries group by project_id;

create or replace view v_stock_leftover as
select project_id, product_code, description, unit,
       planned_qty, used_qty,
       planned_qty - coalesce(used_qty,0) as leftover,
       returned_to_stock
from stock_reconciliation;

-- ── GRANTS (single-user, no auth — anon key needs full access) ───
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public grant all on tables to service_role;