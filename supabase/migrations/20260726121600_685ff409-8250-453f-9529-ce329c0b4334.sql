-- Add only genuinely missing columns.
-- amount    -> use existing invoices.total
-- status    -> use existing invoice_status enum (draft/sent/paid) — 'void' not in enum, exclusion is a no-op
-- xero_invoice_id -> already exists
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS invoice_date   date,
  ADD COLUMN IF NOT EXISTS paid_date      date,
  ADD COLUMN IF NOT EXISTS part_number    integer;

-- Skip status CHECK constraint: status is an enum, values are already constrained.

CREATE OR REPLACE VIEW public.v_actual_invoices AS
SELECT
  p.zoho_deal_id   AS zoho_deal_id,
  i.invoice_date   AS invoice_date,
  i.total          AS amount,
  i.invoice_number AS invoice_number,
  i.paid_date      AS paid_date,
  i.status::text   AS status,
  i.part_number    AS part_number,
  i.project_id     AS project_id
FROM   public.invoices i
JOIN   public.projects p ON p.id = i.project_id
WHERE  p.zoho_deal_id IS NOT NULL
  AND  i.invoice_date IS NOT NULL
  AND  i.total IS NOT NULL
  AND  i.total <> 0
  AND  i.status::text NOT IN ('draft','void');

GRANT SELECT ON public.v_actual_invoices TO authenticated, service_role;