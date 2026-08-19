import { supabase } from "@/integrations/supabase/client";

/**
 * The single switch for the project delete feature. Set true in P014: the
 * control is live and the delete runs against production data. Set it back to
 * false to disable the feature without removing any code.
 */
export const PROJECT_DELETE_ENABLED = true;

export interface DeleteProjectCounts {
  tasks: number | null;
  task_lists: number | null;
  scope_lines: number | null;
  scope_breakdown: number | null;
  stock_orders: number | null;
  stock_planning: number | null;
  stock_reconciliation: number | null;
  project_financials: number | null;
  project_forecast_snapshots: number | null;
  time_entries: number | null;
  attachments: number | null;
  calc_cells: number | null;
  accessory_usage: number | null;
  invoice_lines: number | null;
  comments: number | null;
  invoices: number | null;
}

export interface DeleteProjectDryRun {
  ok: boolean;
  dry_run: true;
  rows_to_delete: number;
  stock_movements_orphaned: number;
  project: {
    id: string;
    name: string;
    client_name: string | null;
    quote_number: string | null;
    zoho_deal_id: string | null;
    onedrive_folder_id: string | null;
  };
  blockers: {
    blocked: boolean;
    deals_referencing_project: number | null;
    foreign_invoices_on_our_tasks: number | null;
    foreign_invoice_lines_on_our_breakdowns: number | null;
  };
  collateral: {
    scope_lines_of_other_projects_removed_via_our_tasks: number | null;
  };
  counts: DeleteProjectCounts;
}

export interface DeleteProjectDeleted {
  ok: boolean;
  dry_run: false;
  project_id: string;
  project_name: string;
  tombstone_id: string | null;
  rows_deleted: number;
  stock_movements_orphaned: number;
  onedrive_folder_id_preserved: string | null;
  counts: DeleteProjectCounts;
  collateral: {
    scope_lines_of_other_projects_removed_via_our_tasks: number | null;
  };
  /** The real branch does not send blockers. */
  blockers?: undefined;
}

export type DeleteProjectResult = DeleteProjectDryRun | DeleteProjectDeleted;

/** counts.comments and counts.invoices come back null when empty. null means zero. */
export function n(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export type DeleteProjectOutcome<T extends DeleteProjectResult = DeleteProjectResult> =
  | { kind: "ok"; data: T }
  | { kind: "blocked"; data: DeleteProjectDryRun }
  | { kind: "error"; message: string; data: DeleteProjectResult | null };

export async function callDeleteProject(args: {
  projectId: string;
  dryRun: true;
  reason: string;
  by: string;
}): Promise<DeleteProjectOutcome<DeleteProjectDryRun>>;
export async function callDeleteProject(args: {
  projectId: string;
  dryRun: false;
  reason: string;
  by: string;
}): Promise<DeleteProjectOutcome<DeleteProjectDeleted>>;
export async function callDeleteProject(args: {
  projectId: string;
  dryRun: boolean;
  reason: string;
  by: string;
}): Promise<DeleteProjectOutcome> {
  if (!PROJECT_DELETE_ENABLED) {
    return { kind: "error", message: "Project delete is not enabled.", data: null };
  }

  const { data, error } = await (supabase as any).rpc("delete_project", {
    p_project_id: args.projectId,
    p_dry_run: args.dryRun,
    p_reason: args.reason,
    p_by: args.by,
  });

  if (error) {
    return { kind: "error", message: error.message ?? "The delete call failed.", data: null };
  }

  const result = (data ?? null) as DeleteProjectResult | null;
  if (!result || typeof result !== "object") {
    return { kind: "error", message: "The delete function returned no result.", data: null };
  }
  if (result.blockers?.blocked === true) {
    return { kind: "blocked", data: result as DeleteProjectDryRun };
  }
  if (result.ok !== true) {
    return { kind: "error", message: "The delete function refused this request.", data: result };
  }
  return { kind: "ok", data: result };
}

const ONEDRIVE_DELETE_WEBHOOK = "https://n8n.srv1437130.hstgr.cloud/webhook/onedrive-delete";

function shortMessage(value: unknown): string {
  const text = typeof value === "string" ? value : String(value ?? "Unknown error");
  return text.slice(0, 200);
}

/** Deletes the project folder in OneDrive. Never throws. */
export async function purgeOnedriveFolder(
  tombstoneId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, error: "No active session" };

    const res = await fetch(ONEDRIVE_DELETE_WEBHOOK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tombstone_id: tombstoneId }),
    });

    if (!res.ok) {
      return { ok: false, error: shortMessage(`Folder delete failed with status ${res.status}`) };
    }

    let body: any = null;
    try {
      body = await res.json();
    } catch {
      return { ok: false, error: "Folder delete returned an unreadable response" };
    }

    if (body?.ok === true) return { ok: true };
    return { ok: false, error: shortMessage(body?.error ?? "Folder delete was not confirmed") };
  } catch (err: any) {
    return { ok: false, error: shortMessage(err?.message ?? err) };
  }
}

/** Records the OneDrive purge attempt against the tombstone. Never throws. */
export async function recordOnedrivePurge(
  tombstoneId: string,
  ok: boolean,
  error: string | null,
): Promise<void> {
  try {
    const { error: rpcError } = await (supabase as any).rpc("record_onedrive_purge", {
      p_tombstone_id: tombstoneId,
      p_ok: ok,
      p_error: error,
    });
    if (rpcError) console.error("record_onedrive_purge failed", rpcError);
  } catch (err) {
    console.error("record_onedrive_purge threw", err);
  }
}


export const COUNT_LABELS: Array<[keyof DeleteProjectCounts, string]> = [
  ["tasks", "Tasks"],
  ["task_lists", "Task lists"],
  ["scope_lines", "Scope lines"],
  ["scope_breakdown", "Scope breakdown"],
  ["stock_orders", "Stock orders"],
  ["stock_planning", "Stock planning"],
  ["stock_reconciliation", "Stock reconciliation"],
  ["project_financials", "Financials"],
  ["project_forecast_snapshots", "Forecast snapshots"],
  ["time_entries", "Time entries"],
  ["attachments", "Attachments"],
  ["calc_cells", "Calc cells"],
  ["accessory_usage", "Accessory usage"],
  ["invoices", "Invoices"],
  ["invoice_lines", "Invoice lines"],
  ["comments", "Comments"],
];
