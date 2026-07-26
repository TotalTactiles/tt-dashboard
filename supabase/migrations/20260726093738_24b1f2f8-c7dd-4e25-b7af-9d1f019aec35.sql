ALTER TABLE public.stock_planning
  ADD COLUMN IF NOT EXISTS cost_bucket text;

ALTER TABLE public.stock_planning
  DROP CONSTRAINT IF EXISTS stock_planning_source_check;
ALTER TABLE public.stock_planning
  ADD CONSTRAINT stock_planning_source_check
  CHECK (source IS NULL OR source IN ('china','local','john'));

ALTER TABLE public.stock_planning
  DROP CONSTRAINT IF EXISTS stock_planning_bucket_check;
ALTER TABLE public.stock_planning
  ADD CONSTRAINT stock_planning_bucket_check
  CHECK (cost_bucket IS NULL OR cost_bucket IN ('tactile','other'));

ALTER TABLE public.stock_orders
  ADD COLUMN IF NOT EXISTS unit_cost  numeric,
  ADD COLUMN IF NOT EXISTS ordered_at date,
  ADD COLUMN IF NOT EXISTS source     text;

ALTER TABLE public.stock_orders
  DROP CONSTRAINT IF EXISTS stock_orders_source_check;
ALTER TABLE public.stock_orders
  ADD CONSTRAINT stock_orders_source_check
  CHECK (source IS NULL OR source IN ('china','local','john'));

UPDATE public.stock_planning SET cost_bucket = 'tactile' WHERE lower(line_label) LIKE '%tactile%' AND cost_bucket IS NULL;
UPDATE public.stock_planning SET cost_bucket = 'other'   WHERE cost_bucket IS NULL;