begin;

create type org_type   as enum ('customer','trade_customer','supplier','subcontractor');
create type deal_kind  as enum ('installation','trade_product');
create type deal_stage as enum ('quoted','verbal_confirmation','po_received','completed','lost_dead');

create type lead_stage as enum (
  'new','enriching','ready_to_call','actioned','responded',
  'needs_attention','converted','archived'
);

create or replace function tt_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create table lead_next_steps (
  code           text primary key,
  label          text not null,
  follow_up_days int check (follow_up_days is null or follow_up_days > 0),
  sort_order     int not null default 100,
  is_active      boolean not null default true,
  retired_at     timestamptz,
  created_at     timestamptz not null default now()
);

create table lead_statuses (
  code       text primary key,
  label      text not null,
  zoho_value text,
  sort_order int not null default 100,
  is_active  boolean not null default true,
  retired_at timestamptz,
  created_at timestamptz not null default now()
);

create table lead_rating_bands (
  code       text primary key,
  label      text not null,
  min_score  int  not null check (min_score between 0 and 100),
  max_score  int  not null check (max_score between 0 and 100),
  definition text not null,
  colour     text,
  sort_order int  not null default 100,
  is_active  boolean not null default true,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_rating_bands_range_valid check (max_score >= min_score)
);

alter table lead_rating_bands
  add constraint lead_rating_bands_no_overlap
  exclude using gist ((int4range(min_score, max_score, '[]')) with &&)
  where (is_active);

create table lead_silence_rules (
  code            text primary key,
  label           text not null,
  days_silent_min int  not null check (days_silent_min >= 0),
  penalty_points  int  not null default 0 check (penalty_points between 0 and 100),
  cap_band_code   text references lead_rating_bands(code) on delete restrict,
  action_prompt   text,
  auto_stage      lead_stage,
  sort_order      int  not null default 100,
  is_active       boolean not null default true,
  retired_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index lead_silence_rules_threshold
  on lead_silence_rules (days_silent_min) where is_active;

create table lead_call_outcomes (
  code       text primary key,
  label      text not null,
  is_contact boolean not null default false,
  sort_order int not null default 100,
  is_active  boolean not null default true,
  retired_at timestamptz
);

create table lead_sources (
  code       text primary key,
  label      text not null,
  sort_order int not null default 100,
  is_active  boolean not null default true,
  retired_at timestamptz,
  created_at timestamptz not null default now()
);

create table lead_event_kinds (
  kind       text primary key,
  label      text not null,
  is_metric  boolean not null default false,
  sort_order int not null default 100
);

create table lead_tags (
  tag        text primary key,
  label      text,
  colour     text,
  use_count  int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table organisations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  trading_name        text,
  types               org_type[] not null default '{customer}',
  abn                 text,
  website             text,
  phone               text,
  email               text,
  billing_address     text,
  notes               text,
  zoho_account_id     text unique,
  xero_contact_id     text,
  shopify_customer_id text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index organisations_name_key on organisations (lower(name));
create index organisations_types_idx on organisations using gin (types);

create table contacts (
  id                uuid primary key default gen_random_uuid(),
  organisation_id   uuid not null references organisations(id) on delete cascade,
  first_name        text not null,
  last_name         text,
  role              text,
  email             text,
  phone             text,
  mobile            text,
  is_primary        boolean not null default false,
  notes             text,
  zoho_contact_id   text unique,
  apollo_contact_id text,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index contacts_org_idx on contacts (organisation_id);
create unique index contacts_one_primary_per_org
  on contacts (organisation_id) where is_primary;

create table leads (
  id                    uuid primary key default gen_random_uuid(),
  lead_number           text unique,
  zoho_id               text unique,

  company_builder       text not null,
  organisation_id       uuid references organisations(id) on delete set null,
  project_name          text,
  state                 text,
  site_address          text,
  category              text,

  project_contact_name  text,
  role                  text,
  phone                 text,
  direct_email          text,
  reception_name        text,
  reception_email       text,
  secondary_contact     text,
  secondary_email       text,
  cc_bcc                text,

  stage                 lead_stage not null default 'new',
  next_step_code        text references lead_next_steps(code) on delete restrict,
  status_code           text references lead_statuses(code)   on delete restrict,
  who_spoke_with        text,
  notes                 text,
  follow_up_date        date,
  source                text,
  source_code           text references lead_sources(code) on delete restrict,
  tags                  text[] not null default '{}',

  email_sent_at         timestamptz,
  message_id            text,
  responded_at          timestamptz,

  apollo_contact_id     text,
  apollo_org_id         text,
  enriched_at           timestamptz,
  enrichment_status     text,

  rating_score          int check (rating_score is null or rating_score between 0 and 100),
  rating_band           text references lead_rating_bands(code) on delete restrict,
  rating_reason         text,
  rating_model          text,
  rated_at              timestamptz,
  rating_stale          boolean not null default true,
  rating_stale_since    timestamptz default now(),
  next_best_action      text,

  converted_at            timestamptz,
  converted_to_deal_id    uuid,
  converted_to_org_id     uuid references organisations(id),
  converted_to_contact_id uuid references contacts(id),
  converted_in_zoho_at    timestamptz,
  zoho_converted_deal_id  text,

  zoho_synced_at        timestamptz,
  zoho_sync_status      text,
  zoho_sync_error       text,
  zoho_push_count       int not null default 0,

  claimed_by            text,
  claimed_at            timestamptz,

  archived_at           timestamptz,
  owner_email           text default 'sales@totaltactiles.com.au',
  source_system         text not null default 'sheet',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint leads_project_name_required check (
    stage = 'archived'
    or (project_name is not null and btrim(project_name) <> '')
  )
);

create index leads_stage_idx      on leads (stage);
create index leads_next_step_idx  on leads (next_step_code) where stage = 'actioned';
create index leads_followup_idx   on leads (follow_up_date) where converted_at is null;
create index leads_company_idx    on leads (lower(company_builder));
create index leads_zoho_idx       on leads (zoho_id);
create index leads_source_idx     on leads (source_code);
create index leads_tags_idx       on leads using gin (tags);
create index leads_org_idx        on leads (organisation_id) where organisation_id is not null;
create index leads_rating_idx     on leads (rating_band, rating_score desc)
  where stage not in ('archived','converted');
create index leads_rating_stale_idx on leads (rating_stale_since)
  where rating_stale and stage not in ('archived','converted');
create index leads_claimed_idx on leads (claimed_at) where claimed_by is not null;

create unique index leads_dedupe on leads
  (lower(direct_email), lower(coalesce(project_name,'')))
  where direct_email is not null and stage <> 'archived';

create table deals (
  id                      uuid primary key default gen_random_uuid(),
  deal_number             text unique,
  zoho_id                 text unique,

  name                    text not null,
  organisation_id         uuid references organisations(id),
  primary_contact_id      uuid references contacts(id),
  converted_from_lead_id  uuid references leads(id),
  kind                    deal_kind not null default 'installation',

  stage                   deal_stage not null default 'quoted',
  pipeline                text,
  next_step               text,
  follow_up_date          date,

  contract_value          numeric(12,2) not null default 0,
  original_contract_value numeric(12,2),
  total_costs             numeric(12,2) default 0,
  closing_date            date,

  parent_deal_id          uuid references deals(id),
  root_deal_id            uuid references deals(id),
  stage_number            int,
  is_split_parent         boolean not null default false,
  is_variation            boolean not null default false,
  variation_of_deal_id    uuid references deals(id),

  scope_of_works          text,
  current_inventory       text,

  loss_reason             text,
  loss_notes              text,
  lost_at                 timestamptz,

  project_id              uuid,

  owner_email             text default 'sales@totaltactiles.com.au',
  source_system           text not null default 'zoho',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index deals_stage_idx   on deals (stage);
create index deals_org_idx     on deals (organisation_id);
create index deals_zoho_idx    on deals (zoho_id);
create index deals_project_idx on deals (project_id);

alter table leads
  add constraint leads_converted_to_deal_fkey
  foreign key (converted_to_deal_id) references deals(id);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='projects'
      and column_name='id' and data_type='uuid'
  ) then
    alter table deals add constraint deals_project_id_fkey
      foreign key (project_id) references projects(id);
  else
    raise notice 'projects.id is not uuid or table absent — FK skipped';
  end if;
end $$;

create table deal_stage_history (
  id         bigserial primary key,
  deal_id    uuid not null references deals(id) on delete cascade,
  from_stage deal_stage,
  to_stage   deal_stage not null,
  changed_at timestamptz not null default now(),
  changed_by text,
  note       text
);

create index dsh_deal_idx on deal_stage_history (deal_id, changed_at desc);

create table lead_templates (
  id             uuid primary key default gen_random_uuid(),
  next_step_code text not null references lead_next_steps(code) on delete restrict,
  state          text,
  channel        text not null default 'resend',
  subject        text not null,
  body_html      text not null,
  send_mode      text not null default 'draft',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint lead_templates_send_mode_valid check (send_mode in ('draft','auto_send')),
  constraint lead_templates_channel_valid   check (channel in ('resend','gmail_draft'))
);

create unique index lead_templates_key
  on lead_templates (next_step_code, coalesce(state,'*'), channel) where is_active;

create table lead_events (
  id          bigserial primary key,
  lead_id     uuid not null references leads(id) on delete cascade,
  kind        text not null,
  detail      text,
  external_id text,
  occurred_at timestamptz not null default now(),
  created_by  text
);

create index lead_events_lead_idx on lead_events (lead_id, occurred_at desc);
create unique index lead_events_external_idx on lead_events (external_id)
  where external_id is not null;

create table lead_rating_history (
  id               bigserial primary key,
  lead_id          uuid not null references leads(id) on delete cascade,
  score            int  not null check (score between 0 and 100),
  band             text not null references lead_rating_bands(code) on delete restrict,
  previous_score   int,
  reason           text,
  next_best_action text,
  signals          jsonb,
  model            text,
  triggered_by     text,
  computed_at      timestamptz not null default now()
);

create index lrh_lead_idx    on lead_rating_history (lead_id, computed_at desc);
create index lrh_signals_idx on lead_rating_history using gin (signals);

create table lead_calls (
  id               uuid primary key default gen_random_uuid(),
  lead_id          uuid not null references leads(id) on delete cascade,
  called_at        timestamptz not null default now(),
  duration_seconds int,
  outcome_code     text not null references lead_call_outcomes(code) on delete restrict,
  spoke_with       text,
  notes            text,
  sentiment        text check (sentiment is null or sentiment in ('positive','neutral','negative')),
  created_by       text,
  created_at       timestamptz not null default now()
);

create index lead_calls_lead_idx    on lead_calls (lead_id, called_at desc);
create index lead_calls_outcome_idx on lead_calls (outcome_code);

create table lead_tasks (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid not null references leads(id) on delete cascade,
  title          text not null,
  kind           text not null default 'follow_up'
                   check (kind in ('follow_up','call','email','meeting','other')),
  due_date       date not null,
  status         text not null default 'open'
                   check (status in ('open','done','cancelled')),
  auto_generated boolean not null default false,
  notes          text,
  assigned_to    text,
  completed_at   timestamptz,
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index lead_tasks_lead_idx on lead_tasks (lead_id, due_date);
create index lead_tasks_due_idx  on lead_tasks (due_date) where status = 'open';

create or replace function resolve_rating_band(p_score int)
returns text language sql stable as $$
  select code from lead_rating_bands
   where is_active and p_score between min_score and max_score
   order by sort_order limit 1;
$$;

create or replace function tt_check_band_coverage()
returns trigger language plpgsql as $$
declare v_gaps int;
begin
  select count(*) into v_gaps
    from generate_series(0,100) g
   where not exists (
     select 1 from lead_rating_bands b
      where b.is_active and g between b.min_score and b.max_score
   );
  if v_gaps > 0 then
    raise exception
      'Rating bands must cover every score 0-100. % score(s) uncovered.', v_gaps;
  end if;
  return null;
end $$;

create or replace function tt_log_deal_stage()
returns trigger language plpgsql as $$
begin
  if new.stage is distinct from old.stage then
    insert into deal_stage_history (deal_id, from_stage, to_stage, changed_by)
    values (new.id, old.stage, new.stage, new.owner_email);
  end if;
  return new;
end $$;

create or replace function tt_mark_rating_stale()
returns trigger language plpgsql as $$
begin
  if tg_table_name = 'lead_events' and new.kind in ('rated','zoho_push') then
    return new;
  end if;
  update leads
     set rating_stale = true,
         rating_stale_since = coalesce(rating_stale_since, now())
   where id = new.lead_id
     and stage not in ('archived','converted')
     and rating_stale = false;
  return new;
end $$;

create or replace function tt_create_follow_up_task()
returns trigger language plpgsql as $$
declare v_days int; v_label text;
begin
  if new.next_step_code is null
     or new.next_step_code is not distinct from old.next_step_code then
    return new;
  end if;

  select follow_up_days, label into v_days, v_label
    from lead_next_steps where code = new.next_step_code;

  if v_days is null then return new; end if;

  update lead_tasks set status='cancelled', updated_at=now()
   where lead_id=new.id and status='open' and auto_generated;

  insert into lead_tasks (lead_id, title, kind, due_date, auto_generated, notes)
  values (new.id, 'Follow up — ' || v_label, 'follow_up',
          (now() + (v_days || ' days')::interval)::date, true,
          'Created automatically from next step: ' || v_label);
  return new;
end $$;

create trigger organisations_touch      before update on organisations
  for each row execute function tt_touch_updated_at();
create trigger contacts_touch           before update on contacts
  for each row execute function tt_touch_updated_at();
create trigger leads_touch              before update on leads
  for each row execute function tt_touch_updated_at();
create trigger deals_touch              before update on deals
  for each row execute function tt_touch_updated_at();
create trigger lead_templates_touch     before update on lead_templates
  for each row execute function tt_touch_updated_at();
create trigger lead_tasks_touch         before update on lead_tasks
  for each row execute function tt_touch_updated_at();
create trigger lead_rating_bands_touch  before update on lead_rating_bands
  for each row execute function tt_touch_updated_at();
create trigger lead_silence_rules_touch before update on lead_silence_rules
  for each row execute function tt_touch_updated_at();

create constraint trigger lead_rating_bands_coverage
  after insert or update or delete on lead_rating_bands
  deferrable initially deferred
  for each row execute function tt_check_band_coverage();

create trigger deals_stage_history after update of stage on deals
  for each row execute function tt_log_deal_stage();

create trigger lead_events_mark_stale after insert on lead_events
  for each row execute function tt_mark_rating_stale();
create trigger lead_calls_mark_stale  after insert on lead_calls
  for each row execute function tt_mark_rating_stale();

create trigger leads_auto_follow_up after update of next_step_code on leads
  for each row execute function tt_create_follow_up_task();

insert into lead_next_steps (code, label, follow_up_days, sort_order) values
  ('eoi_sent',                      'EOI Sent',                       60, 10),
  ('ready_to_award',                'READY TO AWARD',                 14, 20),
  ('nry_follow_up_later',           'NRY - Follow Up Later',          90, 30),
  ('already_completed_future_work', 'Already completed - Future work',180, 40);

insert into lead_statuses (code, label, zoho_value, sort_order) values
  ('eoi_sent',            'EOI Sent',              'EOI Sent',              10),
  ('tendering',           'Tendering',             'Tendering',             20),
  ('quoting_opp',         'Quoting Opp',           'Quoting Opp',           30),
  ('follow_up_2',         'Follow Up 2',           'Follow Up 2',           40),
  ('nry_follow_up_later', 'NRY - Follow Up Later', 'NRY - Follow Up Later', 50),
  ('contact_in_future',   'Contact in Future',     'Contact in Future',     60),
  ('completed_by_others', 'Completed by Others',   'Completed by Others',   70);

insert into lead_rating_bands (code,label,min_score,max_score,colour,sort_order,definition) values
  ('cold','Cold', 0,39,'#6B7280',10,
   'No meaningful engagement. Emails delivered but unopened, or opened with no reply. No contact reached by phone, or reception only. No indication the project is live for us. List-building, not pipeline.'),
  ('warm','Warm',40,69,'#E0A13C',20,
   'Some genuine engagement. Opened repeatedly, clicked, or we have spoken to the actual contact. Interest acknowledged but no plans received and no quoting opportunity yet. Continue nurture with scheduled follow-up.'),
  ('hot','Hot',  70,100,'#1FB37E',30,
   'Active opportunity forming. Contact has replied directly, requested information, or indicated a tender or package is coming. Plans expected or received. Should convert to a Job to Win shortly — prioritise.');

insert into lead_silence_rules
  (code,label,days_silent_min,penalty_points,cap_band_code,action_prompt,sort_order) values
  ('quiet_2w','Quiet 2 weeks',14,0,null,
   'No contact in two weeks. Send a follow-up or log a call.',10),
  ('quiet_5w','Quiet 5 weeks',35,0,'warm',
   'No contact in five weeks. Re-engage now or consider marking Lost/Dead.',20),
  ('quiet_10w','Quiet 10 weeks',70,0,'cold',
   'No contact in ten weeks. Likely dead — confirm and archive, or restart the sequence.',30);

insert into lead_call_outcomes (code,label,is_contact,sort_order) values
  ('spoke_contact',     'Spoke to contact',   true, 10),
  ('callback_requested','Callback requested', true, 20),
  ('spoke_gatekeeper',  'Spoke to reception', false,30),
  ('left_message',      'Left message',       false,40),
  ('no_answer',         'No answer',          false,50),
  ('not_interested',    'Not interested',     true, 60),
  ('wrong_number',      'Wrong number',       false,70);

insert into lead_sources (code,label,sort_order) values
  ('cold_call','Cold call list',10),
  ('estimate_one','Estimate One',20),
  ('tender_portal','Tender portal',30),
  ('apartments_com','apartments.com.au',40),
  ('drive_by','Drive-by',50),
  ('inbound_email','Inbound email',60),
  ('referral','Referral',70),
  ('existing_client','Existing client',80);

insert into lead_event_kinds (kind,label,is_metric,sort_order) values
  ('email_scheduled','Email scheduled',true,10),
  ('email_sent','Email sent',true,20),
  ('email_delivered','Email delivered',true,30),
  ('email_opened','Email opened',true,40),
  ('email_clicked','Link clicked',true,50),
  ('email_bounced','Bounced',true,60),
  ('email_complained','Marked as spam',true,70),
  ('replied','Reply received',true,80),
  ('enriched','Apollo enrichment',false,90),
  ('rated','AI rating applied',false,100),
  ('status_changed','Status changed',false,110),
  ('zoho_push','Pushed to Zoho',false,120),
  ('note','Note',false,130),
  ('error','Error',false,140);

create view v_lead_silence as
with activity as (
  select l.id,
    greatest(
      coalesce(l.responded_at,'epoch'::timestamptz),
      coalesce(l.email_sent_at,'epoch'::timestamptz),
      coalesce((select max(e.occurred_at) from lead_events e where e.lead_id=l.id),'epoch'::timestamptz),
      coalesce((select max(c.called_at)   from lead_calls  c where c.lead_id=l.id),'epoch'::timestamptz),
      l.created_at
    ) as last_activity_at
  from leads l
)
select l.id, l.company_builder, l.project_name, l.stage,
       l.rating_score, l.rating_band,
       a.last_activity_at,
       extract(day from now()-a.last_activity_at)::int as days_silent,
       r.code as silence_rule_code, r.label as silence_rule_label,
       r.penalty_points, r.cap_band_code, r.action_prompt, r.auto_stage
from leads l
join activity a on a.id=l.id
left join lateral (
  select * from lead_silence_rules sr
   where sr.is_active
     and extract(day from now()-a.last_activity_at)::int >= sr.days_silent_min
   order by sr.days_silent_min desc limit 1
) r on true
where l.stage not in ('archived','converted');

create view v_lead_metrics as
with ev as (
  select e.lead_id,
    count(*) filter (where e.kind='email_scheduled') as scheduled,
    count(*) filter (where e.kind='email_sent')      as sent,
    count(*) filter (where e.kind='email_delivered') as delivered,
    count(*) filter (where e.kind='email_opened')    as opened,
    count(*) filter (where e.kind='email_clicked')   as clicked,
    count(*) filter (where e.kind='email_bounced')   as bounced,
    count(*) filter (where e.kind='replied')         as replied,
    min(e.occurred_at) filter (where e.kind='email_sent') as first_sent_at,
    max(e.occurred_at) filter (where e.kind='replied')    as last_reply_at
  from lead_events e group by e.lead_id
)
select l.id, l.company_builder, l.project_name, l.state, l.stage,
       l.next_step_code, l.status_code, l.rating_band, l.rating_score,
       l.created_at, l.converted_at,
       coalesce(ev.scheduled,0) as emails_scheduled,
       coalesce(ev.sent,0)      as emails_sent,
       coalesce(ev.delivered,0) as emails_delivered,
       coalesce(ev.opened,0)    as emails_opened,
       coalesce(ev.clicked,0)   as links_clicked,
       coalesce(ev.bounced,0)   as emails_bounced,
       coalesce(ev.replied,0)   as replies,
       ev.first_sent_at, ev.last_reply_at,
       case when ev.first_sent_at is not null and l.converted_at is not null
            then extract(day from l.converted_at-ev.first_sent_at)::int end as days_to_convert
from leads l left join ev on ev.lead_id=l.id;

create view v_lead_funnel_summary as
select
  count(*)                                          as total_leads,
  count(*) filter (where stage='ready_to_call')     as awaiting_call,
  count(*) filter (where stage='actioned')          as actioned,
  count(*) filter (where stage='responded')         as responded,
  count(*) filter (where stage='converted')         as converted,
  count(*) filter (where stage='needs_attention')   as needs_attention,
  count(*) filter (where rating_band='hot')         as hot,
  count(*) filter (where rating_band='warm')        as warm,
  sum(emails_sent)   as emails_sent,
  sum(emails_opened) as emails_opened,
  sum(replies)       as replies,
  round(100.0*nullif(sum(emails_opened),0)/nullif(sum(emails_delivered),0),1) as open_rate_pct,
  round(100.0*nullif(sum(replies),0)/nullif(sum(emails_sent),0),1)            as reply_rate_pct,
  round(100.0*count(*) filter (where stage='converted')
        /nullif(count(*) filter (where stage<>'archived'),0),1)               as conversion_rate_pct
from v_lead_metrics where stage<>'archived';

create view v_leads_needing_rating as
select l.id, l.company_builder, l.organisation_id, l.project_name, l.state, l.stage,
       l.rating_score as current_score, l.rating_band as current_band,
       l.rated_at, l.rating_stale_since,
       (select count(*) from lead_events e where e.lead_id=l.id) as event_count,
       (select count(*) from lead_calls  c where c.lead_id=l.id) as call_count,
       (select max(e.occurred_at) from lead_events e where e.lead_id=l.id) as last_activity_at
from leads l
where l.rating_stale and l.stage not in ('archived','converted')
order by l.rating_stale_since;

create view v_company_history as
select coalesce(o.name,l.company_builder) as company, l.organisation_id,
       count(*) as total_leads,
       count(*) filter (where l.stage='converted') as converted,
       count(*) filter (where l.stage='archived')  as archived,
       count(*) filter (where l.responded_at is not null) as ever_responded,
       round(100.0*count(*) filter (where l.responded_at is not null)/nullif(count(*),0),1) as response_rate_pct,
       round(100.0*count(*) filter (where l.stage='converted')/nullif(count(*),0),1) as conversion_rate_pct,
       min(l.created_at) as first_contacted,
       max(l.created_at) as last_contacted
from leads l left join organisations o on o.id=l.organisation_id
group by coalesce(o.name,l.company_builder), l.organisation_id;

create view v_lead_rating_trend as
select h.lead_id, l.company_builder, l.project_name, h.score, h.band,
       h.previous_score, h.score-coalesce(h.previous_score,h.score) as delta,
       h.reason, h.next_best_action, h.triggered_by, h.computed_at,
       row_number() over (partition by h.lead_id order by h.computed_at desc) as recency
from lead_rating_history h join leads l on l.id=h.lead_id;

create view v_lead_tasks_due as
select t.id, t.lead_id, l.company_builder, l.project_name, l.state,
       l.rating_band, l.rating_score, t.title, t.kind, t.due_date,
       (t.due_date-current_date) as days_until_due, t.auto_generated, t.assigned_to
from lead_tasks t join leads l on l.id=t.lead_id
where t.status='open' and l.stage not in ('archived','converted')
order by t.due_date, l.rating_score desc nulls last;

create view v_leads_unroutable as
select l.id, l.company_builder, l.project_name, l.state,
       l.next_step_code, l.stage, l.updated_at
from leads l
where l.stage='actioned'
  and not exists (
    select 1 from lead_templates t
     where t.is_active and t.next_step_code=l.next_step_code
       and (t.state is null or t.state=l.state)
  );

create view v_leads_zoho_pending as
select l.id, l.zoho_id, l.company_builder, l.project_name, l.project_contact_name,
       l.state, l.next_step_code, l.status_code, l.rating_band,
       l.updated_at, l.zoho_synced_at, l.zoho_sync_status, l.zoho_sync_error,
       case when l.zoho_id is null then 'create' else 'update' end as push_mode,
       (l.project_name is null or btrim(l.project_name)='') as blocked_no_project_name
from leads l
where l.stage not in ('archived','converted')
  and (l.zoho_synced_at is null or l.updated_at > l.zoho_synced_at);

create or replace function tt_mark_silent_leads_stale()
returns int language plpgsql as $$
declare v_count int;
begin
  update leads l set rating_stale=true,
         rating_stale_since=coalesce(l.rating_stale_since,now())
    from v_lead_silence s
   where s.id=l.id and s.silence_rule_code is not null and l.rating_stale=false;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

grant select, insert, update on
  organisations, contacts, leads, deals, deal_stage_history,
  lead_next_steps, lead_statuses, lead_rating_bands, lead_silence_rules,
  lead_call_outcomes, lead_sources, lead_event_kinds, lead_tags,
  lead_templates, lead_events, lead_rating_history, lead_calls, lead_tasks
to anon;

grant select on
  v_lead_silence, v_lead_metrics, v_lead_funnel_summary,
  v_leads_needing_rating, v_company_history, v_lead_rating_trend,
  v_lead_tasks_due, v_leads_unroutable, v_leads_zoho_pending
to anon;

grant execute on function resolve_rating_band(int) to anon;
grant execute on function tt_mark_silent_leads_stale() to anon;
grant usage, select on all sequences in schema public to anon;

commit;