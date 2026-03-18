import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, ChevronLeft, ChevronRight, X, Table2, Search, Columns3, Check, ChevronDown } from "lucide-react";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { formatDateMonthYear } from "@/lib/formatDate";
import type { PeriodSpec } from "@/lib/projectExecutionKpis";
import NoData from "./NoData";

/* ── Status colour map ── */
const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending:  { bg: "bg-gray-500/20",   text: "text-gray-400",   border: "border-gray-500/40" },
  invoiced: { bg: "bg-amber-500/20",  text: "text-amber-400",  border: "border-amber-500/40" },
  overdue:  { bg: "bg-red-500/20",    text: "text-red-400",    border: "border-red-500/40" },
  paid:     { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/40" },
};

function statusPillClass(status: string, active: boolean): string {
  if (!active) return "border-border text-muted-foreground hover:bg-secondary/50";
  const c = STATUS_COLORS[status];
  if (!c) return "bg-chart-green/20 text-chart-green border-chart-green/40";
  return `${c.bg} ${c.text} ${c.border}`;
}

function statusBadgeClass(status: string): string {
  const c = STATUS_COLORS[status];
  if (!c) return "bg-secondary/50 text-muted-foreground border-border/50";
  return `${c.bg} ${c.text} ${c.border}`;
}

/* ── Column definitions ── */
type ColumnKey = "company" | "project" | "stage" | "stageValue" | "valueInclGST" | "valueExclGST" | "invoice" | "dueDate" | "labour" | "tactile" | "other" | "cogs" | "grossProfit" | "gpPct" | "status";

interface ColumnDef {
  key: ColumnKey;
  label: string;
  align: "left" | "right" | "center";
  defaultVisible: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "company", label: "Company", align: "left", defaultVisible: true },
  { key: "project", label: "Project", align: "left", defaultVisible: true },
  { key: "stage", label: "Stage", align: "left", defaultVisible: true },
  { key: "stageValue", label: "Stage Value", align: "right", defaultVisible: true },
  { key: "valueInclGST", label: "Value (incl GST)", align: "right", defaultVisible: true },
  { key: "valueExclGST", label: "Value (excl GST)", align: "right", defaultVisible: true },
  { key: "invoice", label: "Invoice", align: "left", defaultVisible: true },
  { key: "dueDate", label: "Due Date", align: "left", defaultVisible: false },
  { key: "labour", label: "Labour", align: "right", defaultVisible: true },
  { key: "tactile", label: "Tactile", align: "right", defaultVisible: true },
  { key: "other", label: "Other", align: "right", defaultVisible: true },
  { key: "cogs", label: "COGS", align: "right", defaultVisible: true },
  { key: "grossProfit", label: "Gross Profit", align: "right", defaultVisible: true },
  { key: "gpPct", label: "GP%", align: "right", defaultVisible: false },
  { key: "status", label: "Status", align: "center", defaultVisible: true },
];

const DEFAULT_VISIBLE = ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key);
const LS_KEY = "revenue-cogs-visible-columns";

function loadVisibleColumns(): ColumnKey[] {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      const valid = parsed.filter(k => ALL_COLUMNS.some(c => c.key === k)) as ColumnKey[];
      if (valid.length > 0) return valid;
    }
  } catch { /* ignore */ }
  return DEFAULT_VISIBLE;
}

/* ── Sort ── */
type SortOption = "date-closest" | "date-desc" | "date-asc" | "value-desc" | "value-asc" | "gp-dollar-desc" | "cogs-desc" | "gp-desc" | "company-asc";
type StatusFilter = "all" | "invoiced" | "paid" | "pending" | "overdue";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "date-closest", label: "Closest to today" },
  { value: "date-desc", label: "Invoice Date (newest)" },
  { value: "date-asc", label: "Invoice Date (oldest)" },
  { value: "value-desc", label: "Value (highest)" },
  { value: "value-asc", label: "Value (lowest)" },
  { value: "gp-dollar-desc", label: "Gross Profit (highest)" },
  { value: "cogs-desc", label: "Total COGS (highest)" },
  { value: "gp-desc", label: "GP% (highest)" },
  { value: "company-asc", label: "Company (A–Z)" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "invoiced", label: "Invoiced" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
];

function parseDateForSort(raw: string): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  const dmyMatch = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
  if (dmyMatch) return new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseMonthYear(label: string): { month: number; year: number } | null {
  const d = new Date(label);
  if (!isNaN(d.getTime())) return { month: d.getMonth(), year: d.getFullYear() };
  return null;
}

const ITEMS_PER_PAGE = 10;

interface RevenueProjectsTableProps {
  periodFilter?: PeriodSpec | null;
  showAll?: boolean;
  onAllToggle?: (allOn: boolean) => void;
}

const RevenueProjectsTable = ({ periodFilter, showAll = false, onAllToggle }: RevenueProjectsTableProps) => {
  const { revenueProjects, dataHealth } = useDashboardData();
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("date-closest");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [companySearch, setCompanySearch] = useState("");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(loadVisibleColumns);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (columnPickerRef.current && !columnPickerRef.current.contains(e.target as Node)) {
        setShowColumnPicker(false);
      }
    };
    if (showColumnPicker) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showColumnPicker]);

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const isColVisible = (key: ColumnKey) => visibleColumns.includes(key);

  const hasActiveFilters = sortBy !== "date-closest" || statusFilter !== "all" || stageFilter !== "all" || monthFilter !== "all" || companySearch.length > 0;

  const clearFilters = useCallback(() => {
    setSortBy("date-closest");
    setStatusFilter("all");
    setStageFilter("all");
    setMonthFilter("all");
    setCompanySearch("");
    setPage(1);
  }, []);

  const uniqueStages = useMemo(() => {
    return [...new Set(revenueProjects.map(p => p.projectStage).filter(Boolean))].sort();
  }, [revenueProjects]);

  const monthPills = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const parsed = revenueProjects
      .map(p => ({ label: formatDateMonthYear(p.invoiceDate), parsed: parseMonthYear(formatDateMonthYear(p.invoiceDate)) }))
      .filter(x => x.parsed !== null) as { label: string; parsed: { month: number; year: number } }[];

    const seen = new Map<string, { label: string; month: number; year: number }>();
    for (const x of parsed) {
      if (!seen.has(x.label)) seen.set(x.label, { label: x.label, ...x.parsed });
    }

    const pills: { value: string; label: string; sortKey: number }[] = [];
    const yearBuckets = new Map<number, boolean>();

    for (const [, entry] of seen) {
      if (entry.year === currentYear) {
        pills.push({ value: entry.label, label: entry.label, sortKey: entry.year * 100 + entry.month });
      } else {
        yearBuckets.set(entry.year, true);
      }
    }

    for (const yr of [...yearBuckets.keys()].sort()) {
      pills.push({ value: `year-${yr}`, label: String(yr), sortKey: yr < currentYear ? yr * 100 : yr * 100 + 50 });
    }

    pills.sort((a, b) => a.sortKey - b.sortKey);
    return pills;
  }, [revenueProjects]);

  const filteredProjects = useMemo(() => {
    let projects = [...revenueProjects];
    // Period filter from master selector using Invoice Date (unless "All" is toggled)
    if (!showAll && periodFilter && periodFilter.months.length > 0) {
      const monthSet = new Set(periodFilter.months);
      const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      projects = projects.filter((p) => {
        const d = parseDateForSort(p.invoiceDate);
        if (!d) return false;
        const key = `${MONTH_ABBR[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
        return monthSet.has(key);
      });
    }
    if (statusFilter !== "all") projects = projects.filter(p => p.status === statusFilter);
    if (stageFilter !== "all") projects = projects.filter(p => p.projectStage === stageFilter);
    if (monthFilter !== "all") {
      if (monthFilter.startsWith("year-")) {
        const yr = parseInt(monthFilter.replace("year-", ""));
        projects = projects.filter(p => {
          const parsed = parseMonthYear(formatDateMonthYear(p.invoiceDate));
          return parsed?.year === yr;
        });
      } else {
        projects = projects.filter(p => formatDateMonthYear(p.invoiceDate) === monthFilter);
      }
    }
    if (companySearch.trim()) {
      const q = companySearch.trim().toLowerCase();
      projects = projects.filter(p => p.company.toLowerCase().includes(q));
    }
    projects.sort((a, b) => {
      switch (sortBy) {
        case "date-closest": {
          const today = Date.now();
          const diffA = parseDateForSort(a.invoiceDate) ? Math.abs(parseDateForSort(a.invoiceDate)!.getTime() - today) : Infinity;
          const diffB = parseDateForSort(b.invoiceDate) ? Math.abs(parseDateForSort(b.invoiceDate)!.getTime() - today) : Infinity;
          return diffA - diffB;
        }
        case "date-desc": return (parseDateForSort(b.invoiceDate)?.getTime() ?? 0) - (parseDateForSort(a.invoiceDate)?.getTime() ?? 0);
        case "date-asc": return (parseDateForSort(a.invoiceDate)?.getTime() ?? 0) - (parseDateForSort(b.invoiceDate)?.getTime() ?? 0);
        case "value-desc": return b.valueExclGST - a.valueExclGST;
        case "value-asc": return a.valueExclGST - b.valueExclGST;
        case "gp-dollar-desc": return b.grossProfit - a.grossProfit;
        case "cogs-desc": return b.totalCOGS - a.totalCOGS;
        case "gp-desc": {
          const gpA = a.valueExclGST > 0 ? (a.grossProfit / a.valueExclGST) * 100 : 0;
          const gpB = b.valueExclGST > 0 ? (b.grossProfit / b.valueExclGST) * 100 : 0;
          return gpB - gpA;
        }
        case "company-asc": return a.company.localeCompare(b.company);
        default: return 0;
      }
    });
    return projects;
  }, [revenueProjects, statusFilter, stageFilter, monthFilter, companySearch, sortBy, showAll, periodFilter]);

  /* ── Totals ── */
  const totalRevenue = filteredProjects.reduce((sum, p) => sum + p.valueExclGST, 0);
  const totalCOGS = filteredProjects.reduce((sum, p) => sum + p.totalCOGS, 0);
  const totalGP = filteredProjects.reduce((sum, p) => sum + p.grossProfit, 0);
  const totalValueInclGST = filteredProjects.reduce((sum, p) => sum + p.valueInclGST, 0);
  const totalLabour = filteredProjects.reduce((sum, p) => sum + p.labourCost, 0);
  const totalTactile = filteredProjects.reduce((sum, p) => sum + p.tactileCost, 0);
  const totalOther = filteredProjects.reduce((sum, p) => sum + p.otherCost, 0);
  const totalStageValue = filteredProjects.reduce((sum, p) => sum + p.stageValue, 0);
  const totalGpPct = totalRevenue > 0 ? (totalGP / totalRevenue) * 100 : 0;

  /* ── Pagination ── */
  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageProjects = filteredProjects.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  const fmtDollar = (v: number) => `$${v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  const fmtGpPct = (gp: number, rev: number) => rev > 0 ? `${((gp / rev) * 100).toFixed(2)}%` : "0.00%";

  const toggleCardExpand = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderPillRow = (
    label: string,
    options: { value: string; label: string }[],
    current: string,
    onChange: (v: string) => void,
    getStyle?: (v: string, active: boolean) => string,
  ) => (
    <div>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{label}</span>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {options.map((opt) => {
          const active = current === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setPage(1); }}
              className={`text-[11px] px-2 py-1.5 md:py-1 rounded-full border transition-colors font-mono touch-target md:min-h-0 md:min-w-0 ${
                getStyle
                  ? getStyle(opt.value, active)
                  : active
                    ? "bg-chart-green/20 text-chart-green border-chart-green/40"
                    : "border-border text-muted-foreground hover:bg-secondary/50"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  /* ── Render cell by column key ── */
  const renderCell = (proj: typeof filteredProjects[0], key: ColumnKey) => {
    switch (key) {
      case "company": return <span className="font-medium truncate block max-w-[200px]">{proj.company}</span>;
      case "project": return <span className="text-muted-foreground truncate block max-w-[200px]">{proj.project}</span>;
      case "stage": return proj.projectStage ? (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/50 text-muted-foreground font-mono border border-border/50">
          {proj.projectStage}
        </span>
      ) : null;
      case "stageValue": return <span className="font-mono text-muted-foreground">{proj.stageValue > 0 ? fmtDollar(proj.stageValue) : ""}</span>;
      case "valueInclGST": return <span className="font-mono">{fmtDollar(proj.valueInclGST)}</span>;
      case "valueExclGST": return <span className="font-mono">{fmtDollar(proj.valueExclGST)}</span>;
      case "invoice": return <span className="font-mono text-xs text-muted-foreground">{proj.invoiceDate}</span>;
      case "dueDate": return <span className="font-mono text-xs text-muted-foreground">{proj.dueDate}</span>;
      case "labour": return <span className="font-mono text-chart-red">{fmtDollar(proj.labourCost)}</span>;
      case "tactile": return <span className="font-mono text-chart-red">{fmtDollar(proj.tactileCost)}</span>;
      case "other": return <span className="font-mono text-chart-red">{fmtDollar(proj.otherCost)}</span>;
      case "cogs": return <span className="font-mono text-chart-red">{fmtDollar(proj.totalCOGS)}</span>;
      case "grossProfit": return <span className={`font-mono ${proj.grossProfit >= 0 ? "text-chart-green" : "text-chart-red"}`}>{fmtDollar(proj.grossProfit)}</span>;
      case "gpPct": {
        const pct = proj.valueExclGST > 0 ? (proj.grossProfit / proj.valueExclGST) * 100 : 0;
        return <span className={`font-mono ${pct >= 0 ? "text-chart-green" : "text-chart-red"}`}>{pct.toFixed(2)}%</span>;
      }
      case "status": return (
        <span className={`text-xs px-2 py-1 rounded-full font-mono capitalize border ${statusBadgeClass(proj.status)}`}>
          {proj.status}
        </span>
      );
      default: return null;
    }
  };

  const renderTotalCell = (key: ColumnKey) => {
    switch (key) {
      case "stageValue": return <span className="text-foreground">{fmtDollar(totalStageValue)}</span>;
      case "valueInclGST": return <span className="text-foreground">{fmtDollar(totalValueInclGST)}</span>;
      case "valueExclGST": return <span className="text-foreground">{fmtDollar(totalRevenue)}</span>;
      case "labour": return <span className="text-chart-red">{fmtDollar(totalLabour)}</span>;
      case "tactile": return <span className="text-chart-red">{fmtDollar(totalTactile)}</span>;
      case "other": return <span className="text-chart-red">{fmtDollar(totalOther)}</span>;
      case "cogs": return <span className="text-chart-red">{fmtDollar(totalCOGS)}</span>;
      case "grossProfit": return <span className={totalGP >= 0 ? "text-chart-green" : "text-chart-red"}>{fmtDollar(totalGP)}</span>;
      case "gpPct": return <span className={totalGpPct >= 0 ? "text-chart-green" : "text-chart-red"}>{totalGpPct.toFixed(2)}%</span>;
      default: return null;
    }
  };

  const visibleColDefs = ALL_COLUMNS.filter(c => isColVisible(c.key));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.7 }}
      className="chart-container col-span-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-fluid-sm font-medium text-muted-foreground">Revenue &amp; COGS</h3>
          {periodFilter && (
            <button
              onClick={() => { onAllToggle?.(!showAll); setPage(1); }}
              className={`text-[11px] px-2.5 py-1 rounded-full border font-mono transition-colors ${
                showAll
                  ? "bg-chart-green/20 text-chart-green border-chart-green/40"
                  : "border-border text-muted-foreground hover:bg-secondary/50"
              }`}
            >
              All
            </button>
          )}
          {!showAll && periodFilter && (
            <span className="text-[10px] font-mono text-muted-foreground/70">
              {periodFilter.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {filteredProjects.length > 0 && (
            <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
              <span className="text-muted-foreground">
                Revenue: <span className="text-chart-green">{fmtDollar(totalRevenue)}</span>
              </span>
              <span className="text-muted-foreground">
                COGS: <span className="text-chart-red">{fmtDollar(totalCOGS)}</span>
              </span>
              <span className="text-muted-foreground">
                GP: <span className="text-chart-blue">{fmtDollar(totalGP)}</span>
              </span>
            </div>
          )}

          {/* Column picker - desktop only */}
          <div className="relative hidden md:block" ref={columnPickerRef}>
            <button
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className="p-1.5 rounded-md border border-border hover:bg-secondary/50 transition-colors"
              title="Toggle columns"
            >
              <Columns3 className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {showColumnPicker && (
              <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-lg border border-border bg-card shadow-xl p-2 space-y-0.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono px-2 py-1 block">Columns</span>
                {ALL_COLUMNS.map(col => {
                  const checked = isColVisible(col.key);
                  return (
                    <button
                      key={col.key}
                      onClick={() => toggleColumn(col.key)}
                      className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-xs font-mono hover:bg-secondary/50 transition-colors"
                    >
                      <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center transition-colors ${checked ? "bg-chart-green border-chart-green" : "border-border"}`}>
                        {checked && <Check className="h-2.5 w-2.5 text-background" />}
                      </span>
                      <span className={checked ? "text-foreground" : "text-muted-foreground"}>{col.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="relative p-1.5 rounded-md border border-border hover:bg-secondary/50 transition-colors touch-target md:min-h-0 md:min-w-0"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            {hasActiveFilters && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-chart-green" />
            )}
          </button>
        </div>
      </div>

      {/* Filter panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mb-4 p-3 rounded-lg bg-secondary/30 border border-border/50 space-y-3">
              {renderPillRow("Sort by", SORT_OPTIONS, sortBy, (v) => setSortBy(v as SortOption))}

              {renderPillRow(
                "Status",
                STATUS_OPTIONS,
                statusFilter,
                (v) => setStatusFilter(v as StatusFilter),
                (v, active) => v === "all"
                  ? (active ? "bg-chart-green/20 text-chart-green border-chart-green/40" : "border-border text-muted-foreground hover:bg-secondary/50")
                  : statusPillClass(v, active),
              )}

              {uniqueStages.length > 0 && renderPillRow(
                "Project Stage",
                [{ value: "all", label: "All" }, ...uniqueStages.map(s => ({ value: s, label: s }))],
                stageFilter,
                setStageFilter,
              )}

              {renderPillRow(
                "Invoice Month",
                [{ value: "all", label: "All time" }, ...monthPills],
                monthFilter,
                setMonthFilter,
              )}

              {/* Company search input */}
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Company</span>
                <div className="relative mt-1 w-full md:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={companySearch}
                    onChange={(e) => { setCompanySearch(e.target.value); setPage(1); }}
                    placeholder="Search company..."
                    className="w-full h-10 md:h-8 pl-8 pr-8 rounded-md border border-border bg-secondary/30 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-chart-green/50 focus:border-chart-green/50 transition-colors"
                  />
                  {companySearch && (
                    <button
                      onClick={() => { setCompanySearch(""); setPage(1); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-[11px] text-chart-green hover:underline font-mono flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Clear filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {revenueProjects.length === 0 ? (
        <NoData message="No revenue data" healthStatus={dataHealth.revenue.status} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="desktop-table overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground font-mono border-b border-border">
                  {visibleColDefs.map(col => (
                    <th key={col.key} className={`pb-3 pr-4 whitespace-nowrap ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageProjects.map((proj, i) => (
                  <motion.tr
                    key={proj.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${i % 2 === 1 ? "bg-secondary/[0.06]" : ""}`}
                  >
                    {visibleColDefs.map(col => (
                      <td key={col.key} className={`py-3 pr-4 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""}`}>
                        {renderCell(proj, col.key)}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-chart-green/30 bg-chart-green/[0.08] font-bold text-sm font-mono">
                  {visibleColDefs.map((col, idx) => {
                    if (idx === 0) {
                      return (
                        <td key={col.key} className="py-3 pr-4 pl-1" colSpan={1}>
                          <div className="flex items-center gap-2 text-foreground">
                            <Table2 className="h-4 w-4" />
                            <span>Total ({filteredProjects.length} projects)</span>
                          </div>
                        </td>
                      );
                    }
                    if (idx === 1) {
                      return <td key={col.key} className="py-3 pr-4"></td>;
                    }
                    const content = renderTotalCell(col.key);
                    return (
                      <td key={col.key} className={`py-3 pr-4 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""}`}>
                        {content}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile card layout */}
          <div className="mobile-card-table space-y-2">
            {pageProjects.map((proj) => {
              const isExpanded = expandedCards.has(proj.id);
              const gpPct = proj.valueExclGST > 0 ? (proj.grossProfit / proj.valueExclGST) * 100 : 0;
              return (
                <motion.div
                  key={proj.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-border/50 rounded-lg p-3 bg-secondary/10"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{proj.company}</p>
                      <p className="text-xs text-muted-foreground truncate">{proj.project}</p>
                    </div>
                    <span className="font-mono text-sm font-bold text-foreground whitespace-nowrap">
                      {fmtDollar(proj.valueInclGST)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono capitalize border ${statusBadgeClass(proj.status)}`}>
                      {proj.status}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">{proj.invoiceDate}</span>
                      <button onClick={() => toggleCardExpand(proj.id)} className="text-muted-foreground p-1">
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      className="mt-2 pt-2 border-t border-border/30 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-mono"
                    >
                      <div>
                        <span className="text-muted-foreground">Excl GST</span>
                        <span className="block text-foreground">{fmtDollar(proj.valueExclGST)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">COGS</span>
                        <span className="block text-chart-red">{fmtDollar(proj.totalCOGS)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Labour</span>
                        <span className="block text-chart-red">{fmtDollar(proj.labourCost)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tactile</span>
                        <span className="block text-chart-red">{fmtDollar(proj.tactileCost)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Other</span>
                        <span className="block text-chart-red">{fmtDollar(proj.otherCost)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Gross Profit</span>
                        <span className={`block ${proj.grossProfit >= 0 ? "text-chart-green" : "text-chart-red"}`}>{fmtDollar(proj.grossProfit)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">GP%</span>
                        <span className={`block ${gpPct >= 0 ? "text-chart-green" : "text-chart-red"}`}>{gpPct.toFixed(2)}%</span>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
            {/* Mobile total card */}
            <div className="border border-chart-green/30 rounded-lg p-3" style={{ backgroundColor: "rgba(16, 185, 129, 0.05)" }}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-mono font-bold text-sm text-foreground">
                  <Table2 className="h-3.5 w-3.5 text-chart-green" />
                  Total ({filteredProjects.length})
                </span>
                <span className="font-mono font-bold text-sm text-chart-green">
                  {fmtDollar(totalRevenue)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">COGS</span>
                  <span className="text-chart-red">{fmtDollar(totalCOGS)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GP</span>
                  <span className={totalGP >= 0 ? "text-chart-green" : "text-chart-red"}>{fmtDollar(totalGP)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
              <span className="text-xs text-muted-foreground font-mono">
                {startIdx + 1}–{Math.min(startIdx + ITEMS_PER_PAGE, filteredProjects.length)} of {filteredProjects.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded-md border border-border hover:bg-secondary/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed touch-target md:min-h-0 md:min-w-0"
                >
                  <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                {pageNumbers.map((pn) => (
                  <button
                    key={pn}
                    onClick={() => setPage(pn)}
                    className={`h-8 w-8 md:h-7 md:w-7 rounded-md text-xs font-mono transition-colors ${
                      pn === currentPage
                        ? "bg-chart-green text-background font-semibold"
                        : "text-muted-foreground hover:bg-secondary/50"
                    }`}
                  >
                    {pn}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 rounded-md border border-border hover:bg-secondary/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed touch-target md:min-h-0 md:min-w-0"
                >
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};

export default RevenueProjectsTable;
