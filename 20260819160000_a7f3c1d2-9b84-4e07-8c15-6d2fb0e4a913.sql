-- 20260819160000_a7f3c1d2-9b84-4e07-8c15-6d2fb0e4a913.sql
--
-- Punch 391, oven-rename-lead-generation. Session 085.
--
-- WHY THIS FILE EXISTS.
-- The rename was applied directly to the live database at session 084 as a single
-- verified transaction. supabase/migrations/ is append-only history and its 25
-- existing files still describe the pre-rename names, so an environment rebuilt
-- from migrations alone would produce v_oven_* objects and disagree with live.
-- This file closes that gap. It edits no existing migration.
--
-- IDEMPOTENT BY CONSTRUCTION.
-- Every statement is guarded on the OLD name still existing, so this file is a
-- no-op against the live database (already renamed) and effective against any
-- environment built from the prior 25 files. It is safe to run twice, which is
-- CLAUDE-RULES 4b.3.
--
-- COUNTS, derived live at S085 rather than carried from a document:
--   10 views, 2 tables, 4 functions, 5 distinct index and constraint names,
--   2 tag literals. The seven "index and constraint" catalogue rows are five
--   names, because each _pkey appears once as a constraint and once as its
--   backing index.
--
-- NOT INCLUDED, deliberately:
--   tt_is_placeholder_project, whose only Oven reference is a punch citation in
--   a comment and which carries no functional reference.

begin;

-- ---------------------------------------------------------------- 1. VIEWS. 10.
do $$
declare v text;
begin
  foreach v in array array[
    'call_queue', 'call_queue_base', 'leads', 'new_leads', 'new_leads_base',
    'responded', 'responded_base', 'test_call_queue', 'test_leads', 'test_responded'
  ] loop
    if exists (
      select 1 from information_schema.views
      where table_schema = 'public' and table_name = 'v_oven_' || v
    ) then
      execute format('alter view public.%I rename to %I', 'v_oven_' || v, 'v_leadgen_' || v);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------- 2. TABLES. 2.
do $$
declare t text;
begin
  foreach t in array array['test_cases', 'test_restore'] loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
        and table_name = 'oven_' || t
    ) then
      execute format('alter table public.%I rename to %I', 'oven_' || t, 'leadgen_' || t);
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------- 3. FUNCTIONS. 4.
-- Renamed by oid so the argument list never has to be reproduced. A wrong
-- signature on ALTER FUNCTION creates nothing and fails loudly, but reproducing
-- one by hand is the transcription risk this loop removes.
do $$
declare r record;
begin
  for r in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'tt_oven_test_borrow', 'tt_oven_test_forget_draft',
        'tt_oven_test_reset',  'tt_oven_test_return'
      )
  loop
    execute format(
      'alter function %s rename to %I',
      r.oid::regprocedure,
      replace(r.proname, 'tt_oven_', 'tt_leadgen_')
    );
  end loop;
end $$;

-- ------------------------------------- 4. INDEX AND CONSTRAINT RESIDUE. 5 names.
-- ALTER TABLE ... RENAME TO does NOT rename the table's own indexes or
-- constraints. These were left behind by step 2 and were not in the S083 scope
-- of 16; they were found at the S084 inventory.
do $$
declare
  old_name text;
  new_name text;
begin
  foreach old_name in array array[
    'oven_test_cases_pkey',
    'oven_test_cases_lead_id_fkey',
    'oven_test_cases_number_uidx',
    'oven_test_restore_pkey',
    'oven_test_restore_lead_id_fkey'
  ] loop
    new_name := replace(old_name, 'oven_', 'leadgen_');

    if exists (
      select 1 from pg_constraint c
      join pg_namespace n on n.oid = c.connamespace
      where n.nspname = 'public' and c.conname = old_name
    ) then
      execute format(
        'alter table public.%I rename constraint %I to %I',
        case when old_name like 'oven_test_cases%'
             then 'leadgen_test_cases' else 'leadgen_test_restore' end,
        old_name, new_name
      );

    elsif exists (
      select 1 from pg_class i
      join pg_namespace n on n.oid = i.relnamespace
      where n.nspname = 'public' and i.relname = old_name and i.relkind = 'i'
    ) then
      execute format('alter index public.%I rename to %I', old_name, new_name);
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------ 5. TAG LITERALS. 2.
-- leads.tags is a text[]. array_replace rewrites only the matching element and
-- leaves every other tag on the row untouched.
--
-- THE TAG IS LOAD BEARING IN BOTH DIRECTIONS, LEADPROFILE-RULES PART FIVE,
-- twenty-fourth prohibition: it is the only term holding ten real builders out
-- of the operator call queues. This statement changes the LITERAL only. It does
-- not add or remove the tag from any row, so no lead moves in or out of a queue.
update public.leads
   set tags = array_replace(tags, 'oven_test', 'leadgen_test')
 where 'oven_test' = any (tags);

update public.leads
   set tags = array_replace(tags, 'oven_clone', 'leadgen_clone')
 where 'oven_clone' = any (tags);

commit;

-- ------------------------------------------------------------------ VERIFICATION
-- Run SEPARATELY, never in the same statement as the writes above. Punch 308:
-- a verification sharing a statement with its write reads the pre-write snapshot
-- and reports a change that has not landed.
--
--   select table_name from information_schema.views
--    where table_schema = 'public' and table_name like 'v_oven%';        -- 0 rows
--
--   select count(*) from public.leads where 'oven_test'  = any (tags);   -- 0
--   select count(*) from public.leads where 'oven_clone' = any (tags);   -- 0
--   select count(*) from public.leads where 'leadgen_test'  = any (tags); -- 11
--   select count(*) from public.leads where 'leadgen_clone' = any (tags); -- 1
--
-- AND THE BEHAVIOUR CHECK, which is the one that actually proves the rename was
-- a pure rename. These four held identical across S084 and S085:
--
--   v_leadgen_call_queue 330, v_leadgen_new_leads 129,
--   v_leadgen_responded 8,    v_leadgen_test_responded 0.
--
-- Had the tag literals and the view bodies fallen out of step, the call queue
-- would have read 334 and new leads 136.
