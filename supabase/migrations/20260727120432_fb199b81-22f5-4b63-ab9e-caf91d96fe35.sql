ALTER TABLE public.stock_orders
  ADD COLUMN IF NOT EXISTS deposit_date   date,
  ADD COLUMN IF NOT EXISTS remainder_date date;