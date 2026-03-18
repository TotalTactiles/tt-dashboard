/**
 * Cashflow Export Modal
 * Provides UI for selecting report type, period, and options before generating PDF.
 */

import { useState, useMemo, useCallback } from "react";
import { pdf } from "@react-pdf/renderer";
import { Download, FileText, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { toast } from "@/hooks/use-toast";
import {
  assembleReportData,
  generateFileName,
  getAvailableMonths,
  getAvailableQuarters,
  type ReportOptions,
} from "@/lib/reportDataAssembler";
import { CashflowReportPDF } from "./CashflowReportPDF";

interface CashflowExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CashflowExportModal({ open, onOpenChange }: CashflowExportModalProps) {
  const { incomeOutgoingsData, kpiStats, profitMarginData, cashflowPositionRaw, expenseCategories } = useDashboardData();

  // Form state
  const [reportType, setReportType] = useState<"monthly" | "quarterly">("monthly");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedQuarter, setSelectedQuarter] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [includeExecutiveSummary, setIncludeExecutiveSummary] = useState(true);
  const [includeDetailTable, setIncludeDetailTable] = useState(true);
  const [includeCharts, setIncludeCharts] = useState(false);
  const [includeCommentary, setIncludeCommentary] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const availableMonths = useMemo(() => getAvailableMonths(incomeOutgoingsData), [incomeOutgoingsData]);
  const availableQuarters = useMemo(() => getAvailableQuarters(incomeOutgoingsData), [incomeOutgoingsData]);

  // Set defaults when data loads
  useMemo(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      // Default to current month if available, otherwise latest
      const now = new Date();
      const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const currentKey = `${MONTHS[now.getMonth()]}-${String(now.getFullYear()).slice(-2)}`;
      const found = availableMonths.find(m => m.key === currentKey);
      setSelectedMonth(found ? found.key : availableMonths[availableMonths.length - 1].key);
    }
    if (availableQuarters.length > 0 && !selectedQuarter) {
      const now = new Date();
      const m = now.getMonth();
      const currentQ = m <= 2 ? "Q1" : m <= 5 ? "Q2" : m <= 8 ? "Q3" : "Q4";
      const found = availableQuarters.find(q => q.key === currentQ && q.year === now.getFullYear());
      if (found) {
        setSelectedQuarter(found.key);
        setSelectedYear(found.year);
      } else if (availableQuarters.length > 0) {
        const last = availableQuarters[availableQuarters.length - 1];
        setSelectedQuarter(last.key);
        setSelectedYear(last.year);
      }
    }
  }, [availableMonths, availableQuarters]);

  const handleDownload = useCallback(async () => {
    setIsGenerating(true);
    try {
      const options: ReportOptions = {
        reportType,
        month: reportType === "monthly" ? selectedMonth : undefined,
        quarter: reportType === "quarterly" ? selectedQuarter : undefined,
        year: reportType === "quarterly" ? selectedYear : undefined,
        includeExecutiveSummary,
        includeDetailTable,
        includeCharts,
        includeCommentary,
      };

      const { data: reportData, errors } = assembleReportData(
        options,
        incomeOutgoingsData,
        kpiStats,
        profitMarginData,
      );

      if (errors.length > 0 || !reportData) {
        toast({
          title: "Export failed",
          description: errors.join(". ") || "Unable to assemble report data.",
          variant: "destructive",
        });
        setIsGenerating(false);
        return;
      }

      // Generate PDF blob
      const blob = await pdf(
        <CashflowReportPDF reportData={reportData} options={options} />
      ).toBlob();

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = generateFileName(reportData);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Report downloaded",
        description: `${generateFileName(reportData)} has been saved.`,
      });

      onOpenChange(false);
    } catch (err) {
      console.error("[PDF Export Error]", err);
      toast({
        title: "Export error",
        description: "An unexpected error occurred while generating the PDF. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [
    reportType, selectedMonth, selectedQuarter, selectedYear,
    includeExecutiveSummary, includeDetailTable, includeCharts, includeCommentary,
    incomeOutgoingsData, kpiStats, profitMarginData, onOpenChange,
  ]);

  const canExport = reportType === "monthly"
    ? !!selectedMonth
    : !!selectedQuarter && !!selectedYear;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Export Cash Flow Report
          </DialogTitle>
          <DialogDescription>
            Generate a professional PDF report from your cash flow data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Report Type */}
          <div className="space-y-2">
            <Label className="text-xs font-mono uppercase text-muted-foreground">Report Type</Label>
            <div className="flex gap-2">
              <Button
                variant={reportType === "monthly" ? "default" : "outline"}
                size="sm"
                onClick={() => setReportType("monthly")}
                className="flex-1"
              >
                Monthly
              </Button>
              <Button
                variant={reportType === "quarterly" ? "default" : "outline"}
                size="sm"
                onClick={() => setReportType("quarterly")}
                className="flex-1"
              >
                Quarterly
              </Button>
            </div>
          </div>

          {/* Period Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-mono uppercase text-muted-foreground">
              {reportType === "monthly" ? "Month" : "Quarter"}
            </Label>
            {reportType === "monthly" ? (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map(m => (
                    <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select
                value={`${selectedQuarter}-${selectedYear}`}
                onValueChange={(v) => {
                  const [q, y] = v.split("-");
                  setSelectedQuarter(q);
                  setSelectedYear(parseInt(y, 10));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select quarter" />
                </SelectTrigger>
                <SelectContent>
                  {availableQuarters.map(q => (
                    <SelectItem key={`${q.key}-${q.year}`} value={`${q.key}-${q.year}`}>
                      {q.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <Label className="text-xs font-mono uppercase text-muted-foreground">Include Sections</Label>

            <div className="flex items-center justify-between">
              <Label htmlFor="exec-summary" className="text-sm">Executive Summary</Label>
              <Switch
                id="exec-summary"
                checked={includeExecutiveSummary}
                onCheckedChange={setIncludeExecutiveSummary}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="detail-table" className="text-sm">Detailed Cash Flow Table</Label>
              <Switch
                id="detail-table"
                checked={includeDetailTable}
                onCheckedChange={setIncludeDetailTable}
              />
            </div>

            <div className="flex items-center justify-between opacity-50">
              <Label htmlFor="charts" className="text-sm">Charts (coming soon)</Label>
              <Switch
                id="charts"
                checked={false}
                disabled
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="commentary" className="text-sm">Commentary Block</Label>
              <Switch
                id="commentary"
                checked={includeCommentary}
                onCheckedChange={setIncludeCommentary}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={handleDownload} disabled={!canExport || isGenerating} className="gap-2">
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
