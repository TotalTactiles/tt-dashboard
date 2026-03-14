import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, ChevronLeft, ChevronRight, X, Calculator } from "lucide-react";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { formatMetricValue } from "@/lib/formatMetricValue";
import { formatDateMonthYear } from "@/lib/formatDate";
import NoData from "./NoData";

function getBadgeStyle(rawStatus: string): string {
  const u = (rawStatus ?? "").toUpperCase();
  if (u.includes("PO RECEIVED") || u.includes("GRN") || u === "COMPLETED" || u.includes("COMPLETED"))
    return "bg-chart-green/20 text-chart-green border border-chart-green/30";
  if (u.includes("LOST") || u.includes("DEAD"))
    return "bg-chart-red/20 text-chart-red border border-chart-red/30";
  if (u.includes("VERBAL") || u.includes("YLW"))
    return "bg-chart-amber/20 text-chart-amber border border-chart-amber/30";
  return "bg-secondary text-muted-foreground border border-border";
}

type SortOption = "date-desc" | "date-asc" | "value-desc" | "value-asc" | "company-asc";
type StatusFilter = "all" | "Quote Sent" | "Negotiation/Review" | "Verbal Confirmation (YLW)" | "PO Received (GRN)" | "Completed" | "Lost/Dead";
type DateFilter = "all" | "2026" | "2025" | "Q1" | "Q2" | "Q3" | "Q4";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
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
  // DD-MM-YYYY or DD/MM/YYYY with optional time
  const dmyMatch = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
  if (dmyMatch) return new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function getQuarter(month: number): number {
  return Math.floor(month / 3) + 1;
}

const DealPipeline = () => {
  const { quotedJobs, dataHealth } = useDashboardData();
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("date-desc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const hasActiveFilters = sortBy !== "date-desc" || statusFilter !== "all" || dateFilter !== "all";

  // Total value for cross-check
  const totalValue = useMemo(() => quotedJobs.reduce((s, j) => s + j.value, 0), [quotedJobs]);

  const clearFilters = useCallback(() => {
    setSortBy("date-desc");
    setStatusFilter("all");
    setDateFilter("all");
    setPage(1);
  }, []);

  const filteredJobs = useMemo(() => {
    let jobs = [...quotedJobs];

    // Status filter
    if (statusFilter !== "all") {
      jobs = jobs.filter((j) => j.rawStatus === statusFilter);
    }

    // Date filter
    if (dateFilter !== "all") {
      const currentYear = new Date().getFullYear();
      jobs = jobs.filter((j) => {
        const d = parseDateForFilter(j.dateQuoted);
        if (!d) return false;
        if (dateFilter === "2026") return d.getFullYear() === 2026;
        if (dateFilter === "2025") return d.getFullYear() === 2025;
        // Quarter filters apply to current year
        const q = getQuarter(d.getMonth());
        if (dateFilter === "Q1") return d.getFullYear() === currentYear && q === 1;
        if (dateFilter === "Q2") return d.getFullYear() === currentYear && q === 2;
        if (dateFilter === "Q3") return d.getFullYear() === currentYear && q === 3;
        if (dateFilter === "Q4") return d.getFullYear() === currentYear && q === 4;
        return true;
      });
    }

    // Sort
    jobs.sort((a, b) => {
      switch (sortBy) {
        case "date-desc": {
          const da = parseDateForFilter(a.dateQuoted)?.getTime() ?? 0;
          const db = parseDateForFilter(b.dateQuoted)?.getTime() ?? 0;
          return db - da;
        }
        case "date-asc": {
          const da = parseDateForFilter(a.dateQuoted)?.getTime() ?? 0;
          const db = parseDateForFilter(b.dateQuoted)?.getTime() ?? 0;
          return da - db;
        }
        case "value-desc":
          return b.value - a.value;
        case "value-asc":
          return a.value - b.value;
        case "company-asc":
          return a.company.localeCompare(b.company);
        default:
          return 0;
      }
    });

    return jobs;
  }, [quotedJobs, statusFilter, dateFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageJobs = filteredJobs.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  // Generate page numbers to show
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="chart-container col-span-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">Quoted Jobs</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">{quotedJobs.length} jobs</span>
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
              {/* Sort */}
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Sort by</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setSortBy(opt.value); setPage(1); }}
                      className={`text-[11px] px-2 py-1 rounded-full border transition-colors font-mono ${
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
              {/* Status filter */}
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Status</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setStatusFilter(opt.value); setPage(1); }}
                      className={`text-[11px] px-2 py-1 rounded-full border transition-colors font-mono ${
                        statusFilter === opt.value
                          ? "bg-chart-green/20 text-chart-green border-chart-green/40"
                          : "border-border text-muted-foreground hover:bg-secondary/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Date filter */}
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Date</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {DATE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setDateFilter(opt.value); setPage(1); }}
                      className={`text-[11px] px-2 py-1 rounded-full border transition-colors font-mono ${
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
              {/* Clear */}
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


      {quotedJobs.length === 0 ? (
        <NoData message="No quote data" healthStatus={dataHealth.quotes.status} />
      ) : (
        <>
          <div className="overflow-x-auto">
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
                      i % 2 === 1 ? "bg-secondary/10" : ""
                    }`}
                  >
                    <td className="py-3 pr-4 font-medium">{job.company}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{job.project}</td>
                    <td className="py-3 pr-4 text-right font-mono">
                      {job.value > 0 ? formatMetricValue(job.value, "currency") : "TBC"}
                    </td>
                    <td className="py-3 pr-4 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${getBadgeStyle(job.rawStatus)}`}>
                        {job.rawStatus || "Unknown"}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-xs text-muted-foreground">
                      {formatDateMonthYear(job.dateQuoted)}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
              {/* Total row */}
              <tfoot>
                <tr className="border-t-2 border-chart-green/60" style={{ backgroundColor: "rgba(16, 185, 129, 0.05)" }}>
                  <td colSpan={2} className="py-3 pr-4 font-mono font-bold text-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calculator className="h-3.5 w-3.5 text-chart-green" />
                      Total ({quotedJobs.length} jobs)
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-base font-bold text-chart-green">
                    {totalValue > 0 ? formatMetricValue(totalValue, "currency") : "TBC"}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
            <span className="text-xs text-muted-foreground font-mono">
              Showing {startIdx + 1}–{Math.min(startIdx + ITEMS_PER_PAGE, filteredJobs.length)} of {filteredJobs.length} jobs
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
        </>
      )}
    </motion.div>
  );
};

export default DealPipeline;
