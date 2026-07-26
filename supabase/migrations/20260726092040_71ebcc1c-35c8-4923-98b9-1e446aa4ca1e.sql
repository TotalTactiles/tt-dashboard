
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  product_code  text NOT NULL,
  delta         numeric NOT NULL,
  reason        text NOT NULL,
  source_table  text,
  source_id     uuid,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  posted_at     timestamptz,
  post_error    text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;

CREATE INDEX IF NOT EXISTS stock_movements_unposted
  ON public.stock_movements (created_at) WHERE posted_at IS NULL;

CREATE INDEX IF NOT EXISTS stock_movements_code
  ON public.stock_movements (product_code);

CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_source_unique
  ON public.stock_movements (source_table, source_id, reason)
  WHERE source_id IS NOT NULL AND reason = 'reconciliation_returned';

CREATE OR REPLACE VIEW public.v_pending_stock_movements AS
SELECT
  upper(trim(product_code)) AS product_code,
  SUM(delta)                AS net_delta,
  count(*)                  AS movement_count,
  array_agg(id)             AS movement_ids
FROM   public.stock_movements
WHERE  posted_at IS NULL
GROUP  BY upper(trim(product_code));

GRANT SELECT ON public.v_pending_stock_movements TO authenticated, service_role;

-- A3a: leftover reconciliation returns
CREATE OR REPLACE FUNCTION public.sm_reconciliation_return()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  leftover numeric;
BEGIN
  IF NEW.returned_to_stock IS TRUE
     AND (OLD.returned_to_stock IS DISTINCT FROM TRUE) THEN

    leftover := COALESCE(NEW.planned_qty, 0) - COALESCE(NEW.used_qty, 0);

    IF leftover > 0 AND NEW.product_code IS NOT NULL THEN
      INSERT INTO public.stock_movements
        (project_id, product_code, delta, reason, source_table, source_id, note)
      VALUES
        (NEW.project_id, NEW.product_code, leftover, 'reconciliation_returned',
         'stock_reconciliation', NEW.id,
         'planned ' || COALESCE(NEW.planned_qty,0) || ' less used ' || COALESCE(NEW.used_qty,0))
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sm_reconciliation_return ON public.stock_reconciliation;
CREATE TRIGGER trg_sm_reconciliation_return
  AFTER UPDATE ON public.stock_reconciliation
  FOR EACH ROW EXECUTE FUNCTION public.sm_reconciliation_return();

-- A3b: accessory usage draws down shared pool (delta, not absolute)
CREATE OR REPLACE FUNCTION public.sm_accessory_usage()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  d    numeric;
  src  uuid;
  proj uuid;
  code text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    d := -COALESCE(NEW.qty_used, 0);
    src := NEW.id; proj := NEW.project_id; code := NEW.accessory_code;

  ELSIF TG_OP = 'UPDATE' THEN
    d := -(COALESCE(NEW.qty_used, 0) - COALESCE(OLD.qty_used, 0));
    src := NEW.id; proj := NEW.project_id; code := NEW.accessory_code;

  ELSE
    d := COALESCE(OLD.qty_used, 0);
    src := OLD.id; proj := OLD.project_id; code := OLD.accessory_code;
  END IF;

  IF d <> 0 AND code IS NOT NULL THEN
    INSERT INTO public.stock_movements
      (project_id, product_code, delta, reason, source_table, source_id, note)
    VALUES
      (proj, code, d, 'accessory_usage', 'accessory_usage', src,
       TG_OP || ' qty_used ' || COALESCE(OLD.qty_used, 0) || ' -> ' || COALESCE(NEW.qty_used, 0));
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sm_accessory_usage ON public.accessory_usage;
CREATE TRIGGER trg_sm_accessory_usage
  AFTER INSERT OR UPDATE OF qty_used OR DELETE ON public.accessory_usage
  FOR EACH ROW EXECUTE FUNCTION public.sm_accessory_usage();
