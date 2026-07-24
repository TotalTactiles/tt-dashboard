import { ScopeTable } from "./ScopeTable";
import { StockPlanningTable } from "./StockPlanningTable";
import { OrderStockTable } from "./OrderStockTable";
import { AccessoriesTable } from "./AccessoriesTable";
import { ReconciliationTable } from "./ReconciliationTable";
import { HoursTable } from "./HoursTable";
import { InvoicesTable } from "./InvoicesTable";

export const TABLE_LABEL: Record<string, string> = {
  scope: "Scope Breakdown",
  stock_planning: "Stock Planning",
  order_stock: "Order Stock",
  accessories: "Accessories",
  reconciliation: "Reconciliation",
  hour_log: "Hours",
  invoices: "Invoices",
};

/** Tables that office-only users can access. */
export const TABLE_OFFICE_ONLY = new Set(["stock_planning", "invoices"]);

export function ProjectCalcTable({
  kind,
  projectId,
  taskId,
}: {
  kind: string;
  projectId: string;
  taskId: string;
}) {
  switch (kind) {
    case "scope":
      return <ScopeTable taskId={taskId} />;
    case "stock_planning":
      return <StockPlanningTable projectId={projectId} />;
    case "order_stock":
      return <OrderStockTable projectId={projectId} />;
    case "accessories":
      return <AccessoriesTable projectId={projectId} />;
    case "reconciliation":
      return <ReconciliationTable projectId={projectId} />;
    case "hour_log":
      return <HoursTable projectId={projectId} />;
    case "invoices":
      return <InvoicesTable projectId={projectId} />;
    default:
      return (
        <div className="p-6 text-[12px] text-muted-foreground text-center">
          No table configured for this task.
        </div>
      );
  }
}
