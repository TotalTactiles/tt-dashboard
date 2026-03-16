import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, ChevronLeft, ChevronRight, X, Table2, Search } from "lucide-react";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { formatDateMonthYear } from "@/lib/formatDate";
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

/** Parse "Month YYYY" to { month, year } */
function parseMonthYear(label: string): { month: number; year: number } | null {
  const d = new Date(label);
  if (!isNaN(d.getTime())) return { month: d.getMonth(), year: d.getFullYear() };
  return null;
}

const ITEMS_PER_PAGE = 10;

const RevenueProjectsTable = () => {
  const { revenueProjects, dataHealth } = useDashboardData();
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("date-closest");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [companySearch, setCompanySearch] = useState("");

  const hasActiveFilters = sortBy !== "date-closest" || statusFilter !== "all" || stageFilter !== "all" || monthFilter !== "all" || companySearch.length > 0;

  const clearFilters = useCallback(() => {
    setSortBy("date-closest");
    setStatusFilter("all");
    setStageFilter("all");
    setMonthFilter("all");
    setCompanySearch("");
    setPage(1);
  }, []);

  /* ── Dynamic filter options ── */
  const uniqueStages = useMemo(() => {
    return [...new Set(revenueProjects.map(p => p.projectStage).filter(Boolean))].sort();
  }, [revenueProjects]);

  // Time-aware month pills
  const monthPills = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const parsed = revenueProjects
      .map(p => ({ label: formatDateMonthYear(p.invoiceDate), parsed: parseMonthYear(formatDateMonthYear(p.invoiceDate)) }))
      .filter(x => x.parsed !== null) as { label: string; parsed: { month: number; year: number } }[];

    // Deduplicate
    const seen = new Map<string, { label: string; month: number; year: number }>();
    for (const x of parsed) {
      if (!seen.has(x.label)) seen.set(x.label, { label: x.label, ...x.parsed });
    }

    const pills: { value: string; label: string; sortKey: number }[] = [];
    const yearBuckets = new Map<number, boolean>();

    for (const [, entry] of seen) {
      if (entry.year === currentYear) {
        // Individual month pills for current year
        pills.push({ value: entry.label, label: entry.label, sortKey: entry.year * 100 + entry.month });
      } else {
        yearBuckets.set(entry.year, true);
      }
    }

    // Past/future years as collapsed pills
    for (const yr of [...yearBuckets.keys()].sort()) {
      pills.push({ value: `year-${yr}`, label: String(yr), sortKey: yr < currentYear ? yr * 100 : yr * 100 + 50 });
    }

    pills.sort((a, b) => a.sortKey - b.sortKey);
    return pills;
  }, [revenueProjects]);

  /* ── Filter + sort ── */
  const filteredProjects = useMemo(() => {
    let projects = [...revenueProjects];

    if (statusFilter !== "all") {
      projects = projects.filter(p => p.status === statusFilter);
    }
    if (stageFilter !== "all") {
      projects = projects.filter(p => p.projectStage === stageFilter);
    }
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
        case "date-desc": {
          const da = parseDateForSort(a.invoiceDate)?.getTime() ?? 0;
          const db = parseDateForSort(b.invoiceDate)?.getTime() ?? 0;
          return db - da;
        }
        case "date-asc": {
          const da = parseDateForSort(a.invoiceDate)?.getTime() ?? 0;
          const db = parseDateForSort(b.invoiceDate)?.getTime() ?? 0;
          return da - db;
        }
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
  }, [revenueProjects, statusFilter, stageFilter, monthFilter, companySearch, sortBy]);

  /* ── Totals ── */
  const totalRevenue = filteredProjects.reduce((sum, p) => sum + p.valueExclGST, 0);
  const totalCOGS = filteredProjects.reduce((sum, p) => sum + p.totalCOGS, 0);
  const totalGP = filteredProjects.reduce((sum, p) => sum + p.grossProfit, 0);

  const totalValueInclGST = filteredProjects.reduce((sum, p) => sum + p.valueInclGST, 0);
  const totalLabour = filteredProjects.reduce((sum, p) => sum + p.labourCost, 0);
  const totalTactile = filteredProjects.reduce((sum, p) => sum + p.tactileCost, 0);
  const totalOther = filteredProjects.reduce((sum, p) => sum + p.otherCost, 0);

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

  const fmtDollar = (v: number) => `$${v.toLocaleString()}`;

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
              className={`text-[11px] px-2 py-1 rounded-full border transition-colors font-mono ${
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.7 }}
      className="chart-container col-span-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">Revenue &amp; COGS</h3>
        <div className="flex items-center gap-2">
          {filteredProjects.length > 0 && (
            <div className="flex items-center gap-4 text-xs font-mono">
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
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="relative p-1.5 rounded-md border border-border hover:bg-secondary/50 transition-colors"
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
                <div className="relative mt-1 w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={companySearch}
                    onChange={(e) => { setCompanySearch(e.target.value); setPage(1); }}
                    placeholder="Search company..."
                    className="w-full h-8 pl-8 pr-8 rounded-md border border-border bg-secondary/30 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-chart-green/50 focus:border-chart-green/50 transition-colors"
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground font-mono border-b border-border">
                  <th className="pb-3 pr-4">Company</th>
                  <th className="pb-3 pr-4">Project</th>
                  <th className="pb-3 pr-4">Stage</th>
                  <th className="pb-3 pr-4 text-right">Stage Value</th>
                  <th className="pb-3 pr-4 text-right">Value (incl GST)</th>
                  <th className="pb-3 pr-4 text-right">Value (excl GST)</th>
                  <th className="pb-3 pr-4">Invoice</th>
                  <th className="pb-3 pr-4">Due</th>
                  <th className="pb-3 pr-4 text-right">Labour</th>
                  <th className="pb-3 pr-4 text-right">Tactile</th>
                  <th className="pb-3 pr-4 text-right">Other</th>
                  <th className="pb-3 pr-4 text-right">COGS</th>
                  <th className="pb-3 pr-4 text-right">Gross Profit</th>
                  <th className="pb-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {pageProjects.map((proj, i) => {
                  const gpPct = proj.valueExclGST > 0 ? ((proj.grossProfit / proj.valueExclGST) * 100).toFixed(1) : "0.0";
                  return (
                    <motion.tr
                      key={proj.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${i % 2 === 1 ? "bg-secondary/10" : ""}`}
                    >
                      <td className="py-3 pr-4 font-medium">{proj.company}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{proj.project}</td>
                      <td className="py-3 pr-4">
                        {proj.projectStage && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/50 text-muted-foreground font-mono border border-border/50">
                            {proj.projectStage}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-muted-foreground">
                        {proj.stageValue > 0 ? fmtDollar(proj.stageValue) : ""}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono">{fmtDollar(proj.valueInclGST)}</td>
                      <td className="py-3 pr-4 text-right font-mono">{fmtDollar(proj.valueExclGST)}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{proj.invoiceDate}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{proj.dueDate}</td>
                      <td className="py-3 pr-4 text-right font-mono text-chart-red">{fmtDollar(proj.labourCost)}</td>
                      <td className="py-3 pr-4 text-right font-mono text-chart-red">{fmtDollar(proj.tactileCost)}</td>
                      <td className="py-3 pr-4 text-right font-mono text-chart-red">{fmtDollar(proj.otherCost)}</td>
                      <td className="py-3 pr-4 text-right font-mono text-chart-red">{fmtDollar(proj.totalCOGS)}</td>
                      <td className={`py-3 pr-4 text-right font-mono ${proj.grossProfit >= 0 ? "text-chart-green" : "text-chart-red"}`}>{fmtDollar(proj.grossProfit)}</td>
                      <td className="py-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded-full font-mono capitalize border ${statusBadgeClass(proj.status)}`}>
                          {proj.status}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
              {/* Sticky total row */}
              <tfoot>
                <tr className="border-t-2 border-border bg-secondary/40 font-semibold text-xs font-mono">
                  <td className="py-3 pr-4" colSpan={2}>
                    <div className="flex items-center gap-2">
                      <Table2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Total ({filteredProjects.length} projects)</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4"></td>{/* Stage */}
                  <td className="py-3 pr-4"></td>{/* Stage Value */}
                  <td className="py-3 pr-4 text-right font-mono">{fmtDollar(totalValueInclGST)}</td>
                  <td className="py-3 pr-4 text-right font-mono">{fmtDollar(totalRevenue)}</td>
                  <td className="py-3 pr-4"></td>{/* Invoice */}
                  <td className="py-3 pr-4"></td>{/* Due */}
                  <td className="py-3 pr-4 text-right font-mono text-chart-red">{fmtDollar(totalLabour)}</td>
                  <td className="py-3 pr-4 text-right font-mono text-chart-red">{fmtDollar(totalTactile)}</td>
                  <td className="py-3 pr-4 text-right font-mono text-chart-red">{fmtDollar(totalOther)}</td>
                  <td className="py-3 pr-4 text-right font-mono text-chart-red">{fmtDollar(totalCOGS)}</td>
                  <td className={`py-3 pr-4 text-right font-mono ${totalGP >= 0 ? "text-chart-green" : "text-chart-red"}`}>{fmtDollar(totalGP)}</td>
                  <td className="py-3"></td>{/* Status */}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
              <span className="text-xs text-muted-foreground font-mono">
                Showing {startIdx + 1}–{Math.min(startIdx + ITEMS_PER_PAGE, filteredProjects.length)} of {filteredProjects.length} projects
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded-md border border-border hover:bg-secondary/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                {pageNumbers.map((pn) => (
                  <button
                    key={pn}
                    onClick={() => setPage(pn)}
                    className={`h-7 w-7 rounded-md text-xs font-mono transition-colors ${
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
                  className="p-1.5 rounded-md border border-border hover:bg-secondary/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
