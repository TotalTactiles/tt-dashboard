ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS completed_at     date,
  ADD COLUMN IF NOT EXISTS completion_notes text;