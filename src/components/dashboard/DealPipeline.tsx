import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, ChevronLeft, ChevronRight, X, Calculator, ChevronDown, Filter } from "lucide-react";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { formatMetricValue } from "@/lib/formatMetricValue";
import { formatDateMonthYear } from "@/lib/formatDate";
import type { PeriodSpec } from "@/lib/projectExecutionKpis";
import NoData from "./NoData";

function getBadgeStyle(rawStatus: string): string {
  const u = (rawStatus ?? "").toUpperCase();
  if (u.includes("COMPLETED"))
    return "bg-emerald-700/40 text-emerald-300 border border-emerald-600/50";
  if (u.includes("PO RECEIVED") || u.includes("GRN"))
    return "bg-green-500/30 text-green-300 border border-green-500/50";
  if (u.includes("VERBAL") || u.includes("YLW"))
    return "bg-yellow-400/30 text-yellow-300 border border-yellow-400/50";
  if (u.includes("NEGOTIATION") || u.includes("REVIEW"))
    return "bg-pink-400/20 text-pink-300 border border-pink-400/40";
  if (u.includes("LOST") || u.includes("DEAD"))
    return "bg-red-500/25 text-red-400 border border-red-500/40";
  return "bg-slate-400/15 text-slate-300 border border-slate-400/30";
}

function getFilterPillStyle(filterValue: string): string {
  switch (filterValue) {
    case "Completed": return "bg-emerald-700/40 text-emerald-300 border-emerald-600/50";
    case "PO Received (GRN)": return "bg-green-500/30 text-green-300 border-green-500/50";
    case "Verbal Confirmation (YLW)": return "bg-yellow-400/30 text-yellow-300 border-yellow-400/50";
    case "Negotiation/Review": return "bg-pink-400/20 text-pink-300 border-pink-400/40";
    case "Lost/Dead": return "bg-red-500/25 text-red-400 border-red-500/40";
    case "Quote Sent": return "bg-slate-400/15 text-slate-300 border-slate-400/30";
    default: return "bg-chart-green/20 text-chart-green border-chart-green/40";
  }
}

type SortOption = "date-closest" | "date-desc" | "date-asc" | "value-desc" | "value-asc" | "company-asc";
type StatusFilter = "all" | "Quote Sent" | "Negotiation/Review" | "Verbal Confirmation (YLW)" | "PO Received (GRN)" | "Completed" | "Lost/Dead";
type DateFilter = "all" | "2026" | "2025" | "Q1" | "Q2" | "Q3" | "Q4";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "date-closest", label: "Closest to today" },
  { value: "date-desc", label: "Date (newest)" },
  { value: "date-asc", label: "Date (oldest)" },
  { value: "value-desc", label: "Value (highest)" },
  { value: "value-asc", label: "Value (lowest)" },
  { value: "company-asc", label: "Company (A–Z)" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Quote Sent", label: "Quote Sent" },
  { value: "Negotiation/Review", label: "Negotiation/Review" },
  { value: "Verbal Confirmation (YLW)", label: "Verbal Confirmation (YLW)" },
  { value: "PO Received (GRN)", label: "PO Received (GRN)" },
  { value: "Completed", label: "Completed" },
  { value: "Lost/Dead", label: "Lost/Dead" },
];

const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "2026", label: "2026" },
  { value: "2025", label: "2025" },
  { value: "Q1", label: "Q1" },
  { value: "Q2", label: "Q2" },
  { value: "Q3", label: "Q3" },
  { value: "Q4", label: "Q4" },
];

const ITEMS_PER_PAGE = 10;

function parseDateForFilter(raw: string): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  const dmyMatch = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
  if (dmyMatch) return new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function getQuarter(month: number): number {
  return Math.floor(month / 3) + 1;
}

interface DealPipelineProps {
  periodFilter?: PeriodSpec | null;
  showAll?: boolean;
  onAllToggle?: (allOn: boolean) => void;
}

const DealPipeline = ({ periodFilter, showAll = false, onAllToggle }: DealPipelineProps) => {
  const { quotedJobs, dataHealth } = useDashboardData();
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("date-closest");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const hasActiveFilters = sortBy !== "date-closest" || statusFilter !== "all" || dateFilter !== "all";
  const activeFilterCount = [sortBy !== "date-closest", statusFilter !== "all", dateFilter !== "all"].filter(Boolean).length;

  const totalValue = useMemo(() => quotedJobs.reduce((s, j) => s + j.value, 0), [quotedJobs]);

  const clearFilters = useCallback(() => {
    setSortBy("date-closest");
    setStatusFilter("all");
    setDateFilter("all");
    setPage(1);
  }, []);

  const filteredJobs = useMemo(() => {
    let jobs = [...quotedJobs];

    // Period filter from Project Execution KPIs (unless "All" is toggled)
    if (!showAll && periodFilter && periodFilter.months.length > 0) {
      const monthSet = new Set(periodFilter.months);
      const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      jobs = jobs.filter((j) => {
        const d = parseDateForFilter(j.dateQuoted);
        if (!d) return false;
        const key = `${MONTH_ABBR[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
        return monthSet.has(key);
      });
    }

    if (statusFilter !== "all") {
      jobs = jobs.filter((j) => j.rawStatus === statusFilter);
    }
    if (dateFilter !== "all") {
      const currentYear = new Date().getFullYear();
      jobs = jobs.filter((j) => {
        const d = parseDateForFilter(j.dateQuoted);
        if (!d) return false;
        if (dateFilter === "2026") return d.getFullYear() === 2026;
        if (dateFilter === "2025") return d.getFullYear() === 2025;
        const q = getQuarter(d.getMonth());
        if (dateFilter === "Q1") return d.getFullYear() === currentYear && q === 1;
        if (dateFilter === "Q2") return d.getFullYear() === currentYear && q === 2;
        if (dateFilter === "Q3") return d.getFullYear() === currentYear && q === 3;
        if (dateFilter === "Q4") return d.getFullYear() === currentYear && q === 4;
        return true;
      });
    }
    jobs.sort((a, b) => {
      switch (sortBy) {
        case "date-closest": {
          const today = Date.now();
          const diffA = parseDateForFilter(a.dateQuoted) ? Math.abs(parseDateForFilter(a.dateQuoted)!.getTime() - today) : Infinity;
          const diffB = parseDateForFilter(b.dateQuoted) ? Math.abs(parseDateForFilter(b.dateQuoted)!.getTime() - today) : Infinity;
          return diffA - diffB;
        }
        case "date-desc": return (parseDateForFilter(b.dateQuoted)?.getTime() ?? 0) - (parseDateForFilter(a.dateQuoted)?.getTime() ?? 0);
        case "date-asc": return (parseDateForFilter(a.dateQuoted)?.getTime() ?? 0) - (parseDateForFilter(b.dateQuoted)?.getTime() ?? 0);
        case "value-desc": return b.value - a.value;
        case "value-asc": return a.value - b.value;
        case "company-asc": return a.company.localeCompare(b.company);
        default: return 0;
      }
    });
    return jobs;
  }, [quotedJobs, statusFilter, dateFilter, sortBy, showAll, periodFilter]);

  const filteredTotal = useMemo(() => filteredJobs.reduce((s, j) => s + j.value, 0), [filteredJobs]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageJobs = filteredJobs.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  const toggleCardExpand = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderFilterContent = () => (
    <div className="space-y-3">
      {/* Sort */}
      <div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Sort by</span>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setSortBy(opt.value); setPage(1); }}
              className={`text-[11px] px-2 py-1.5 md:py-1 rounded-full border transition-colors font-mono touch-target md:min-h-0 md:min-w-0 ${
                sortBy === opt.value
                  ? "bg-chart-green/20 text-chart-green border-chart-green/40"
                  : "border-border text-muted-foreground hover:bg-secondary/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {/* Status */}
      <div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Status</span>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setStatusFilter(opt.value); setPage(1); }}
              className={`text-[11px] px-2 py-1.5 md:py-1 rounded-full border transition-colors font-mono touch-target md:min-h-0 md:min-w-0 ${
                statusFilter === opt.value
                  ? getFilterPillStyle(opt.value)
                  : "border-border text-muted-foreground hover:bg-secondary/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {/* Date */}
      <div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Date</span>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {DATE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setDateFilter(opt.value); setPage(1); }}
              className={`text-[11px] px-2 py-1.5 md:py-1 rounded-full border transition-colors font-mono touch-target md:min-h-0 md:min-w-0 ${
                dateFilter === opt.value
                  ? "bg-chart-green/20 text-chart-green border-chart-green/40"
                  : "border-border text-muted-foreground hover:bg-secondary/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
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
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="chart-container col-span-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-fluid-sm font-medium text-muted-foreground">Quoted Jobs</h3>
          {periodFilter && (
            <button
              onClick={() => { const next = !showAll; onAllToggle?.(next); setPage(1); }}
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
          <span className="text-xs font-mono text-muted-foreground hidden sm:inline">{filteredJobs.length} jobs</span>
          {/* Mobile filter button */}
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
            <div className="mb-4 p-3 rounded-lg bg-secondary/30 border border-border/50">
              {renderFilterContent()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {quotedJobs.length === 0 ? (
        <NoData message="No quote data" healthStatus={dataHealth.quotes.status} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="desktop-table overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground font-mono border-b border-border">
                  <th className="pb-3 pr-4">Company</th>
                  <th className="pb-3 pr-4">Project</th>
                  <th className="pb-3 pr-4 text-right">Value</th>
                  <th className="pb-3 pr-4 text-center">Status</th>
                  <th className="pb-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {pageJobs.map((job, i) => (
                  <motion.tr
                    key={job.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                   className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${
                      i % 2 === 1 ? "bg-secondary/[0.06]" : ""
                    }`}
                  >
                    <td className="py-3.5 pr-4 font-medium">{job.company}</td>
                    <td className="py-3.5 pr-4 text-muted-foreground">{job.project}</td>
                    <td className="py-3.5 pr-4 text-right font-mono">
                      {job.value > 0 ? formatMetricValue(job.value, "currency") : "TBC"}
                    </td>
                    <td className="py-3.5 pr-4 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${getBadgeStyle(job.rawStatus)}`}>
                        {job.rawStatus || "Unknown"}
                      </span>
                    </td>
                    <td className="py-3.5 font-mono text-xs text-muted-foreground">
                      {formatDateMonthYear(job.dateQuoted)}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-chart-green/60" style={{ backgroundColor: "rgba(16, 185, 129, 0.05)" }}>
                  <td colSpan={2} className="py-3 pr-4 font-mono font-bold text-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calculator className="h-3.5 w-3.5 text-chart-green" />
                      Total ({filteredJobs.length} jobs)
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-base font-bold text-chart-green">
                    {filteredTotal > 0 ? formatMetricValue(filteredTotal, "currency") : "TBC"}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile card layout */}
          <div className="mobile-card-table space-y-2">
            {pageJobs.map((job) => {
              const isExpanded = expandedCards.has(job.id);
              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-border/50 rounded-lg p-3 bg-secondary/10"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{job.company}</p>
                      <p className="text-xs text-muted-foreground truncate">{job.project}</p>
                    </div>
                    <span className="font-mono text-sm font-bold text-foreground whitespace-nowrap">
                      {job.value > 0 ? formatMetricValue(job.value, "currency") : "TBC"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${getBadgeStyle(job.rawStatus)}`}>
                      {job.rawStatus || "Unknown"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">{formatDateMonthYear(job.dateQuoted)}</span>
                      <button onClick={() => toggleCardExpand(job.id)} className="text-muted-foreground">
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            {/* Mobile total card */}
            <div className="border border-chart-green/30 rounded-lg p-3" style={{ backgroundColor: "rgba(16, 185, 129, 0.05)" }}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-mono font-bold text-sm text-foreground">
                  <Calculator className="h-3.5 w-3.5 text-chart-green" />
                  Total ({filteredJobs.length} jobs)
                </span>
                <span className="font-mono font-bold text-sm text-chart-green">
                  {filteredTotal > 0 ? formatMetricValue(filteredTotal, "currency") : "TBC"}
                </span>
              </div>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
            <span className="text-xs text-muted-foreground font-mono">
              {startIdx + 1}–{Math.min(startIdx + ITEMS_PER_PAGE, filteredJobs.length)} of {filteredJobs.length}
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
        </>
      )}
    </motion.div>
  );
};

export default DealPipeline;
