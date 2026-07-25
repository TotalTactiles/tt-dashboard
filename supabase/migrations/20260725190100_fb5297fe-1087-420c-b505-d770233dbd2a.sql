
DROP TRIGGER IF EXISTS pfs_no_update ON public.project_forecast_snapshots;
DELETE FROM public.project_forecast_snapshots WHERE contract_value = 1234.56;
CREATE TRIGGER pfs_no_update
  BEFORE UPDATE OR DELETE ON public.project_forecast_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.pfs_block_mutation();
