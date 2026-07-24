delete from project_templates where name = 'Standard Install';

with t as (
  insert into project_templates (name, is_default, trigger_condition, active)
  values ('Standard Install', true, 'any deal reaching PO Received (GRN)', true)
  returning id
),
l as (
  insert into template_task_lists (template_id, name, position, scope_inject)
  select t.id, v.name, v.pos, v.inject from t,
    (values ('Site Measure & Walkthrough', 0, false),
            ('Stock & Inventory Prep',     1, false),
            ('Project Management',         2, true),
            ('Admin',                      3, false)) as v(name, pos, inject)
  returning id, name
),
p as (
  select
    (select id from profiles where full_name = 'Krishan')     as krishan,
    (select id from profiles where full_name = 'Mehmet')      as mehmet,
    (select id from profiles where full_name = 'Shania')      as shania,
    (select id from profiles where full_name = 'Asad Afzaal') as asad
),
parents as (
  insert into template_tasks (list_id, name, rule, window_days, assignee_id, calc_table, position)
  select l.id, v.name, v.rule::date_rule, v.win,
         case v.who when 'krishan' then p.krishan when 'mehmet' then p.mehmet
                    when 'shania'  then p.shania  else p.asad end,
         v.calc, v.pos
  from l, p, (values
    ('Site Measure & Walkthrough','Site Measurements',           'project_start_end',    4,  'asad',    null,             0),
    ('Site Measure & Walkthrough','Video Walkthrough',           'none',                 4,  'asad',    null,             1),
    ('Site Measure & Walkthrough','Project Specific Notes',      'none',                 4,  'mehmet',  null,             2),
    ('Stock & Inventory Prep',    'Stock Planning',              'est_start_minus_10w',  4,  'krishan', 'stock_planning', 0),
    ('Stock & Inventory Prep',    'Order Stock',                 'est_start_minus_8w',   4,  'krishan', 'order_stock',    1),
    ('Stock & Inventory Prep',    'Receive Stock',               'est_start_minus_2w',   4,  'asad',    null,             2),
    ('Project Management',        'Progress Photos',             'none',                 4,  'asad',    null,             0),
    ('Project Management',        'Confirm Labour',              'none',                 4,  'mehmet',  'hour_log',       1),
    ('Project Management',        'Accessories Used',            'none',                 4,  'asad',    'accessories',    2),
    ('Project Management',        'Stock Reconciliation',        'none',                 4,  'krishan', 'reconciliation', 3),
    ('Admin',                     'Handover',                    'none',                 4,  'mehmet',  null,             0),
    ('Admin',                     'Confirm Budget & Forecasts',  'none',                 4,  'krishan', null,             1),
    ('Admin',                     'Payment & Actual Results',    'none',                 4,  'krishan', null,             2)
  ) as v(list, name, rule, win, who, calc, pos)
  where l.name = v.list
  returning id, name, list_id
)
insert into template_tasks (list_id, parent_id, name, description, rule, assignee_id, calc_table, position)
select parents.list_id, parents.id, v.name, v.descr, 'none'::date_rule,
       case v.who when 'shania' then p.shania else p.asad end,
       v.calc, v.pos
from parents, p, (values
  ('Site Measurements','Upload Measurements',   'Installer must upload measurements and site photos here.', 'asad',   null,       0),
  ('Site Measurements','Before Video / Photos', 'Upload before video / photos.',                            'asad',   null,       1),
  ('Handover',         'Client Invoice',        'Monthly invoices generate here on the last Monday.',       'shania', 'invoices', 0)
) as v(parent, name, descr, who, calc, pos)
where parents.name = v.parent;