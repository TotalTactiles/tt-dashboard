import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import { useDashboardData, QuotedJob } from "@/contexts/DashboardDataContext";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { ArrowDown, AlertTriangle, CheckCircle2, ChevronRight, Info } from "lucide-react";
import { formatMetricValue } from "@/lib/formatMetricValue";

const DEAL_CYCLE_WEBHOOK = "https://n8n.srv1437130.hstgr.cloud/webhook/dashboard-cache";

type CycleEntry = {
  cycleDays: number | null;
  decidedType: "won" | "lost" | null;
  measurable: 0 | 1;
  isPrimary: 0 | 1;
  quoteSentTs: string | null;
  decidedTs: string | null;
};

const median = (arr: number[]): number => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (arr: number[]): number => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

function parseDealDate(raw: string): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  const dmyMatch = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
  if (dmyMatch) return new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const getLostReasonRaw = (j: any) =>
  (j.lostReason
    ?? (j as any).reasonForLoss
    ?? (j as any)["Lost/Dead Reason"]
    ?? (j as any)["Lost/Dead\nReason"]
    ?? "").toString().trim();

const isWon = (s: string) => s === "won";
const isYellow = (s: string) => s === "yellow";
const isLost = (s: string) => s === "lost";
const isPending = (s: string) => s === "pending";
const isCompleted = (s: string) => s === "completed";
const isPipelineWin = (j: QuotedJob) =>
  (j.status === "won" && !String(j.rawStatus ?? "").toLowerCase().includes("completed"))
  || j.status === "yellow";
const isActive = (s: string) => isPending(s) || isYellow(s) || isWon(s);

const fmt = (n: number) =>
  "$" + Math.round(n).toLocaleString("en-AU");

const fmtAUD = (n: number) => formatMetricValue(n, "currency");

const STAGES: { key: string; label: string; colorVar: string }[] = [
  { key: "pending", label: "Active (Pending)", colorVar: "hsl(var(--muted-foreground))" },
  { key: "yellow", label: "Verbal (YLW)", colorVar: "hsl(var(--chart-orange))" },
  { key: "won", label: "GRN", colorVar: "hsl(var(--chart-green))" },
];

const STATUS_PILL: Record<string, string> = {
  pending: "bg-chart-orange/20 text-chart-orange border-chart-orange/40",
  yellow: "bg-chart-orange/20 text-chart-orange border-chart-orange/40",
  won: "bg-chart-green/20 text-chart-green border-chart-green/40",
  lost: "bg-red-500/25 text-red-400 border-red-500/40",
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const DealFlow = () => {
  const { quotedJobs, liveData, totalOpps, wrWonFY, wrLostFY, wonValueFY, lostValueFY } = useDashboardData();
  const jobs = quotedJobs ?? [];
  const quotesRaw = (liveData?.quotes as any[]) ?? [];
  const [staleSort, setStaleSort] = useState<"oldest" | "newest">("oldest");
  const [staleStatus, setStaleStatus] = useState<"all" | "pending" | "won" | "lost" | "stale">("stale");
  const [cycleMap, setCycleMap] = useState<Record<string, CycleEntry>>({});
  const [cycleLoaded, setCycleLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(DEAL_CYCLE_WEBHOOK);
        const raw = await res.json();
        // Accept either [rows], { data: [rows] }, or a single row.
        const rows: Array<{ key: string; value: any }> = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
            ? raw.data
            : raw?.key
              ? [raw]
              : [];
        const row = rows.find((r) => r?.key === "tt_deal_cycle");
        if (row && !cancelled) {
          const parsed = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
          if (parsed && typeof parsed === "object") {
            setCycleMap(parsed as Record<string, CycleEntry>);
            console.log("[DealFlow] tt_deal_cycle loaded:", Object.keys(parsed).length, "entries");
          }
        } else if (!cancelled) {
          console.warn("[DealFlow] tt_deal_cycle row not found in cache webhook response");
        }
      } catch (err) {
        console.warn("[DealFlow] tt_deal_cycle fetch failed", err);
      } finally {
        if (!cancelled) setCycleLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const today = new Date();
  const cyc = (job: any): CycleEntry | null => {
    const id = String(job?.zohoId ?? job?.["Job/Lead ID (Zoho)"] ?? job?.["Job / Lead ID\n(Zoho)"] ?? "").trim();
    return id && cycleMap[id] ? cycleMap[id] : null;
  };
  const daysSinceQuoted = (entry: CycleEntry | null): number | null => {
    if (!entry) return null;
    if (entry.decidedTs && typeof entry.cycleDays === "number") return entry.cycleDays;
    if (entry.quoteSentTs) {
      const t = Date.parse(entry.quoteSentTs);
      if (!isNaN(t)) return Math.max(0, Math.floor((today.getTime() - t) / 86400000));
    }
    return null;
  };

  const byStatus = useMemo(() => {
    return {
      pending: jobs.filter((j: any) => isPending(j.status)),
      yellow: jobs.filter((j: any) => isYellow(j.status)),
      won: jobs.filter((j: any) => isWon(j.status)),
      lost: jobs.filter((j: any) => isLost(j.status)),
    };
  }, [jobs]);

  const stageStats = STAGES.map(s => {
    let items;
    if (s.key === "won") {
      items = jobs.filter((j: any) => j.status === "won" && !String(j.rawStatus ?? "").toLowerCase().includes("completed"));
    } else {
      items = byStatus[s.key as keyof typeof byStatus] ?? [];
    }
    const value = items.reduce((a: number, b: any) => a + (Number(b.value) || 0), 0);
    return { ...s, count: items.length, value };
  });

  const lostItems = byStatus.lost;
  const lostValue = lostItems.reduce((a: number, b: any) => a + (Number(b.value) || 0), 0);
  const wonItems = byStatus.won;
  const wonValue = wonItems.reduce((a: number, b: any) => a + (Number(b.value) || 0), 0);

  const completedJobs = jobs.filter((j: any) => String(j.rawStatus ?? "").toUpperCase() === "COMPLETED");
  const completedCount = completedJobs.length;
  const completedValue = completedJobs.reduce((s: number, j: any) => s + (Number(j.value) || 0), 0);

  const lostJobs = byStatus.lost;
  const lostCount = lostJobs.length;

  // Win/Loss Summary — same FY-scoped sources the dashboard cards use
  const won     = Number(wrWonFY ?? 0);
  const wonVal  = Number(wonValueFY ?? 0);
  const lost    = Number(wrLostFY ?? 0);
  const lostVal = Number(lostValueFY ?? 0);
  const totalDeals = Number(totalOpps ?? 0);

  const hasWinLoss = totalDeals > 0 || won > 0 || lost > 0;

  const winRate    = (won + lost) > 0 ? (won / (won + lost)) * 100 : 0;
  const pipelineCR = totalDeals > 0 ? (won / totalDeals) * 100 : 0;
  const avgWon     = won  > 0 ? wonVal  / won  : 0;
  const avgLost    = lost > 0 ? lostVal / lost : 0;
  const avgWonDeal = avgWon;
  const avgLostDeal = avgLost;
  const totalValueWon = wonVal;
  const ytdLostValue  = lostVal;

  const pendingCount = jobs.filter((j: any) => isActive(j.status)).length;
  const totalCount = jobs.length;
  const pendingPct = totalCount > 0 ? ((pendingCount / totalCount) * 100).toFixed(0) : "0";

  // Avg days from quote to won — for context explanation
  const wonJobsForAvg = jobs.filter((j: any) => isPipelineWin(j));
  const avgDaysToClose = wonJobsForAvg.reduce((sum: number, j: any) => {
    const d = parseDealDate(j.dateQuoted);
    if (!d) return sum;
    return sum + Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  }, 0) / (wonJobsForAvg.length || 1);

  // Loss reasons (genuine reasons only; blank reasons shown separately)
  const blankReasonCount = lostJobs.filter((j: any) => getLostReasonRaw(j) === "").length;
  const reasonBuckets = useMemo(() => {
    const counts: Record<string, number> = {};
    lostJobs.forEach((j: any) => {
      const r = getLostReasonRaw(j);
      if (!r) return;
      counts[r] = (counts[r] || 0) + 1;
    });
    const total = lostJobs.length || 1;
    return Object.entries(counts)
      .map(([reason, count]) => ({ reason, count, pct: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count);
  }, [lostJobs]);


  // Real stage from any status-ish string (rawStatus on QuotedJob, or "Current Status" on raw row)
  const stageOfStatus = (s: string): string => {
    const u = (s ?? "").toString().toUpperCase().trim();
    if (u.includes("QUOTE SENT")) return "Quote Sent";
    if (u.includes("NEGOTIATION") || u.includes("REVIEW")) return "Negotiation/Review";
    if (u.includes("VERBAL") || u.includes("YLW")) return "Verbal Confirmation (YLW)";
    if (u.includes("PO RECEIVED") || u.includes("GRN")) return "PO Received (GRN)";
    if (u.includes("COMPLETED")) return "Completed";
    if (u.includes("LOST") || u.includes("DEAD")) return "Lost/Dead";
    return "Other";
  };
  const stageOfRow = (row: any): string =>
    stageOfStatus(row["Current Status"] ?? row["Current\nStatus"] ?? row["Stage"] ?? "");

  // Velocity — avg days per real stage from cycle cache (excludes Completed & Lost/Dead)
  const VELOCITY_STAGES = [
    "Quote Sent",
    "Negotiation/Review",
    "Verbal Confirmation (YLW)",
    "PO Received (GRN)",
  ];
  // Source deals from mapped quotedJobs (guaranteed zohoId + rawStatus) with a
  // graceful fallback to raw quotesRaw if for any reason quotedJobs is empty.
  const dealsSource: any[] = jobs.length ? jobs : quotesRaw;
  const stageOfDeal = (d: any): string =>
    jobs.length ? stageOfStatus(d.rawStatus) : stageOfRow(d);

  const velocityData = VELOCITY_STAGES.map((label) => {
    const items = dealsSource.filter((r: any) => stageOfDeal(r) === label);
    const days = items
      .map((r: any) => daysSinceQuoted(cyc(r)))
      .filter((x: number | null): x is number => x !== null);
    const avg = days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0;
    return { stage: label, avgDays: Math.round(avg), count: items.length };
  });

  const velocityColor = (d: number) =>
    d < 14 ? "hsl(var(--chart-green))" : d < 30 ? "hsl(var(--chart-orange))" : "hsl(var(--destructive))";

  // Median cycle time — primary + measurable only
  const cycleEntries = Object.values(cycleMap).filter(
    (e) => e && e.isPrimary === 1 && e.measurable === 1 && typeof e.cycleDays === "number",
  ) as CycleEntry[];
  const wonDays = cycleEntries.filter((e) => e.decidedType === "won").map((e) => e.cycleDays as number);
  const lostDays = cycleEntries.filter((e) => e.decidedType === "lost").map((e) => e.cycleDays as number);
  const medianWon = Math.round(median(wonDays));
  const medianLost = Math.round(median(lostDays));
  const meanWon = Math.round(mean(wonDays));
  const meanLost = Math.round(mean(lostDays));

  // Per-deal list (from mapped quotedJobs joined to cache, with raw fallback)
  const staleDeals = useMemo(() => {
    const source: any[] = jobs.length ? jobs : quotesRaw;
    return source
      .map((j: any) => {
        const entry = cyc(j);
        const isMeasurable = entry ? entry.measurable === 1 : false;
        const days = daysSinceQuoted(entry);
        const rawS = jobs.length ? (j.rawStatus ?? "") : (j["Current Status"] ?? "");
        const stg = stageOfStatus(rawS);
        const status =
          stg === "PO Received (GRN)" || stg === "Completed" ? "won"
            : stg === "Lost/Dead" ? "lost"
            : stg === "Verbal Confirmation (YLW)" ? "yellow"
            : "pending";
        return {
          ...j,
          id: j.id ?? j.zohoId ?? `${j["Company Name"] ?? ""}-${j["Project Name"] ?? ""}`,
          daysOld: days,               // number | null
          measurable: isMeasurable,
          projectName: j.project ?? j["Project Name"] ?? j._project ?? "",
          companyName: j.company ?? j["Company Name"] ?? j._company ?? "",
          status,
        };
      })
      .filter((d: any) => d.projectName || d.companyName)
      .sort((a: any, b: any) => {
        const av = a.daysOld ?? -1;
        const bv = b.daysOld ?? -1;
        return bv - av;
      });
  }, [jobs, quotesRaw, cycleMap]);

  const filteredStaleDeals = useMemo(() => {
    let list = staleDeals;
    if (staleStatus === "stale") {
      list = list.filter((j: any) => j.status === "pending" && (j.daysOld ?? 0) > 21);
    } else if (staleStatus !== "all") {
      list = list.filter((j: any) => j.status === staleStatus);
    }
    if (staleSort === "newest") {
      list = [...list].sort((a: any, b: any) => (a.daysOld ?? -1) - (b.daysOld ?? -1));
    }
    return list;
  }, [staleDeals, staleSort, staleStatus]);

  const maxStageCount = Math.max(1, ...stageStats.map(s => s.count), completedCount);

  // Client Intelligence
  const [clientFilter, setClientFilter] = useState<"won" | "running" | "lost">("won");
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [showAllClients, setShowAllClients] = useState(false);
  const [tileFilterClient, setTileFilterClient] = useState<string | null>(null);
  const [activeTileKey, setActiveTileKey] = useState<string | null>(null);
  type ClientSortKey = "company" | "projects" | "active" | "total" | "winRate";
  const [clientSort, setClientSort] = useState<{ key: ClientSortKey; dir: "asc" | "desc" }>({ key: "total", dir: "desc" });
  const toggleClientSort = (key: ClientSortKey) => {
    setClientSort(prev => prev.key === key
      ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { key, dir: key === "company" ? "asc" : "desc" });
  };

  const bestPillFor = (client: any, mode: "value" | "count"): "won" | "running" | "lost" => {
    if (!client) return "won";
    if (mode === "value") {
      const arr: Array<["won" | "running" | "lost", number]> = [
        ["won", client.wonValue || 0],
        ["running", client.runningValue || 0],
        ["lost", client.lostValue || 0],
      ];
      arr.sort((a, b) => b[1] - a[1]);
      return arr[0][1] > 0 ? arr[0][0] : "won";
    }
    const counts: Record<"won" | "running" | "lost", number> = { won: 0, running: 0, lost: 0 };
    for (const k of client.contracts ?? []) {
      if (k.status === "won" || k.status === "running" || k.status === "lost") counts[k.status] += 1;
    }
    const order: Array<"won" | "running" | "lost"> = ["won", "running", "lost"];
    let best: "won" | "running" | "lost" = "won";
    let bestN = -1;
    for (const p of order) {
      if (counts[p] > bestN) { bestN = counts[p]; best = p; }
    }
    return bestN > 0 ? best : "won";
  };

  const handleTileClick = (tileKey: string, company: string | undefined, pill?: "won" | "running" | "lost") => {
    if (!company) return;
    if (activeTileKey === tileKey) {
      setActiveTileKey(null);
      setTileFilterClient(null);
      setExpandedClient(null);
      return;
    }
    setActiveTileKey(tileKey);
    setTileFilterClient(company);
    setExpandedClient(company);
    if (pill) setClientFilter(pill);
    setShowAllClients(true);
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        document.getElementById("top-clients-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };
  const clearTileFilter = () => {
    setActiveTileKey(null);
    setTileFilterClient(null);
    setExpandedClient(null);
  };

  const clientIntel = useMemo(() => {
    const clean = (v: any): string => String(v ?? "").trim();
    const pickField = (obj: any, keys: string[]): string => {
      const sources = [obj, obj?.raw, obj?._raw, obj?.source, obj?.original].filter(Boolean);
      for (const source of sources) {
        for (const key of keys) {
          const value = clean(source?.[key]);
          if (value) return value;
        }
      }
      return "";
    };
    const zohoIdOf = (j: any): string => pickField(j, [
      "zohoId",
      "jobLeadId",
      "jobId",
      "Job / Lead ID\n(Zoho)",
      "Job/Lead ID (Zoho)",
      "Job / Lead ID (Zoho)",
      "Job Lead ID (Zoho)",
      "Job / Lead ID",
      "Job/Lead ID",
      "Lead ID",
      "id",
    ]);
    const contractGroupIdOf = (j: any): string => pickField(j, [
      "contractGroupId",
      "contract_group_id",
      "Contract Group ID",
      "Contract\nGroup ID",
      "Contract Group Id",
      "ContractGroupID",
    ]);

    const quoteByZohoId = new Map<string, any>();
    for (const row of quotesRaw as any[]) {
      const zohoId = zohoIdOf(row);
      if (zohoId) quoteByZohoId.set(zohoId, row);
    }

    // Display-name cleanup only. Contract grouping is by Contract Group ID / Zoho ID.
    const stripStageSuffix = (name: string): string => {
      let n = String(name || "").trim();
      for (let i = 0; i < 3; i++) {
        const before = n;
        n = n.replace(/[\s]*[-–—][\s]*S1\b.*$/i, "");
        n = n.replace(/[\s]*[-–—][\s]*S[2-9]\b.*$/i, "");
        n = n.replace(/\s+S1\b.*$/i, "");
        n = n.replace(/\s+S[2-9]\b.*$/i, "");
        n = n.replace(/\s*[-–—]?\s*(VARIATION|ADDITIONAL)\b.*$/i, "");
        n = n.trim();
        if (n === before) break;
      }
      return n || String(name || "").trim();
    };
    // Pick the shortest REAL project name from the group (verbatim from the sheet — never synthesised).
    const shortestName = (names: string[]): string =>
      names
        .map(n => String(n || "").trim())
        .filter(Boolean)
        .sort((a, b) => a.length - b.length || a.localeCompare(b))[0] ?? "";
    const companyOf = (j: any): string => pickField(j, ["company", "Company Name", "Company\nName", "_company"]);
    const projectOf = (j: any): string => pickField(j, ["project", "jobName", "Project Name", "Project\nName", "Job Name", "_project"]);
    const stageFlags = (j: any) => {
      const status = clean(j?.status).toLowerCase();
      const raw = [
        j?.rawStatus,
        j?.["Current Status"],
        j?.["Current\nStatus"],
        j?.["Stage"],
      ].map(clean).join(" ").toLowerCase();
      const won = status === "won" || raw.includes("completed") || raw.includes("grn") || raw.includes("po received");
      const lost = status === "lost" || raw.includes("lost") || raw.includes("dead");
      const running = !won && !lost;
      return { won, lost, running };
    };

    const rows = (jobs as any[])
      .map(j => {
        const zohoId = zohoIdOf(j);
        const rawQuote = zohoId ? quoteByZohoId.get(zohoId) : null;
        const project = projectOf(j) || projectOf(rawQuote);
        const company = companyOf(j) || companyOf(rawQuote);
        const contractGroupId = contractGroupIdOf(j) || contractGroupIdOf(rawQuote);
        const contractKey = contractGroupId || zohoId;
        const flags = stageFlags(j);
        return {
          company,
          project,
          base: project,
          contractKey,
          isParentRow: !!zohoId && zohoId === contractKey,
          value: Number(j.value) || 0,
          ...flags,
        };
      })
      .filter(r => r.company && r.contractKey);


    // Group into rolled-up contracts strictly by Contract Group ID (fallback: own Zoho ID for standalone deals).
    type Contract = {
      key: string;
      company: string;
      base: string;
      totalValue: number;
      wonValue: number;
      runningValue: number;
      lostValue: number;
      status: "won" | "running" | "lost";
      stageCount: number;
      names: string[];
      parentName: string;
      hasWon: boolean;
      hasLost: boolean;
      hasRunning: boolean;
    };
    const cMap = new Map<string, Contract>();
    for (const r of rows) {
      const key = r.contractKey;
      const c = cMap.get(key) ?? {
        key, company: r.company, base: r.base,
        totalValue: 0, wonValue: 0, runningValue: 0, lostValue: 0,
        status: "running", stageCount: 0, names: [], parentName: "",
        hasWon: false, hasLost: false, hasRunning: false,
      };
      c.totalValue += r.value;
      c.stageCount += 1;
      c.names.push(r.project || r.base);
      if (r.isParentRow && r.project) c.parentName = r.project;
      c.hasWon = c.hasWon || r.won;
      c.hasLost = c.hasLost || r.lost;
      c.hasRunning = c.hasRunning || r.running;
      cMap.set(key, c);
    }
    const contracts = Array.from(cMap.values()).map(c => {
      const status: "won" | "running" | "lost" = c.hasWon ? "won" : (c.hasLost && !c.hasRunning ? "lost" : "running");
      const base = c.parentName || shortestName(c.names) || c.base;
      return {
        ...c,
        base,
        status,
        wonValue: status === "won" ? c.totalValue : 0,
        runningValue: status === "running" ? c.totalValue : 0,
        lostValue: status === "lost" ? c.totalValue : 0,
      };
    });

    const biggestOf = (pick: (c: Contract) => number) => {
      const arr = contracts.filter(c => pick(c) > 0);
      if (!arr.length) return null;
      const c = arr.reduce((a, b) => (pick(b) > pick(a) ? b : a));
      return { company: c.company, project: c.base, value: pick(c) };
    };
    const biggestWon = biggestOf(c => c.wonValue);
    const biggestRun = biggestOf(c => c.runningValue);
    const biggestLost = biggestOf(c => c.lostValue);

    // Aggregate per client from rolled-up contracts.
    type Client = {
      company: string;
      contracts: Contract[];
      projects: number;
      wonValue: number;
      runningValue: number;
      lostValue: number;
      totalValue: number;
      wonCount: number;
      lostCount: number;
      winRate: number | null;
    };
    const clientMap = new Map<string, Client>();
    for (const c of contracts) {
      const key = c.company.toLowerCase();
      const e = clientMap.get(key) ?? {
        company: c.company, contracts: [], projects: 0,
        wonValue: 0, runningValue: 0, lostValue: 0, totalValue: 0,
        wonCount: 0, lostCount: 0, winRate: null,
      };
      e.contracts.push(c);
      e.projects += 1;
      e.wonValue += c.wonValue;
      e.runningValue += c.runningValue;
      e.lostValue += c.lostValue;
      if (c.status === "won") e.wonCount += 1;
      if (c.status === "lost") e.lostCount += 1;
      clientMap.set(key, e);
    }
    const clients = Array.from(clientMap.values()).map(c => {
      const totalValue = c.wonValue + c.runningValue + c.lostValue;
      const decided = c.wonCount + c.lostCount;
      const winRate = decided > 0 ? (c.wonCount / decided) * 100 : null;
      // Canonical, tile-agnostic counts — every consumer reads these.
      const projectsWonRunning = c.contracts.filter(k => k.status === "won" || k.status === "running").length;
      const contractCountAll = c.contracts.length;
      const wonContractCount = c.contracts.filter(k => k.status === "won").length;
      return { ...c, totalValue, winRate, projectsWonRunning, contractCountAll, wonContractCount };
    });

    // Highest-value client (across all statuses).
    const byValue = [...clients].filter(c => c.totalValue > 0)
      .sort((a, b) => b.totalValue - a.totalValue)[0] ?? null;

    // Most-projects client — reads the canonical projectsWonRunning from clients.
    // Tie-break by total won+running value.
    const withActiveCounts = clients.map(c => ({
      ...c,
      activeContractCount: c.projectsWonRunning,
      activeContractValue: c.wonValue + c.runningValue,
    }));
    const byProjects = [...withActiveCounts]
      .filter(c => c.activeContractCount > 0)
      .sort((a, b) => (b.activeContractCount - a.activeContractCount) || (b.activeContractValue - a.activeContractValue))[0] ?? null;

    // Returning client = 2+ WON contracts (true repeat customers).
    const returningClients = clients.filter(c => c.wonContractCount >= 2);
    const byReturning = [...returningClients]
      .sort((a, b) => (b.wonContractCount - a.wonContractCount) || (b.totalValue - a.totalValue))[0] ?? null;
    const topReturningCount = byReturning?.wonContractCount ?? 0;
    const returningTiedExtra = byReturning
      ? Math.max(0, returningClients.filter(c => c.wonContractCount === topReturningCount).length - 1)
      : 0;
    const returningTotal = returningClients.length;

    // New vs Returning client intelligence metrics — "new" = fewer than 2 won contracts.
    const newClients = clients.filter(c => c.wonContractCount < 2);
    const newClientCount = newClients.length;
    const returningClientCount = returningTotal;
    const totalClients = clients.length;

    // Sum WON contracts across returning clients (basis for per-contract averages).
    const returningContracts = returningClients.reduce((s, c) => s + c.wonContractCount, 0);
    const returningClientValueTotal = returningClients.reduce((s, c) => s + c.totalValue, 0);
    const newClientValueTotal = newClients.reduce((s, c) => s + c.totalValue, 0);
    const trackedValue = clients.reduce((s, c) => s + c.totalValue, 0);

    const avgContractsPerReturning = returningClientCount > 0 ? returningContracts / returningClientCount : 0;
    const avgValuePerReturning = returningClientCount > 0 ? returningClientValueTotal / returningClientCount : 0;
    const avgValuePerReturningContract = returningContracts > 0 ? returningClientValueTotal / returningContracts : 0;
    const newPct = totalClients > 0 ? (newClientCount / totalClients) * 100 : 0;
    const returningPct = totalClients > 0 ? (returningClientCount / totalClients) * 100 : 0;
    const returningValueShare = trackedValue > 0 ? (returningClientValueTotal / trackedValue) * 100 : 0;
    const newValueShare = trackedValue > 0 ? (newClientValueTotal / trackedValue) * 100 : 0;

    // Concentration on won+running (tracked value).
    const trackedSorted = [...clients]
      .map(c => ({ ...c, tracked: c.wonValue + c.runningValue }))
      .filter(c => c.tracked > 0)
      .sort((a, b) => b.tracked - a.tracked);
    const grand = trackedSorted.reduce((s, c) => s + c.tracked, 0);
    const topClientPct = grand > 0 && trackedSorted[0] ? (trackedSorted[0].tracked / grand) * 100 : 0;
    const top3Pct = grand > 0 ? (trackedSorted.slice(0, 3).reduce((s, c) => s + c.tracked, 0) / grand) * 100 : 0;

    return { biggestWon, biggestRun, biggestLost, byProjects, byValue, byReturning, returningTotal, returningTiedExtra, clients, topClientPct, top3Pct,
      avgContractsPerReturning, avgValuePerReturning, avgValuePerReturningContract,
      newClientCount, returningClientCount, totalClients,
      returningContracts, returningClientValueTotal, newClientValueTotal,
      trackedValue, newPct, returningPct, returningValueShare, newValueShare,
    };
  }, [jobs, quotesRaw]);

  const activeClients = useMemo(() => {
    const pick = (c: any) =>
      clientFilter === "won" ? c.wonValue :
      clientFilter === "running" ? c.runningValue : c.lostValue;
    const filtered = clientIntel.clients
      .filter((c: any) => {
        if (tileFilterClient && c.company === tileFilterClient) return true;
        return pick(c) > 0;
      })
      .map((c: any) => ({
        ...c,
        activeValue: pick(c),
        activeProjects: c.contracts.filter((contract: any) => (
          clientFilter === "won" ? contract.wonValue :
          clientFilter === "running" ? contract.runningValue : contract.lostValue
        ) > 0).length,
      }));

    const { key, dir } = clientSort;
    const sign = dir === "asc" ? 1 : -1;
    const getNum = (c: any): number | null => {
      if (key === "projects") return c.projectsWonRunning;
      if (key === "active") return c.activeValue;
      if (key === "total") return c.totalValue;
      if (key === "winRate") return c.winRate; // may be null
      return null;
    };
    return [...filtered].sort((a: any, b: any) => {
      if (key === "company") {
        return sign * a.company.localeCompare(b.company);
      }
      const av = getNum(a);
      const bv = getNum(b);
      // nulls always sort to the bottom
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return sign * (av - bv);
    });
  }, [clientIntel, clientFilter, clientSort, tileFilterClient]);

  return (
    <DashboardLayout>
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        {/* Header */}
        <motion.div variants={item}>
          <h1 className="text-fluid-2xl font-semibold tracking-tight">Deal Flow</h1>
          <p className="text-fluid-sm text-muted-foreground mt-1">
            Commercial intelligence — pipeline, win/loss, velocity &amp; cash conversion
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {jobs.length} active deals
          </p>
        </motion.div>


        {/* Section 1: Funnel */}
        <motion.section variants={item} className="chart-container p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-fluid-base font-semibold">Pipeline Funnel</h2>
            <div className="text-fluid-xs text-muted-foreground">
              {jobs.length} total deals
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6">
            <div className="flex flex-col md:flex-row md:items-stretch gap-2">
              {stageStats.map((s, i) => {
                const next = stageStats[i + 1];
                const dropOff = next ? (s.count > 0 ? Math.max(0, ((s.count - next.count) / s.count) * 100) : "—") : null;
                const widthPct = 40 + (s.count / maxStageCount) * 60;
                return (
                  <div key={s.key} className="flex-1 flex flex-col md:flex-row md:items-center gap-2">
                    <div
                      className="rounded-lg border border-border/40 bg-card/40 p-3 flex-1 min-w-0"
                      style={{ borderLeft: `3px solid ${s.colorVar}`, width: `${widthPct}%` }}
                    >
                      <div className="text-fluid-xs text-muted-foreground truncate">{s.label}</div>
                      <div className="font-mono text-fluid-lg font-semibold mt-1">{s.count}</div>
                      <div className="font-mono text-fluid-xs text-muted-foreground">{fmt(s.value)}</div>
                    </div>
                    {next && (
                      <div className="hidden md:flex flex-col items-center text-muted-foreground shrink-0 px-1">
                        <ChevronRight className="w-4 h-4" />
                        {dropOff === "—" && (
                          <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-0.5">
                            <ArrowDown className="w-3 h-3" />
                            —
                          </div>
                        )}
                        {typeof dropOff === "number" && dropOff > 0 && (
                          <div className="text-[10px] font-mono text-destructive flex items-center gap-0.5">
                            <ArrowDown className="w-3 h-3" />
                            {dropOff.toFixed(0)}%
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="flex-1 flex flex-col md:flex-row md:items-center gap-2">
                <div
                  className="rounded-lg border border-border/40 bg-card/40 p-3 flex-1 min-w-0"
                  style={{ borderLeft: "3px solid #22c55e", width: `${40 + (completedCount / maxStageCount) * 60}%` }}
                >
                  <div className="text-fluid-xs text-muted-foreground truncate">COMPLETED</div>
                  <div className="font-mono text-fluid-lg font-semibold mt-1">{completedCount}</div>
                  <div className="font-mono text-fluid-xs text-muted-foreground">{fmt(completedValue)}</div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 md:w-48 self-start">
              <div className="text-fluid-xs text-destructive uppercase tracking-wide">Lost / Dead</div>
              <div className="font-mono text-fluid-lg font-semibold mt-1">{lostItems.length}</div>
              <div className="font-mono text-fluid-xs text-muted-foreground">{fmt(lostValue)} lost</div>
            </div>
          </div>
        </motion.section>

        {/* Section 2: Win/Loss */}
        <motion.section variants={item} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="chart-container p-5">
            <h2 className="text-fluid-base font-semibold mb-4">Win / Loss Summary</h2>
            <div className="grid grid-cols-2" style={{ gap: "20px 32px" }}>
              <div>
                <div className="text-[11px] uppercase text-[#64748b] tracking-[0.06em]">Win Rate</div>
                <div className="text-[22px] font-bold text-[#22c55e]">
                  {hasWinLoss ? `${winRate.toFixed(1)}%` : "--"}
                  <span title="Win Rate = Won ÷ decided (Won + Lost). Measures how often TT wins when a deal reaches a decision, excluding still-active pipeline.">
                    <Info
                      className="text-muted-foreground hover:text-foreground cursor-help transition-colors inline-block ml-1.5 align-middle"
                      size={14}
                    />
                  </span>
                </div>
                <div className="text-[11px] text-[#64748b]">Won ÷ decided</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-[#64748b] tracking-[0.06em]">Pipeline CR</div>
                <div className="text-[22px] font-bold text-[#38bdf8]">
                  {hasWinLoss ? `${pipelineCR.toFixed(1)}%` : "--"}
                  <span title={`Pipeline CR is lower than Win Rate because ${pendingCount} deals (${pendingPct}% of all quotes) are still active in the pipeline. TT's avg quote-to-close cycle is ~${Math.round(avgDaysToClose)} days, so many quotes are still converting. As these resolve, Pipeline CR will trend toward Win Rate.`}>
                    <Info
                      className="text-muted-foreground hover:text-foreground cursor-help transition-colors inline-block ml-1.5 align-middle"
                      size={14}
                    />
                  </span>
                </div>
                <div className="text-[11px] text-[#64748b]">Won ÷ all quoted</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-[#64748b] tracking-[0.06em]">Total Value Won</div>
                <div className="text-[22px] font-bold text-[#22c55e]">{hasWinLoss ? fmtAUD(totalValueWon) : "--"}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-[#64748b] tracking-[0.06em]">Total Value Lost</div>
                <div className="text-[22px] font-bold text-[#ef4444]">{hasWinLoss ? fmtAUD(ytdLostValue) : "--"}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-[#64748b] tracking-[0.06em]">Avg Won Deal</div>
                <div className="text-[22px] font-bold text-white">{hasWinLoss ? fmtAUD(avgWonDeal) : "--"}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-[#64748b] tracking-[0.06em]">Avg Lost Deal</div>
                <div className="text-[22px] font-bold text-white">{hasWinLoss ? fmtAUD(avgLostDeal) : "--"}</div>
              </div>
            </div>
          </div>

          <div className="chart-container p-5">
            <h2 className="text-fluid-base font-semibold mb-4">Loss Reason Breakdown</h2>
            {reasonBuckets.length === 0 ? (
              <div className="text-fluid-sm text-muted-foreground">No lost deals recorded.</div>
            ) : (
              <LossReasonList reasons={reasonBuckets} blankReasonCount={blankReasonCount} totalLost={lostJobs.length} />
            )}
          </div>
        </motion.section>

        {/* Client Intelligence */}
        <motion.section variants={item} className="chart-container p-5">
          <div className="mb-4">
            <h2 className="text-fluid-base font-semibold">Client Intelligence</h2>
            <p className="text-fluid-xs text-muted-foreground">Where the value sits — by client and by deal</p>
          </div>

          {/* Tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
            {[
              { key: "biggestWon", label: "Biggest Won", data: clientIntel.biggestWon, accent: "text-[#22c55e]", pill: "won" as const, sub: (d: any) => `${d.company} · ${d.project || "—"}` },
              { key: "biggestRun", label: "Biggest In Running", data: clientIntel.biggestRun, accent: "text-[#22c55e]", pill: "running" as const, sub: (d: any) => `${d.company} · ${d.project || "—"}` },
              { key: "biggestLost", label: "Biggest Lost", data: clientIntel.biggestLost, accent: "text-[#ef4444]", pill: "lost" as const, sub: (d: any) => `${d.company} · ${d.project || "—"}` },
            ].map((t) => {
              const isActiveTile = activeTileKey === t.key;
              const clickable = !!t.data;
              return (
                <button
                  key={t.label}
                  type="button"
                  disabled={!clickable}
                  onClick={() => handleTileClick(t.key, t.data?.company, t.pill)}
                  className={`text-left rounded-lg border p-3 transition-colors ${
                    isActiveTile ? "border-foreground/40 bg-foreground/5" : "border-border bg-card/40 hover:bg-card/60"
                  } ${clickable ? "cursor-pointer" : "cursor-default"}`}
                >
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.label}</div>
                  {t.data ? (
                    <>
                      <div className={`text-fluid-lg font-mono font-bold mt-1 ${t.accent}`}>{fmtAUD(t.data.value)}</div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5" title={t.sub(t.data)}>{t.sub(t.data)}</div>
                    </>
                  ) : (
                    <div className="text-fluid-lg font-mono font-bold mt-1 text-muted-foreground">—</div>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              disabled={!clientIntel.byProjects}
              onClick={() => handleTileClick("byProjects", clientIntel.byProjects?.company, bestPillFor(clientIntel.byProjects, "count"))}
              className={`text-left rounded-lg border p-3 transition-colors ${
                activeTileKey === "byProjects" ? "border-foreground/40 bg-foreground/5" : "border-border bg-card/40 hover:bg-card/60"
              } ${clientIntel.byProjects ? "cursor-pointer" : "cursor-default"}`}
            >
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Client — Most Projects</div>
              <div className="text-[9px] text-muted-foreground/70 mt-0.5">won + in-running contracts</div>
              {clientIntel.byProjects ? (
                <>
                  <div className="text-fluid-lg font-mono font-bold mt-1 text-foreground truncate" title={clientIntel.byProjects.company}>{clientIntel.byProjects.company}</div>
                  <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                    {clientIntel.byProjects.activeContractCount} won + in-running · {fmtAUD(clientIntel.byProjects.activeContractValue)}
                  </div>
                </>
              ) : (<div className="text-fluid-lg font-mono font-bold mt-1 text-muted-foreground">—</div>)}
            </button>
            <button
              type="button"
              disabled={!clientIntel.byValue}
              onClick={() => handleTileClick("byValue", clientIntel.byValue?.company, bestPillFor(clientIntel.byValue, "value"))}
              className={`text-left rounded-lg border p-3 transition-colors ${
                activeTileKey === "byValue" ? "border-foreground/40 bg-foreground/5" : "border-border bg-card/40 hover:bg-card/60"
              } ${clientIntel.byValue ? "cursor-pointer" : "cursor-default"}`}
            >
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Client — Highest Value</div>
              {clientIntel.byValue ? (
                <>
                  <div className="text-fluid-lg font-mono font-bold mt-1 text-foreground truncate" title={clientIntel.byValue.company}>{clientIntel.byValue.company}</div>
                  {clientIntel.byValue.projects > 1 ? (
                    <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                      {clientIntel.byValue.projects} projects totalling {fmtAUD(clientIntel.byValue.totalValue)}
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate" title={clientIntel.byValue.contracts[0]?.base}>
                      {clientIntel.byValue.contracts[0]?.base || "—"} · {fmtAUD(clientIntel.byValue.totalValue)}
                    </div>
                  )}
                </>
              ) : (<div className="text-fluid-lg font-mono font-bold mt-1 text-muted-foreground">—</div>)}
            </button>
            <button
              type="button"
              disabled={!clientIntel.byReturning}
              onClick={() => handleTileClick("byReturning", clientIntel.byReturning?.company, bestPillFor(clientIntel.byReturning, "count"))}
              className={`text-left rounded-lg border p-3 transition-colors ${
                activeTileKey === "byReturning" ? "border-foreground/40 bg-foreground/5" : "border-border bg-card/40 hover:bg-card/60"
              } ${clientIntel.byReturning ? "cursor-pointer" : "cursor-default"}`}
            >
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Most Returning Client</div>
              <div className="text-[9px] text-muted-foreground/70 mt-0.5">repeat wins (2+ won contracts)</div>
              {clientIntel.byReturning ? (
                <>
                  <div className="text-fluid-lg font-mono font-bold mt-1 text-foreground truncate" title={clientIntel.byReturning.company}>{clientIntel.byReturning.company}</div>
                  <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                    {clientIntel.byReturning.wonContractCount} won contracts
                    {clientIntel.returningTiedExtra > 0 ? ` (+${clientIntel.returningTiedExtra} more tied)` : ""}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {clientIntel.returningTotal} client{clientIntel.returningTotal === 1 ? "" : "s"} with 2+ won contracts
                  </div>
                </>
              ) : (<div className="text-fluid-lg font-mono font-bold mt-1 text-muted-foreground">—</div>)}
            </button>
          </div>

          {/* New vs Returning intelligence cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            <div className="text-left rounded-lg border border-border bg-card/40 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Returning Client Value</div>
              {clientIntel.returningClientCount > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <div className="text-fluid-base font-mono font-bold text-foreground">
                        {clientIntel.avgContractsPerReturning.toFixed(1)}
                      </div>
                      <div className="text-[10px] text-muted-foreground leading-tight">
                        contracts per returning client
                      </div>
                    </div>
                    <div>
                      <div className="text-fluid-base font-mono font-bold text-foreground">
                        {fmtAUD(clientIntel.avgValuePerReturningContract)}
                      </div>
                      <div className="text-[10px] text-muted-foreground leading-tight">avg value per contract</div>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-border/40">
                      <div className="text-fluid-base font-mono font-bold text-foreground">
                        {fmtAUD(clientIntel.avgValuePerReturning)}
                      </div>
                      <div className="text-[10px] text-muted-foreground leading-tight">avg total value per client</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/40">
                    {clientIntel.returningClientCount} returning client{clientIntel.returningClientCount === 1 ? "" : "s"}
                    {" "}· {clientIntel.returningContracts} total contracts
                  </div>
                </>
              ) : (
                <div className="text-fluid-lg font-mono font-bold mt-1 text-muted-foreground">—</div>
              )}
            </div>
            <div className="text-left rounded-lg border border-border bg-card/40 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">New vs Returning</div>
              {clientIntel.totalClients > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-1 text-center">Clients</div>
                      <div className="h-20">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Tooltip
                              contentStyle={{ backgroundColor: "hsl(var(--background))", borderColor: "hsl(var(--border))" }}
                              itemStyle={{ color: "hsl(var(--foreground))", fontSize: 11 }}
                              formatter={(value: number, name: string) => [
                                `${value} (${((value / clientIntel.totalClients) * 100).toFixed(0)}%)`,
                                name,
                              ]}
                            />
                            <Pie
                              data={[
                                { name: "Returning", value: clientIntel.returningClientCount, fill: "#22c55e" },
                                { name: "New", value: clientIntel.newClientCount, fill: "hsl(var(--muted-foreground))" },
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={22}
                              outerRadius={32}
                              paddingAngle={2}
                              dataKey="value"
                              stroke="none"
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="text-[10px] text-center text-muted-foreground mt-0.5">
                        Returning {clientIntel.returningPct.toFixed(0)}% · New {clientIntel.newPct.toFixed(0)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-1 text-center">Tracked value</div>
                      <div className="h-20">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Tooltip
                              contentStyle={{ backgroundColor: "hsl(var(--background))", borderColor: "hsl(var(--border))" }}
                              itemStyle={{ color: "hsl(var(--foreground))", fontSize: 11 }}
                              formatter={(value: number, name: string) => [
                                `${fmtAUD(value)} (${clientIntel.trackedValue > 0 ? ((value / clientIntel.trackedValue) * 100).toFixed(0) : 0}%)`,
                                name,
                              ]}
                            />
                            <Pie
                              data={[
                                { name: "Returning", value: clientIntel.returningClientValueTotal, fill: "#22c55e" },
                                { name: "New", value: clientIntel.newClientValueTotal, fill: "hsl(var(--muted-foreground))" },
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={22}
                              outerRadius={32}
                              paddingAngle={2}
                              dataKey="value"
                              stroke="none"
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="text-[10px] text-center text-muted-foreground mt-0.5">
                        Returning {clientIntel.returningValueShare.toFixed(0)}% · New {clientIntel.newValueShare.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                  <div className={`text-[11px] mt-2 text-center ${clientIntel.returningValueShare > 50 ? "text-[#22c55e] font-medium" : "text-muted-foreground"}`}>
                    Returning clients drive {clientIntel.returningValueShare.toFixed(0)}% of tracked contract value
                  </div>
                </>
              ) : (
                <div className="text-fluid-lg font-mono font-bold mt-1 text-muted-foreground">—</div>
              )}
            </div>
          </div>

          {/* Concentration */}
          <div className={`text-fluid-xs font-mono mb-3 ${clientIntel.top3Pct > 60 ? "text-[#f59e0b]" : "text-muted-foreground"}`}>
            Top client = {clientIntel.topClientPct.toFixed(1)}% of tracked value · Top 3 = {clientIntel.top3Pct.toFixed(1)}%
          </div>

          {/* Top Clients table */}
          <div id="top-clients-table" className="flex items-center justify-between mb-2 scroll-mt-4">
            <div className="text-fluid-xs font-semibold text-muted-foreground uppercase tracking-wide">Top Clients</div>
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              {([
                { key: "won", label: "Won" },
                { key: "running", label: "In-Running" },
                { key: "lost", label: "Lost" },
              ] as const).map(p => (
                <button
                  key={p.key}
                  onClick={() => { setClientFilter(p.key); setExpandedClient(null); }}
                  className={`px-3 py-1 text-[11px] font-medium transition-colors ${
                    clientFilter === p.key
                      ? "bg-foreground/10 text-foreground"
                      : "bg-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {tileFilterClient && (
            <div className="mb-2">
              <button
                type="button"
                onClick={clearTileFilter}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-foreground/30 bg-foreground/5 text-[11px] text-foreground hover:bg-foreground/10 transition-colors"
              >
                <span className="text-muted-foreground">Showing:</span>
                <span className="font-medium">{tileFilterClient}</span>
                <span aria-hidden className="text-muted-foreground hover:text-foreground">✕</span>
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-fluid-xs">
              <thead>
                {(() => {
                  const arrow = (k: ClientSortKey) =>
                    clientSort.key === k ? (clientSort.dir === "asc" ? " ▲" : " ▼") : "";
                  const cls = (k: ClientSortKey, extra = "") =>
                    `py-2 ${extra} font-medium cursor-pointer select-none hover:text-foreground transition-colors ${clientSort.key === k ? "text-foreground" : ""}`;
                  return (
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="py-2 pr-3 font-medium w-6"></th>
                      <th className={cls("company", "pr-3")} onClick={() => toggleClientSort("company")}>Client{arrow("company")}</th>
                      <th className={cls("projects", "px-3 text-right")} onClick={() => toggleClientSort("projects")}>Projects{arrow("projects")}</th>
                      <th className={cls("active", "px-3 text-right")} onClick={() => toggleClientSort("active")}>
                        {clientFilter === "won" ? "Won $" : clientFilter === "running" ? "In-Running $" : "Lost $"}{arrow("active")}
                      </th>
                      <th className={cls("total", "px-3 text-right")} onClick={() => toggleClientSort("total")}>Total ${arrow("total")}</th>
                      <th className={cls("winRate", "pl-3 text-right")} onClick={() => toggleClientSort("winRate")}>Win Rate{arrow("winRate")}</th>
                    </tr>
                  );
                })()}
              </thead>
              <tbody>
                {(showAllClients ? activeClients : activeClients.slice(0, 8)).map((c: any) => {
                  const isOpen = expandedClient === c.company;
                  const valColor =
                    clientFilter === "won" ? "text-[#22c55e]" :
                    clientFilter === "running" ? "text-[#60a5fa]" : "text-[#ef4444]";
                  const rolled = [...c.contracts]
                    .map((k: any) => ({
                      base: k.base,
                      v: clientFilter === "won" ? k.wonValue : clientFilter === "running" ? k.runningValue : k.lostValue,
                    }))
                    .filter((k: any) => k.v > 0)
                    .sort((a: any, b: any) => b.v - a.v);
                  return (
                    <>
                      <tr
                        key={c.company}
                        className="border-b border-border/50 hover:bg-white/[0.02] cursor-pointer"
                        onClick={() => setExpandedClient(isOpen ? null : c.company)}
                      >
                        <td className="py-2 pr-1 text-muted-foreground">
                          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                        </td>
                        <td className="py-2 pr-3 truncate max-w-[240px]" title={c.company}>{c.company}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">{c.projectsWonRunning}</td>
                        <td className={`py-2 px-3 text-right font-mono tabular-nums ${valColor}`}>{fmtAUD(c.activeValue)}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold">{fmtAUD(c.totalValue)}</td>
                        <td className="py-2 pl-3 text-right font-mono tabular-nums">{c.winRate === null ? "—" : `${c.winRate.toFixed(0)}%`}</td>
                      </tr>
                      {isOpen && (
                        <tr key={`${c.company}-expanded`} className="border-b border-border/50 bg-white/[0.015]">
                          <td></td>
                          <td colSpan={5} className="py-2 pr-3">
                            <div className="pl-2 space-y-1">
                              {rolled.length === 0 ? (
                                <div className="text-[11px] text-muted-foreground">No {clientFilter} contracts.</div>
                              ) : rolled.map((k: any, i: number) => (
                                <div key={i} className="flex items-center justify-between text-[11px]">
                                  <div className="truncate text-muted-foreground pr-3" title={k.base}>{k.base || "—"}</div>
                                  <div className={`font-mono tabular-nums ${valColor}`}>{fmtAUD(k.v)}</div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
                {activeClients.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground text-fluid-xs">
                      No {clientFilter} contracts.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {activeClients.length > 8 && (
            <button
              onClick={() => setShowAllClients(v => !v)}
              className="mt-3 text-fluid-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAllClients ? "Show top 8" : `Show all (${activeClients.length})`}
            </button>
          )}

          <p className="text-[11px] text-muted-foreground mt-4">
            Client totals roll multi-stage contracts (S1/S2/S3, variations, additionals) into a single project. Values are grouped from individual deal line items (Contract Value) and may differ slightly from the Win/Loss summary, which uses period-scoped totals.
          </p>
        </motion.section>



        {/* Section 3: Velocity */}

        <motion.section variants={item} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="chart-container p-5">
            <h2 className="text-fluid-base font-semibold mb-1">Avg Days Per Stage</h2>
            <p className="text-fluid-xs text-muted-foreground mb-4">Avg days since quoted, by current stage</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={velocityData} layout="vertical" margin={{ left: 10, right: 24, top: 4, bottom: 4 }}>
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis dataKey="stage" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-background border border-border rounded-lg px-3 py-2 shadow-lg">
                        <p className="text-xs text-muted-foreground font-mono mb-0.5">{label}</p>
                        <p className="text-sm font-mono font-semibold text-foreground">
                          {Math.round(payload[0].value as number)} days avg
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="avgDays" radius={[0, 4, 4, 0]}>
                  {velocityData.map((d, i) => (
                    <Cell key={i} fill={velocityColor(d.avgDays)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-4 pt-4 border-t border-border/40 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/40 bg-card/30 p-3">
                <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground font-mono">
                  Median Quote → Won
                  <span title={`mean ${meanWon}d · ${wonDays.length} deals`}>
                    <Info className="text-muted-foreground/70 hover:text-foreground cursor-help transition-colors inline-block ml-0.5 align-middle" size={12} />
                  </span>
                </div>
                <div className="font-mono text-fluid-xl font-semibold text-chart-green mt-1">
                  {wonDays.length ? `${medianWon}d` : "—"}
                </div>
              </div>
              <div className="rounded-lg border border-border/40 bg-card/30 p-3">
                <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground font-mono">
                  Median Quote → Lost
                  <span title={`mean ${meanLost}d · ${lostDays.length} deals`}>
                    <Info className="text-muted-foreground/70 hover:text-foreground cursor-help transition-colors inline-block ml-0.5 align-middle" size={12} />
                  </span>
                </div>
                <div className="font-mono text-fluid-xl font-semibold text-red-400 mt-1">
                  {lostDays.length ? `${medianLost}d` : "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="chart-container p-5">
            <h2 className="text-fluid-base font-semibold mb-1">Pipeline Velocity</h2>
            <p className="text-fluid-xs text-muted-foreground mb-4">Days in pipeline since quoting started (Date Created)</p>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="flex items-center gap-1.5">
                {[
                  { key: "oldest", label: "Oldest first" },
                  { key: "newest", label: "Newest first" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setStaleSort(opt.key as "oldest" | "newest")}
                    className={`text-[11px] px-2 py-1 rounded-full border transition-colors font-mono ${
                      staleSort === opt.key
                        ? "bg-chart-green/20 text-chart-green border-chart-green/40"
                        : "border-border text-muted-foreground hover:bg-secondary/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="w-px h-4 bg-border/40" />
              <div className="flex items-center gap-1.5">
                {[
                  { key: "all", label: "All" },
                  { key: "pending", label: "Pending" },
                  { key: "won", label: "Won" },
                  { key: "lost", label: "Lost" },
                  { key: "stale", label: "Stale" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setStaleStatus(opt.key as "all" | "pending" | "won" | "lost" | "stale")}
                    className={`text-[11px] px-2 py-1 rounded-full border transition-colors font-mono ${
                      staleStatus === opt.key
                        ? opt.key === "pending" || opt.key === "stale"
                          ? "bg-chart-orange/20 text-chart-orange border-chart-orange/40"
                          : opt.key === "lost"
                          ? "bg-red-500/25 text-red-400 border-red-500/40"
                          : "bg-chart-green/20 text-chart-green border-chart-green/40"
                        : "border-border text-muted-foreground hover:bg-secondary/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredStaleDeals.length === 0 ? (
              <div className="flex items-center gap-2 text-chart-green text-fluid-sm">
                <CheckCircle2 className="w-4 h-4" /> No stale deals
              </div>
            ) : (
              <ul className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {filteredStaleDeals.map((d: any) => {
                  const hasDays = typeof d.daysOld === "number" && d.measurable;
                  const sev = !hasDays
                    ? "bg-muted/30 text-muted-foreground border-border/40"
                    : d.daysOld >= 35
                      ? "bg-red-500/25 text-red-400 border-red-500/40"
                      : "bg-orange-500/20 text-orange-300 border-orange-500/40";
                  return (
                    <li key={d.id} className="flex items-center justify-between gap-3 p-2 rounded-md border border-border/40 bg-card/30">
                      <div className="min-w-0 flex-1">
                        <div className="text-fluid-sm font-medium truncate">{d.projectName || d.jobName || "Unnamed"}</div>
                        <div className="text-fluid-xs text-muted-foreground truncate">{d.companyName || d.jobName || ""}</div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded border ${STATUS_PILL[d.status] ?? STATUS_PILL.pending}`}>
                        {d.status}
                      </span>
                      <span className={`font-mono text-[10px] px-2 py-0.5 rounded border ${sev}`}>
                        {hasDays ? `${d.daysOld}d` : "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </motion.section>

        {/* Section 4: Quote-to-Cash placeholder */}
        <motion.section variants={item} className="chart-container p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-fluid-base font-semibold">Quote-to-Cash Timeline</h2>
              <p className="text-fluid-xs text-muted-foreground mt-1 max-w-xl">
                Tracks each deal from quoted → won → invoiced → paid, showing true cash conversion cycle
              </p>
            </div>
            <span className="text-[11px] px-2 py-1 rounded border border-chart-orange/40 bg-chart-orange/15 text-chart-orange flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Awaiting Fiskil bank sync
            </span>
          </div>

          <div className="mt-6 flex items-center justify-between gap-2 opacity-60">
            {["Quoted", "Won", "Invoiced", "Paid"].map((label, i, arr) => (
              <div key={label} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-10 h-10 rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center font-mono text-fluid-xs text-muted-foreground">
                    {i + 1}
                  </div>
                  <div className="text-fluid-xs text-muted-foreground">{label}</div>
                </div>
                {i < arr.length - 1 && (
                  <div className="flex-1 h-px border-t border-dashed border-muted-foreground/40 mx-1" />
                )}
              </div>
            ))}
          </div>

          <p className="text-fluid-xs text-muted-foreground mt-6">
            This section activates automatically once live bank transactions are matched to revenue jobs.
          </p>
        </motion.section>
      </motion.div>
    </DashboardLayout>
  );
};

const LossReasonList = ({
  reasons,
  blankReasonCount,
  totalLost,
}: {
  reasons: { reason: string; count: number; pct: number }[];
  blankReasonCount: number;
  totalLost: number;
}) => {
  const top = reasons.slice(0, 6);
  const rest = reasons.slice(6);
  return (
    <div className="space-y-2">
      {top.map(r => (
        <div key={r.reason} className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-fluid-sm">
              <span className="truncate">{r.reason}</span>
              <span className="font-mono text-muted-foreground ml-2">{r.count} · {r.pct.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 mt-1 bg-muted/30 rounded">
              <div className="h-full bg-destructive/70 rounded" style={{ width: `${r.pct}%` }} />
            </div>
          </div>
        </div>
      ))}
      {rest.length > 0 && (
        <details className="text-fluid-xs text-muted-foreground pt-1">
          <summary className="cursor-pointer hover:text-foreground">Show {rest.length} more</summary>
          <div className="space-y-1 mt-2">
            {rest.map(r => (
              <div key={r.reason} className="flex justify-between">
                <span className="truncate">{r.reason}</span>
                <span className="font-mono">{r.count} · {r.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </details>
      )}
      {blankReasonCount > 0 && (
        <div className="mt-4 pt-3 border-t border-border/40">
          <div className="flex items-center justify-between">
            <span className="font-mono text-fluid-xs uppercase tracking-wide text-chart-amber">
              No Reason Recorded
            </span>
            <span className="font-mono text-fluid-xs text-chart-amber">
              {blankReasonCount} · {((blankReasonCount / totalLost) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="mt-1.5 h-[3px] w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-chart-amber rounded-full"
              style={{ width: `${(blankReasonCount / totalLost) * 100}%` }}
            />
          </div>
          <p className="font-mono text-muted-foreground/60 mt-1.5" style={{ fontSize: "10px" }}>
            Chase these in the sheet — reason missing at last sync
          </p>
        </div>
      )}
    </div>
  );
};

export default DealFlow;
