import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, ChevronLeft, ChevronRight, X, Calculator } from "lucide-react";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { formatMetricValue } from "@/lib/formatMetricValue";
import { formatDateMonthYear } from "@/lib/formatDate";
import NoData from "./NoData";

const statusStyles: Record<string, string> = {
  invoiced: "bg-chart-green/20 text-chart-green border-chart-green/40",
  pending: "bg-chart-amber/20 text-chart-amber border-chart-amber/40",
  overdue: "bg-chart-red/20 text-chart-red border-chart-red/40",
};

type SortOption = "date-closest" | "date-desc" | "date-asc" | "value-desc" | "value-asc" | "gp-desc" | "company-asc";
type StatusFilter = "all" | "invoiced" | "pending" | "overdue";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "date-closest", label: "Closest to today" },
  { value: "date-desc", label: "Invoice Date (newest)" },
  { value: "date-asc", label: "Invoice Date (oldest)" },
  { value: "value-desc", label: "Value (highest)" },
  { value: "value-asc", label: "Value (lowest)" },
  { value: "gp-desc", label: "GP% (highest)" },
  { value: "company-asc", label: "Company (A–Z)" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "invoiced", label: "Invoiced" },
  { value: "overdue", label: "Overdue" },
];

function getStatusPillStyle(value: string): string {
  switch (value) {
    case "invoiced": return "bg-chart-green/20 text-chart-green border-chart-green/40";
    case "overdue": return "bg-chart-red/20 text-chart-red border-chart-red/40";
    case "pending": return "bg-chart-amber/20 text-chart-amber border-chart-amber/40";
    default: return "bg-chart-green/20 text-chart-green border-chart-green/40";
  }
}

function parseDateForSort(raw: string): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  const dmyMatch = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
  if (dmyMatch) return new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
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
  const [companyFilter, setCompanyFilter] = useState<string>("all");

  const hasActiveFilters = sortBy !== "date-closest" || statusFilter !== "all" || stageFilter !== "all" || monthFilter !== "all" || companyFilter !== "all";

  const clearFilters = useCallback(() => {
    setSortBy("date-closest");
    setStatusFilter("all");
    setStageFilter("all");
    setMonthFilter("all");
    setCompanyFilter("all");
    setPage(1);
  }, []);

  // Dynamic filter options
  const uniqueStages = useMemo(() => {
    const stages = [...new Set(revenueProjects.map(p => p.projectStage).filter(Boolean))].sort();
    return stages;
  }, [revenueProjects]);

  const uniqueMonths = useMemo(() => {
    const months = [...new Set(revenueProjects.map(p => formatDateMonthYear(p.invoiceDate)).filter(Boolean))];
    // Sort by date
    months.sort((a, b) => {
      const da = new Date(a);
      const db = new Date(b);
      if (!isNaN(da.getTime()) && !isNaN(db.getTime())) return da.getTime() - db.getTime();
      return a.localeCompare(b);
    });
    return months;
  }, [revenueProjects]);

  const uniqueCompanies = useMemo(() => {
    return [...new Set(revenueProjects.map(p => p.company).filter(Boolean))].sort();
  }, [revenueProjects]);

  // Filter + sort
  const filteredProjects = useMemo(() => {
    let projects = [...revenueProjects];

    if (statusFilter !== "all") {
      projects = projects.filter(p => p.status === statusFilter);
    }
    if (stageFilter !== "all") {
      projects = projects.filter(p => p.projectStage === stageFilter);
    }
    if (monthFilter !== "all") {
      projects = projects.filter(p => formatDateMonthYear(p.invoiceDate) === monthFilter);
    }
    if (companyFilter !== "all") {
      projects = projects.filter(p => p.company === companyFilter);
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
  }, [revenueProjects, statusFilter, stageFilter, monthFilter, companyFilter, sortBy]);

  // Filtered totals
  const totalRevenue = filteredProjects.reduce((sum, p) => sum + p.valueExclGST, 0);
  const totalCOGS = filteredProjects.reduce((sum, p) => sum + p.totalCOGS, 0);
  const totalGP = filteredProjects.reduce((sum, p) => sum + p.grossProfit, 0);

  // Pagination
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

  const renderPillRow = (
    label: string,
    options: { value: string; label: string }[],
    current: string,
    onChange: (v: string) => void,
    getStyle?: (v: string) => string,
  ) => (
    <div>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{label}</span>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { onChange(opt.value); setPage(1); }}
            className={`text-[11px] px-2 py-1 rounded-full border transition-colors font-mono ${
              current === opt.value
                ? (getStyle ? getStyle(opt.value) : "bg-chart-green/20 text-chart-green border-chart-green/40")
                : "border-border text-muted-foreground hover:bg-secondary/50"
            }`}
          >
            {opt.label}
          </button>
        ))}
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
        <h3 className="text-sm font-medium text-muted-foreground">
          Revenue & COGS{filteredProjects.length > 0 && ` — ${filteredProjects.length} projects`}
        </h3>
        <div className="flex items-center gap-2">
          {filteredProjects.length > 0 && (
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-muted-foreground">
                Revenue: <span className="text-chart-green">${totalRevenue.toLocaleString()}</span>
              </span>
              <span className="text-muted-foreground">
                COGS: <span className="text-chart-red">${totalCOGS.toLocaleString()}</span>
              </span>
              <span className="text-muted-foreground">
                GP: <span className="text-chart-blue">${totalGP.toLocaleString()}</span>
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
              {renderPillRow("Sort by", SORT_OPTIONS.map(o => ({ value: o.value, label: o.label })), sortBy, (v) => setSortBy(v as SortOption))}

              {renderPillRow(
                "Status",
                STATUS_OPTIONS.map(o => ({ value: o.value, label: o.label })),
                statusFilter,
                (v) => setStatusFilter(v as StatusFilter),
                (v) => v === "all" ? "bg-chart-green/20 text-chart-green border-chart-green/40" : getStatusPillStyle(v),
              )}

              {uniqueStages.length > 0 && renderPillRow(
                "Project Stage",
                [{ value: "all", label: "All" }, ...uniqueStages.map(s => ({ value: s, label: s }))],
                stageFilter,
                setStageFilter,
              )}

              {renderPillRow(
                "Invoice Month",
                [{ value: "all", label: "All time" }, ...uniqueMonths.map(m => ({ value: m, label: m }))],
                monthFilter,
                setMonthFilter,
              )}

              {renderPillRow(
                "Company",
                [{ value: "all", label: "All" }, ...uniqueCompanies.map(c => ({ value: c, label: c }))],
                companyFilter,
                setCompanyFilter,
              )}

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
                {pageProjects.map((proj, i) => (
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
                      {proj.stageValue > 0 ? `$${proj.stageValue.toLocaleString()}` : ""}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono">${proj.valueInclGST.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-right font-mono">${proj.valueExclGST.toLocaleString()}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{proj.invoiceDate}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{proj.dueDate}</td>
                    <td className="py-3 pr-4 text-right font-mono text-chart-red">${proj.labourCost.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-right font-mono text-chart-red">${proj.tactileCost.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-right font-mono text-chart-red">${proj.otherCost.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-right font-mono text-chart-red">${proj.totalCOGS.toLocaleString()}</td>
                    <td className={`py-3 pr-4 text-right font-mono ${proj.grossProfit >= 0 ? "text-chart-green" : "text-chart-red"}`}>${proj.grossProfit.toLocaleString()}</td>
                    <td className="py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-mono capitalize ${statusStyles[proj.status]}`}>
                        {proj.status}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
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
