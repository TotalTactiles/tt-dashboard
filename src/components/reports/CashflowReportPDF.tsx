/**
 * Cashflow Report PDF Template
 * Uses @react-pdf/renderer for programmatic, production-grade PDF generation.
 * Styled to match a professional management report aesthetic.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type {
  ReportData,
  MonthlyReportData,
  QuarterlyReportData,
  ReportOptions,
} from "@/lib/reportDataAssembler";
import {
  formatReportCurrency,
  formatReportPercent,
  monthKeyToLabel,
  getQuarterEndLabel,
} from "@/lib/reportDataAssembler";

// ---- Fonts ----
Font.register({
  family: "Helvetica",
  fonts: [
    { src: "https://cdn.jsdelivr.net/npm/@canvas-fonts/helvetica@1.0.4/Helvetica.ttf", fontWeight: 400 },
    { src: "https://cdn.jsdelivr.net/npm/@canvas-fonts/helvetica@1.0.4/Helvetica-Bold.ttf", fontWeight: 700 },
  ],
});

// ---- Palette ----
const BRAND_GREEN = "#1a7a4c";
const BRAND_GREEN_LIGHT = "#e8f5ee";
const TEXT_BLACK = "#1a1a1a";
const TEXT_GREY = "#666666";
const BORDER_GREY = "#d1d5db";
const RED_TEXT = "#c0392b";

// ---- Styles ----
const s = StyleSheet.create({
  page: {
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 50,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: TEXT_BLACK,
    backgroundColor: "#ffffff",
  },
  // Cover
  coverPage: {
    paddingTop: 180,
    paddingBottom: 60,
    paddingHorizontal: 50,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },
  coverTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: BRAND_GREEN,
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 16,
    color: TEXT_BLACK,
    marginBottom: 6,
  },
  coverCompany: {
    fontSize: 14,
    color: TEXT_GREY,
    marginBottom: 4,
  },
  coverMeta: {
    fontSize: 10,
    color: TEXT_GREY,
    marginTop: 20,
  },
  coverDivider: {
    height: 3,
    backgroundColor: BRAND_GREEN,
    marginVertical: 20,
    width: 80,
  },
  // Section headings
  sectionHeading: {
    fontSize: 14,
    fontWeight: 700,
    color: BRAND_GREEN,
    marginTop: 20,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: BRAND_GREEN,
  },
  subHeading: {
    fontSize: 11,
    fontWeight: 700,
    color: TEXT_BLACK,
    marginTop: 12,
    marginBottom: 6,
  },
  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: BRAND_GREEN_LIGHT,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_GREY,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: "#fafafa",
  },
  tableTotalRow: {
    flexDirection: "row",
    borderTopWidth: 1.5,
    borderTopColor: TEXT_BLACK,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 2,
  },
  cellLabel: {
    width: "40%",
    fontSize: 10,
    color: TEXT_BLACK,
  },
  cellLabelBold: {
    width: "40%",
    fontSize: 10,
    fontWeight: 700,
    color: TEXT_BLACK,
  },
  cellValue: {
    width: "20%",
    fontSize: 10,
    textAlign: "right",
    color: TEXT_BLACK,
  },
  cellValueBold: {
    width: "20%",
    fontSize: 10,
    fontWeight: 700,
    textAlign: "right",
    color: TEXT_BLACK,
  },
  headerCell: {
    fontSize: 9,
    fontWeight: 700,
    color: BRAND_GREEN,
    textTransform: "uppercase",
  },
  // KPI cards
  kpiRow: {
    flexDirection: "row",
    marginVertical: 8,
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER_GREY,
    borderRadius: 4,
    padding: 12,
  },
  kpiLabel: {
    fontSize: 8,
    color: TEXT_GREY,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: 700,
    color: TEXT_BLACK,
  },
  kpiChange: {
    fontSize: 8,
    color: TEXT_GREY,
    marginTop: 3,
  },
  // Body text
  bodyText: {
    fontSize: 10,
    lineHeight: 1.5,
    color: TEXT_BLACK,
    marginBottom: 6,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 25,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: BORDER_GREY,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 8,
    color: TEXT_GREY,
  },
  // Neg value
  negValue: {
    color: RED_TEXT,
  },
});

// ---- Helper components ----

function Footer() {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>Management Report | Total Tactiles Pty Ltd</Text>
      <Text
        style={s.footerText}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}

function CurrencyCell({ value, bold = false }: { value: number; bold?: boolean }) {
  const isNeg = value < 0;
  return (
    <Text style={[bold ? s.cellValueBold : s.cellValue, isNeg ? s.negValue : {}]}>
      {formatReportCurrency(value)}
    </Text>
  );
}

function TableRow({
  label,
  values,
  bold = false,
  isTotal = false,
  alt = false,
}: {
  label: string;
  values: number[];
  bold?: boolean;
  isTotal?: boolean;
  alt?: boolean;
}) {
  const rowStyle = isTotal ? s.tableTotalRow : alt ? s.tableRowAlt : s.tableRow;
  return (
    <View style={rowStyle}>
      <Text style={bold ? s.cellLabelBold : s.cellLabel}>{label}</Text>
      {values.map((v, i) => (
        <CurrencyCell key={i} value={v} bold={bold || isTotal} />
      ))}
    </View>
  );
}

// ---- Cover Page ----

function CoverPage({ reportData, options }: { reportData: ReportData; options: ReportOptions }) {
  const periodEnd = reportData.type === "monthly"
    ? `For the month ended ${reportData.periodLabel}`
    : `For the quarter ended ${getQuarterEndLabel(reportData.quarterKey, reportData.year)}`;

  return (
    <Page size="A4" style={s.coverPage}>
      <Text style={s.coverTitle}>Cash Flow Report</Text>
      <View style={s.coverDivider} />
      <Text style={s.coverSubtitle}>{periodEnd}</Text>
      <Text style={s.coverCompany}>Total Tactiles Pty Ltd</Text>
      <Text style={s.coverMeta}>ABN: 12 345 678 901</Text>
      <Text style={s.coverMeta}>
        Report type: {reportData.type === "monthly" ? "Monthly" : "Quarterly"}
      </Text>
      <Text style={[s.coverMeta, { marginTop: 40 }]}>
        Generated: {new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
      </Text>
      <Footer />
    </Page>
  );
}

// ---- Contents Page ----

function ContentsPage({ options }: { options: ReportOptions }) {
  const items = ["Cash Flow Report Cover"];
  items.push("Contents");
  if (options.includeExecutiveSummary) items.push("Executive Summary");
  items.push("Cash Flow Overview");
  if (options.includeDetailTable) items.push("Monthly Cash Flow Detail");
  if (options.includeCommentary) items.push("Commentary");

  return (
    <Page size="A4" style={s.page}>
      <Text style={s.sectionHeading}>Contents</Text>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" }}>
          <Text style={s.bodyText}>{item}</Text>
          <Text style={[s.bodyText, { color: TEXT_GREY }]}>{i + 1}</Text>
        </View>
      ))}
      <Footer />
    </Page>
  );
}

// ---- Executive Summary Page ----

function ExecutiveSummaryPage({ reportData }: { reportData: ReportData }) {
  if (reportData.type === "monthly") {
    const d = reportData as MonthlyReportData;
    return (
      <Page size="A4" style={s.page}>
        <Text style={s.sectionHeading}>Executive Summary</Text>
        <Text style={s.bodyText}>
          This report presents the cash flow performance for {d.periodLabel}.
        </Text>

        <View style={s.kpiRow}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Cash Received</Text>
            <Text style={s.kpiValue}>
              {d.current ? formatReportCurrency(d.current.income) : "N/A"}
            </Text>
            {d.varianceIncomePercent !== null && (
              <Text style={s.kpiChange}>
                {d.varianceIncomePercent >= 0 ? "+" : ""}{d.varianceIncomePercent}% vs prior month
              </Text>
            )}
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Cash Spent</Text>
            <Text style={s.kpiValue}>
              {d.current ? formatReportCurrency(d.current.outgoings) : "N/A"}
            </Text>
            {d.varianceOutgoingsPercent !== null && (
              <Text style={s.kpiChange}>
                {d.varianceOutgoingsPercent >= 0 ? "+" : ""}{d.varianceOutgoingsPercent}% vs prior month
              </Text>
            )}
          </View>
        </View>

        <View style={s.kpiRow}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Cash Surplus / (Deficit)</Text>
            <Text style={[s.kpiValue, d.current && d.current.surplus < 0 ? s.negValue : {}]}>
              {d.current ? formatReportCurrency(d.current.surplus) : "N/A"}
            </Text>
            {d.varianceSurplusPercent !== null && (
              <Text style={s.kpiChange}>
                {d.varianceSurplusPercent >= 0 ? "+" : ""}{d.varianceSurplusPercent}% vs prior month
              </Text>
            )}
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Cashflow Position</Text>
            <Text style={[s.kpiValue, d.cashflowPosition !== null && d.cashflowPosition < 0 ? s.negValue : {}]}>
              {d.cashflowPosition !== null ? formatReportCurrency(d.cashflowPosition) : "N/A"}
            </Text>
          </View>
        </View>

        {d.grossProfitMargin !== null && (
          <View style={[s.kpiRow, { marginTop: 4 }]}>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>Gross Profit Margin</Text>
              <Text style={s.kpiValue}>{formatReportPercent(d.grossProfitMargin)}</Text>
            </View>
            <View style={{ flex: 1 }} />
          </View>
        )}

        <Footer />
      </Page>
    );
  }

  // Quarterly
  const d = reportData as QuarterlyReportData;
  return (
    <Page size="A4" style={s.page}>
      <Text style={s.sectionHeading}>Executive Summary</Text>
      <Text style={s.bodyText}>
        This report presents the cash flow performance for {d.periodLabel} ({d.months.length} month{d.months.length !== 1 ? "s" : ""} of data).
      </Text>

      <View style={s.kpiRow}>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Total Cash Received</Text>
          <Text style={s.kpiValue}>{formatReportCurrency(d.summary.totalIncome)}</Text>
          <Text style={s.kpiChange}>Avg: {formatReportCurrency(d.summary.avgIncome)}/month</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Total Cash Spent</Text>
          <Text style={s.kpiValue}>{formatReportCurrency(d.summary.totalOutgoings)}</Text>
          <Text style={s.kpiChange}>Avg: {formatReportCurrency(d.summary.avgOutgoings)}/month</Text>
        </View>
      </View>

      <View style={s.kpiRow}>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Total Surplus / (Deficit)</Text>
          <Text style={[s.kpiValue, d.summary.totalSurplus < 0 ? s.negValue : {}]}>
            {formatReportCurrency(d.summary.totalSurplus)}
          </Text>
          <Text style={s.kpiChange}>Avg: {formatReportCurrency(d.summary.avgSurplus)}/month</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Cashflow Position</Text>
          <Text style={[s.kpiValue, d.cashflowPosition !== null && d.cashflowPosition < 0 ? s.negValue : {}]}>
            {d.cashflowPosition !== null ? formatReportCurrency(d.cashflowPosition) : "N/A"}
          </Text>
        </View>
      </View>

      {d.grossProfitMargin !== null && (
        <View style={[s.kpiRow, { marginTop: 4 }]}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Avg Gross Profit Margin</Text>
            <Text style={s.kpiValue}>{formatReportPercent(d.grossProfitMargin)}</Text>
          </View>
          <View style={{ flex: 1 }} />
        </View>
      )}

      <Footer />
    </Page>
  );
}

// ---- Cash Flow Overview ----

function CashFlowOverviewPage({ reportData }: { reportData: ReportData }) {
  if (reportData.type === "monthly") {
    const d = reportData as MonthlyReportData;
    const hasPrev = !!d.previous;

    return (
      <Page size="A4" style={s.page}>
        <Text style={s.sectionHeading}>Cash Flow Overview</Text>
        <Text style={s.bodyText}>{d.periodLabel}</Text>

        {/* Table header */}
        <View style={s.tableHeader}>
          <Text style={[s.headerCell, { width: "40%" }]}> </Text>
          <Text style={[s.headerCell, { width: "20%", textAlign: "right" }]}>Current Month</Text>
          {hasPrev && <Text style={[s.headerCell, { width: "20%", textAlign: "right" }]}>Prior Month</Text>}
          {hasPrev && <Text style={[s.headerCell, { width: "20%", textAlign: "right" }]}>Variance</Text>}
        </View>

        <Text style={s.subHeading}>Cash</Text>

        <TableRow
          label="Cash received"
          values={hasPrev
            ? [d.current!.income, d.previous!.income, d.varianceIncome!]
            : [d.current!.income]}
        />
        <TableRow
          label="Cash spent"
          values={hasPrev
            ? [d.current!.outgoings, d.previous!.outgoings, d.varianceOutgoings!]
            : [d.current!.outgoings]}
        />
        <TableRow
          label="Cash surplus / (deficit)"
          values={hasPrev
            ? [d.current!.surplus, d.previous!.surplus, d.varianceSurplus!]
            : [d.current!.surplus]}
          bold
          isTotal
        />

        {d.cashflowPosition !== null && (
          <>
            <Text style={s.subHeading}>Position</Text>
            <TableRow
              label="Cashflow position"
              values={[d.cashflowPosition]}
              bold
            />
          </>
        )}

        {d.grossProfitMargin !== null && (
          <>
            <Text style={s.subHeading}>Performance</Text>
            <View style={s.tableRow}>
              <Text style={s.cellLabel}>Gross profit margin</Text>
              <Text style={s.cellValue}>{formatReportPercent(d.grossProfitMargin)}</Text>
            </View>
          </>
        )}

        <Footer />
      </Page>
    );
  }

  // Quarterly
  const d = reportData as QuarterlyReportData;
  return (
    <Page size="A4" style={s.page}>
      <Text style={s.sectionHeading}>Cash Flow Overview</Text>
      <Text style={s.bodyText}>{d.periodLabel} — Quarter Summary</Text>

      {/* Table header */}
      <View style={s.tableHeader}>
        <Text style={[s.headerCell, { width: "40%" }]}> </Text>
        {d.months.map(m => (
          <Text key={m.month} style={[s.headerCell, { width: `${60 / Math.max(d.months.length + 1, 1)}%`, textAlign: "right" }]}>
            {m.month}
          </Text>
        ))}
        <Text style={[s.headerCell, { width: `${60 / Math.max(d.months.length + 1, 1)}%`, textAlign: "right" }]}>
          Total
        </Text>
      </View>

      <Text style={s.subHeading}>Cash</Text>

      <TableRow
        label="Cash received"
        values={[...d.months.map(m => m.income), d.summary.totalIncome]}
      />
      <TableRow
        label="Cash spent"
        values={[...d.months.map(m => m.outgoings), d.summary.totalOutgoings]}
        alt
      />
      <TableRow
        label="Cash surplus / (deficit)"
        values={[...d.months.map(m => m.surplus), d.summary.totalSurplus]}
        bold
        isTotal
      />

      {d.cashflowPosition !== null && (
        <>
          <Text style={s.subHeading}>Position</Text>
          <View style={s.tableRow}>
            <Text style={s.cellLabelBold}>Cashflow position (current month)</Text>
            <Text style={[s.cellValueBold, d.cashflowPosition < 0 ? s.negValue : {}]}>
              {formatReportCurrency(d.cashflowPosition)}
            </Text>
          </View>
        </>
      )}

      {d.grossProfitMargin !== null && (
        <>
          <Text style={s.subHeading}>Performance</Text>
          <View style={s.tableRow}>
            <Text style={s.cellLabel}>Avg gross profit margin</Text>
            <Text style={s.cellValue}>{formatReportPercent(d.grossProfitMargin)}</Text>
          </View>
        </>
      )}

      <Footer />
    </Page>
  );
}

// ---- Detail Table ----

function DetailTablePage({ reportData }: { reportData: ReportData }) {
  if (reportData.type === "monthly") {
    const d = reportData as MonthlyReportData;
    if (!d.current) return null;

    return (
      <Page size="A4" style={s.page}>
        <Text style={s.sectionHeading}>Monthly Cash Flow Detail</Text>
        <Text style={s.bodyText}>{d.periodLabel}</Text>

        <View style={s.tableHeader}>
          <Text style={[s.headerCell, { width: "50%" }]}>Item</Text>
          <Text style={[s.headerCell, { width: "25%", textAlign: "right" }]}>Amount</Text>
          <Text style={[s.headerCell, { width: "25%", textAlign: "right" }]}>% of Income</Text>
        </View>

        <TableRow
          label="Income"
          values={[d.current.income]}
        />
        {d.current.probableIncome > 0 && (
          <View style={s.tableRowAlt}>
            <Text style={[s.cellLabel, { fontStyle: "italic" }]}>Income (Probable)</Text>
            <CurrencyCell value={d.current.probableIncome} />
            <Text style={s.cellValue}>
              {d.current.income > 0 ? `${((d.current.probableIncome / d.current.income) * 100).toFixed(1)}%` : "—"}
            </Text>
          </View>
        )}
        <TableRow
          label="Outgoings"
          values={[d.current.outgoings]}
          alt
        />
        <View style={s.tableTotalRow}>
          <Text style={s.cellLabelBold}>Surplus / (Deficit)</Text>
          <Text style={[s.cellValueBold, d.current.surplus < 0 ? s.negValue : {}]}>
            {formatReportCurrency(d.current.surplus)}
          </Text>
          <Text style={s.cellValueBold}>
            {d.current.income > 0 ? `${((d.current.surplus / d.current.income) * 100).toFixed(1)}%` : "—"}
          </Text>
        </View>

        <Footer />
      </Page>
    );
  }

  // Quarterly detail
  const d = reportData as QuarterlyReportData;
  return (
    <Page size="A4" style={s.page}>
      <Text style={s.sectionHeading}>Monthly Cash Flow Detail — {d.periodLabel}</Text>

      {d.months.map((m, i) => (
        <View key={m.month} style={{ marginBottom: 16 }}>
          <Text style={s.subHeading}>{monthKeyToLabel(m.month)}</Text>

          <View style={s.tableHeader}>
            <Text style={[s.headerCell, { width: "50%" }]}>Item</Text>
            <Text style={[s.headerCell, { width: "25%", textAlign: "right" }]}>Amount</Text>
            <Text style={[s.headerCell, { width: "25%", textAlign: "right" }]}>% of Income</Text>
          </View>

          <TableRow label="Income" values={[m.income]} />
          <TableRow label="Outgoings" values={[m.outgoings]} alt />
          <View style={s.tableTotalRow}>
            <Text style={s.cellLabelBold}>Surplus / (Deficit)</Text>
            <Text style={[s.cellValueBold, m.surplus < 0 ? s.negValue : {}]}>
              {formatReportCurrency(m.surplus)}
            </Text>
            <Text style={s.cellValueBold}>
              {m.income > 0 ? `${((m.surplus / m.income) * 100).toFixed(1)}%` : "—"}
            </Text>
          </View>
        </View>
      ))}

      <Footer />
    </Page>
  );
}

// ---- Commentary Page ----

function CommentaryPage({ reportData }: { reportData: ReportData }) {
  return (
    <Page size="A4" style={s.page}>
      <Text style={s.sectionHeading}>Commentary</Text>
      <Text style={s.bodyText}>
        [Space reserved for management commentary. Add notes on business performance, key decisions, and outlook.]
      </Text>
      <View style={{ borderWidth: 1, borderColor: BORDER_GREY, borderRadius: 4, padding: 20, marginTop: 12, minHeight: 300 }}>
        <Text style={[s.bodyText, { color: TEXT_GREY, fontStyle: "italic" }]}>
          Notes:
        </Text>
      </View>
      <Footer />
    </Page>
  );
}

// ---- Main Document ----

interface CashflowReportPDFProps {
  reportData: ReportData;
  options: ReportOptions;
}

export function CashflowReportPDF({ reportData, options }: CashflowReportPDFProps) {
  return (
    <Document
      title={`Cash Flow Report — ${reportData.periodLabel}`}
      author="Total Tactiles Pty Ltd"
      subject={`Cash Flow Report for ${reportData.periodLabel}`}
    >
      <CoverPage reportData={reportData} options={options} />
      <ContentsPage options={options} />
      {options.includeExecutiveSummary && (
        <ExecutiveSummaryPage reportData={reportData} />
      )}
      <CashFlowOverviewPage reportData={reportData} />
      {options.includeDetailTable && (
        <DetailTablePage reportData={reportData} />
      )}
      {options.includeCommentary && (
        <CommentaryPage reportData={reportData} />
      )}
    </Document>
  );
}
