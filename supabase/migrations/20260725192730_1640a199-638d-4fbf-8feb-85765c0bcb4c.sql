DO $$
DECLARE
  pid uuid;
  update_blocked boolean;
  delete_blocked boolean;
  cascade_ok boolean;
  final_count integer;
BEGIN
  -- Ensure a clean start if a previous run left anything behind
  DELETE FROM projects WHERE zoho_deal_id = '__pfs_test__';

  -- Setup: throwaway project with a snapshot
  INSERT INTO projects (name, zoho_deal_id)
  VALUES ('__PFS_TRIGGER_TEST__', '__pfs_test__')
  RETURNING id INTO pid;

  INSERT INTO project_forecast_snapshots
    (project_id, snapshot_type, captured_reason, contract_value)
  VALUES (pid, 'original', 'project_created', 4321.00);

  -- 1. UPDATE must FAIL
  BEGIN
    UPDATE project_forecast_snapshots SET contract_value = 1 WHERE project_id = pid;
    update_blocked := false;
  EXCEPTION WHEN OTHERS THEN
    update_blocked := true;
  END;

  IF NOT update_blocked THEN
    RAISE EXCEPTION 'CHECK 1 FAILED: UPDATE unexpectedly succeeded';
  END IF;

  -- 2. Direct DELETE must FAIL
  BEGIN
    DELETE FROM project_forecast_snapshots WHERE project_id = pid;
    delete_blocked := false;
  EXCEPTION WHEN OTHERS THEN
    delete_blocked := true;
  END;

  IF NOT delete_blocked THEN
    RAISE EXCEPTION 'CHECK 2 FAILED: Direct DELETE unexpectedly succeeded';
  END IF;

  -- 3. Cascade DELETE must SUCCEED (the bug being fixed)
  BEGIN
    DELETE FROM projects WHERE id = pid;
    cascade_ok := true;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'CHECK 3 FAILED: Cascade DELETE failed: %', SQLERRM;
  END;

  -- 4. Snapshot must be gone
  SELECT count(*) INTO final_count FROM project_forecast_snapshots WHERE project_id = pid;

  IF final_count <> 0 THEN
    RAISE EXCEPTION 'CHECK 4 FAILED: snapshot count should be 0, got %', final_count;
  END IF;
END $$;