CREATE OR REPLACE FUNCTION pfs_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION
      'project_forecast_snapshots is append-only. To restate a forecast, insert a new row with snapshot_type = ''restated''.';
  END IF;

  -- TG_OP = 'DELETE'
  -- Allow only when the parent project is already gone, i.e. this DELETE is the
  -- ON DELETE CASCADE from removing the project itself. Postgres deletes the
  -- parent row before firing the referential cascade, so a missing parent is a
  -- reliable marker. A direct DELETE finds the project still present and fails.
  IF NOT EXISTS (SELECT 1 FROM projects WHERE id = OLD.project_id) THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION
    'project_forecast_snapshots is append-only. Snapshots are removed only when their project is deleted.';
END;
$$;