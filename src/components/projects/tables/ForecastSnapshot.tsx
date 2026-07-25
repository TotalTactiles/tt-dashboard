import { useState, useCallback } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useProjectForecast, type ProjectForecast } from "@/hooks/useProjects";
import { cn } from "@/lib/utils";

// Read-only view of project_forecast_snapshots (via v_project_forecast).
// The row is captured by n8n at project creation and is append-only at the DB
// level; nothing in this component ever writes. If effective_type === 'restated'
// we surface the restated headline and keep the pre-split original tucked away
// under a disclosure for context.

const INTERACTIVE = "#3D89DA";
const WARNING = "#BA7517";
const POSITIVE = "#22C55E";
const NEG_28 = "rgba(230,238,243,0.28)";
const NEG_45 = "rgba(230,238,243,0.45)";

function fmtCurrency(n: number | null | undefined): string | null {
  if (n === null || n === undefined) return null;
  const num = Number(n);
  if (!Number.isFinite(num)) return null;
  return num.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPercent(n: number | null | undefined): string | null {
  if (n === null || n === undefined) return null;
  const num = Number(n);
  if (!Number.isFinite(num)) return null;
  return `${num.toFixed(1)}%`;
}

function fmtMonth(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return null;
  return d
    .toLocaleDateString("en-AU", { month: "short", year: "numeric" })
    .toUpperCase();
}

function fmtDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d
    .toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
}

interface Props {
  projectId: string;
}

export function ForecastSnapshot({ projectId }: Props) {
  const { forecast, loading, allowed } = useProjectForecast(projectId);
  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = useCallback(() => setExpanded((v) => !v), []);

  // Office-only. The hook returns allowed=false for other roles and we render
  // nothing — a worker sees the task with no forecast section at all.
  if (!allowed) return null;

  if (loading) {
    return (
      <div
        className="text-[11px] font-mono"
        style={{ color: NEG_45 }}
      >
        Loading forecast…
      </div>
    );
  }

  if (!forecast) {
    return (
      <div
        className="text-[11px] font-mono leading-relaxed"
        style={{ color: NEG_45 }}
      >
        No forecast captured for this project. Snapshots are taken automatically
        when a project is created from CRM. Projects built before this feature
        will not have one.
      </div>
    );
  }

  const restated = forecast.effective_type === "restated";
  const capturedAt = fmtDay(forecast.effective_captured_at);

  return (
    <div className="space-y-4">
      {/* Subheading — captured_at + optional RESTATED chip */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="font-mono uppercase"
          style={{
            fontSize: "9px",
            letterSpacing: "0.9px",
            color: NEG_28,
          }}
        >
          FROZEN AT PROJECT CREATION{capturedAt ? ` · ${capturedAt}` : ""}
        </span>
        {restated && (
          <span
            className="font-mono uppercase px-1.5 py-0.5 rounded-sm"
            style={{
              fontSize: "9px",
              letterSpacing: "0.9px",
              background: `${WARNING}22`,
              color: WARNING,
            }}
          >
            RESTATED
          </span>
        )}
      </div>

      {/* Financial rows */}
      <div>
        <FinRow
          label="CONTRACT VALUE"
          value={fmtCurrency(forecast.contract_value)}
          positive
          rawPositive={numGt0(forecast.contract_value)}
        />
        <FinRow label="LABOUR" value={fmtCurrency(forecast.labour_cost)} />
        <FinRow label="TACTILE" value={fmtCurrency(forecast.tactile_cost)} />
        <FinRow label="OTHER PRODUCTS" value={fmtCurrency(forecast.other_cost)} />

        <Divider />
        <FinRow label="TOTAL COGS" value={fmtCurrency(forecast.total_cogs)} />

        <Divider />
        <FinRow
          label="GROSS MARGIN"
          value={fmtCurrency(forecast.gross_margin)}
          positive
          rawPositive={numGt0(forecast.gross_margin)}
        />
        <FinRow
          label="GP %"
          value={fmtPercent(forecast.gp_percent)}
          positive
          rawPositive={numGt0(forecast.gp_percent)}
        />
      </div>

      {/* Divider between financial group and dates */}
      <div style={{ borderTop: "1px solid #1F2224" }} />

      {/* Date rows — INVOICE · DUE · LABOUR · TACTILE · OTHER */}
      <div className="space-y-1.5">
        <DateRow label="INVOICE" iso={forecast.invoice_month} />
        <DateRow label="DUE" iso={forecast.due_month} />
        <DateRow label="LABOUR" iso={forecast.labour_month} />
        <DateRow
          label="TACTILE"
          iso={forecast.tactile_month}
          isoEnd={forecast.tactile_rem_month}
        />
        <DateRow label="OTHER" iso={forecast.other_month} />
        {forecast.tactile_rem_month && (
          <div
            className="text-[10px] font-mono pl-[80px]"
            style={{ color: NEG_45 }}
          >
            split payment — 30% / 70%
          </div>
        )}
      </div>

      {/* Restated disclosure — the pre-split "whole job" figures for context */}
      {restated && (
        <div style={{ borderTop: "1px solid #1F2224" }} className="pt-3">
          <button
            onClick={toggleExpanded}
            className="inline-flex items-center gap-1 font-mono uppercase"
            style={{
              fontSize: "10px",
              letterSpacing: "0.6px",
              color: INTERACTIVE,
            }}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Original whole-job forecast
          </button>
          {expanded && (
            <div className="mt-2 space-y-1.5" style={{ color: NEG_45 }}>
              <OriginalRow
                label="CONTRACT VALUE"
                value={fmtCurrency(forecast.original_contract_value)}
              />
              <OriginalRow
                label="TOTAL COGS"
                value={fmtCurrency(forecast.original_total_cogs)}
              />
              <OriginalRow
                label="GROSS MARGIN"
                value={fmtCurrency(forecast.original_gross_margin)}
              />
              <OriginalRow
                label="CAPTURED"
                value={fmtDay(forecast.original_captured_at)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function numGt0(n: number | null | undefined): boolean {
  if (n === null || n === undefined) return false;
  const num = Number(n);
  return Number.isFinite(num) && num > 0;
}

function Divider() {
  return <div className="my-1.5" style={{ borderTop: "1px solid #1F2224" }} />;
}

function FinRow({
  label,
  value,
  positive,
  rawPositive,
}: {
  label: string;
  value: string | null;
  positive?: boolean;
  rawPositive?: boolean;
}) {
  const isNull = value === null;
  const green = positive && rawPositive && !isNull;
  return (
    <div className="flex items-center justify-between py-1">
      <span
        className="font-mono uppercase"
        style={{
          fontSize: "10.5px",
          letterSpacing: "0.4px",
          color: isNull ? NEG_28 : "rgba(230,238,243,0.72)",
        }}
      >
        {label}
      </span>
      <span
        className={cn("font-mono text-right")}
        style={{
          fontSize: "12.5px",
          color: isNull ? NEG_28 : green ? POSITIVE : "#E6EEF3",
        }}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

function DateRow({
  label,
  iso,
  isoEnd,
}: {
  label: string;
  iso: string | null | undefined;
  isoEnd?: string | null | undefined;
}) {
  const start = fmtMonth(iso);
  const end = fmtMonth(isoEnd);
  const isNull = !start;
  return (
    <div className="flex items-center">
      <span
        className="font-mono uppercase w-[80px] shrink-0"
        style={{
          fontSize: "10.5px",
          letterSpacing: "0.4px",
          color: isNull ? NEG_28 : NEG_45,
        }}
      >
        {label}
      </span>
      <span
        className="font-mono"
        style={{
          fontSize: "11px",
          color: isNull ? NEG_28 : "rgba(230,238,243,0.72)",
        }}
      >
        {start ? (end ? `${start} → ${end}` : start) : "—"}
      </span>
    </div>
  );
}

function OriginalRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between">
      <span
        className="font-mono uppercase"
        style={{ fontSize: "10px", letterSpacing: "0.4px" }}
      >
        {label}
      </span>
      <span className="font-mono" style={{ fontSize: "11.5px" }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

// Re-export type for convenience — the drawer only needs the component.
export type { ProjectForecast };
