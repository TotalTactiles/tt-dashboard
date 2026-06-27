import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Pencil, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { formatMetricValue } from "@/lib/formatMetricValue";


interface FormulaInfo {
  name: string;
  expression: string;
  lastComputed: number | null;
}

interface StatCardProps {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  index: number;
  noData?: boolean;
  formulaDriven?: FormulaInfo | null;
  altValue?: string;
  altChange?: string;
  altPositive?: boolean;
  altDiff?: string;
  goalAdjusted?: boolean;
  toggleLabelBase?: string;
  toggleLabelAlt?: string;
  momDelta?: string;
  altMomDelta?: string;
  momContext?: string;
  altMomContext?: string;
  greenAltPill?: boolean;
  altValue2?: string;
  altChange2?: string;
  altPositive2?: boolean;
  toggleLabelAlt2?: string;
  emphasis?: boolean;
  variant?: "default" | "centered";
}

// Unified emphasis figure style — one compact type scale across every Quick Look Sales card.
const emphasisFigureStyle: React.CSSProperties = {
  fontSize: 'clamp(1.25rem, 1.6vw, 1.5rem)',
  lineHeight: 1.15,
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '-0.015em',
  minWidth: 0,
  maxWidth: '100%',
  display: 'block',
  wordBreak: 'break-word',
};
const emphasisValueShortStyle = emphasisFigureStyle;
const emphasisValueLongStyle = emphasisFigureStyle;


function timeAgo(ts: number | null): string {
  if (!ts) return "never";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function abbreviateValue(raw: string): { display: string; abbreviated: boolean } {
  const numeric = parseFloat(raw.replace(/[^0-9.-]/g, ""));
  if (isNaN(numeric)) return { display: raw, abbreviated: false };
  const abs = Math.abs(numeric);
  const sign = numeric < 0 ? "-" : "";
  if (abs >= 1_000_000) return { display: `${sign}$${(abs / 1_000_000).toFixed(2)}M`, abbreviated: true };
  if (abs >= 1_000) return { display: `${sign}$${(abs / 1_000).toFixed(1)}K`, abbreviated: true };
  return { display: raw, abbreviated: false };
}

const fmtAUD = (n: number) => formatMetricValue(n, "currency");

// Inline styles for fluid typography using container query inline units
const titleStyle: React.CSSProperties = {
  fontSize: 'clamp(0.48rem, 1.6cqi, 0.62rem)',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
  maxWidth: '100%',
  fontWeight: 500,
};

const titleStyleCentered: React.CSSProperties = {
  fontSize: 'clamp(0.7rem, 2.2cqi, 0.82rem)',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
  maxWidth: '100%',
};

const valueShortStyle: React.CSSProperties = {
  fontSize: 'clamp(0.95rem, 4cqi, 1.6rem)',
  lineHeight: '1.2',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
  display: 'block',
  maxWidth: '100%',
  fontWeight: 600,
  letterSpacing: '-0.02em',
};

const valueLongStyle: React.CSSProperties = {
  fontSize: 'clamp(0.75rem, 3cqi, 1.3rem)',
  lineHeight: '1.2',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
  display: 'block',
  maxWidth: '100%',
  fontWeight: 600,
  letterSpacing: '-0.015em',
};

const sublineStyle: React.CSSProperties = {
  fontSize: 'clamp(0.58rem, 1.5cqi, 0.7rem)',
  lineHeight: '1.45',
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  minWidth: 0,
  fontWeight: 400,
};

const noteStyle: React.CSSProperties = {
  fontSize: 'clamp(0.55rem, 1.4cqi, 0.65rem)',
  lineHeight: '1.4',
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  minWidth: 0,
};

type ToggleMode = "base" | "alt" | "alt2";

const StatCard = ({ label, value, change, positive, index, noData, formulaDriven, altValue, altChange, altPositive, altDiff, goalAdjusted, toggleLabelBase, toggleLabelAlt, momDelta, altMomDelta, momContext, altMomContext, greenAltPill, altValue2, altChange2, altPositive2, toggleLabelAlt2, emphasis, variant = "default" }: StatCardProps) => {
  const isCentered = variant === "centered";
  const { kpiVariables, formulaCache, formulas } = useDashboardData();
  const [mode, setMode] = useState<ToggleMode>("base");
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);


  const [localActualValue, setLocalActualValue] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem('tt_actual_bank_balance');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return typeof parsed.value === 'number' ? parsed.value : null;
    } catch { return null; }
  });
  const [localActualDate, setLocalActualDate] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem('tt_actual_bank_balance');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return parsed.date ?? null;
    } catch { return null; }
  });

  const saveActualBalance = (raw: string) => {
    const num = parseFloat(raw.replace(/[^0-9.-]/g, ""));
    if (isNaN(num)) {
      setEditing(false);
      return;
    }
    const dateStr = new Date().toLocaleDateString('en-AU', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
    localStorage.setItem('tt_actual_bank_balance', JSON.stringify({
      value: num,
      date: dateStr
    }));
    setLocalActualValue(num);
    setLocalActualDate(dateStr);
    setEditing(false);
  };

  const clearActualBalance = () => {
    localStorage.removeItem('tt_actual_bank_balance');
    setLocalActualValue(null);
    setLocalActualDate(null);
    setInputValue("");
    setEditing(false);
  };

  const hasToggle = !!altValue;
  const hasThirdToggle = !!toggleLabelAlt2;

  // Legacy compat
  const showAlt = mode === "alt";

  // Use local state for Actual if available (instant update without reload)
  const isActualNotSet = localActualValue === null;
  const resolvedActualValue = !isActualNotSet
    ? `$${localActualValue! >= 1_000_000 ? (localActualValue! / 1_000_000).toFixed(2) + 'M' : localActualValue! >= 1000 ? (localActualValue! / 1000).toFixed(1) + 'K' : localActualValue!.toFixed(0)}`
    : "Enter amount";
  const resolvedActualDate = localActualDate ? `Actual · ${localActualDate}` : "";

  const isCashflowPosition = label === "Cashflow Position" || label === "Cash Position";
  const openValue = isCashflowPosition && kpiVariables?.XeroCashOpening && kpiVariables.XeroCashOpening !== 0
    ? kpiVariables.XeroCashOpening
    : null;
  const todayValue = isCashflowPosition && kpiVariables?.XeroCashCurrent && kpiVariables.XeroCashCurrent !== 0
    ? kpiVariables.XeroCashCurrent
    : null;

  const displayValue = (() => {
    if (mode === "alt2") return resolvedActualValue;
    if (mode === "alt") {
      if (todayValue !== null) return fmtAUD(todayValue);
      return altValue || value;
    }
    if (openValue !== null) return fmtAUD(openValue);
    return value;
  })();
  const displayChange = mode === "alt2" ? resolvedActualDate : mode === "alt" && altChange ? altChange : change;
  const displayPositive = mode === "alt2" ? (localActualValue ?? 0) >= 0 : mode === "alt" && altPositive !== undefined ? altPositive : positive;

  const isYellow = hasToggle && mode === "alt" && !greenAltPill;
  const isActual = mode === "alt2";
  const accentColor = isYellow ? "text-amber-400" : displayPositive ? "text-chart-green" : "text-chart-red";
  const accentGlow = isYellow ? "" : displayPositive ? "glow-green" : "glow-red";
  const barColor = isYellow ? "bg-amber-400" : displayPositive ? "bg-chart-green" : "bg-chart-red";
  const pillActiveClass = isYellow
    ? "bg-amber-400/20 text-amber-400 shadow-sm"
    : "bg-primary text-primary-foreground shadow-sm";

  const { display: abbreviatedDisplay } = abbreviateValue(displayValue);

  const ylwGlowClass = isYellow ? "ring-1 ring-amber-400/40 shadow-[0_0_12px_-3px_hsl(38,92%,55%,0.3)]" : "";

  const isShort = abbreviatedDisplay.length <= 8;

  const handleEditClick = () => {
    if (localActualValue !== null) {
      setInputValue(String(localActualValue));
    } else if (altValue2 && altValue2 !== "Tap to set") {
      setInputValue(altValue2.replace(/[^0-9.-]/g, ""));
    } else {
      setInputValue("");
    }
    setEditing(true);
  };

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  // Shared title style for emphasis cards — compact, legible, line-tight
  const emphasisTitleClass = "font-mono font-semibold uppercase text-foreground/70 tracking-[0.12em] text-[0.7rem] whitespace-normal break-words leading-tight text-center";


  // Badges block — same markup whether emphasised or not
  const badges = (
    <div className="flex items-center gap-0.5 flex-wrap justify-center">
      {isActual && (
        <span className="text-[9px] font-mono text-amber-400/70 bg-amber-400/10 border border-amber-400/20 rounded px-1 py-0.5 leading-none whitespace-nowrap">
          manual
        </span>
      )}
      {goalAdjusted && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-[9px] font-mono text-amber-400/70 bg-amber-400/10 border border-amber-400/20 rounded px-1 py-0.5 leading-none cursor-help whitespace-nowrap">
              adj.
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs font-mono max-w-[250px]">
            Value includes active goal scenarios. Toggle goals off to see baseline.
          </TooltipContent>
        </Tooltip>
      )}
      {formulaDriven && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-[9px] font-mono text-chart-green/70 bg-chart-green/10 border border-chart-green/20 rounded px-1 py-0.5 leading-none whitespace-nowrap">
              f(x)
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs font-mono max-w-[250px]">
            <p className="font-semibold">Formula: {formulaDriven.name}</p>
            <p className="text-muted-foreground mt-0.5">Expression: {formulaDriven.expression}</p>
            <p className="text-muted-foreground mt-0.5">Last computed: {timeAgo(formulaDriven.lastComputed)}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );

  const pillsBlock = hasToggle && !noData ? (
    <div className={`flex ${isCentered || emphasis ? "justify-center" : ""} mt-0.5 mb-0.5`}>
      <div className="flex rounded-full bg-secondary/80 p-0.5 leading-none" style={{ fontSize: "clamp(8px, 0.85vw, 10px)" }}>
        <button
          onClick={() => setMode("base")}
          className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${
            mode === "base" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="hidden sm:inline">{toggleLabelBase ?? "Confirmed"}</span>
          <span className="sm:hidden">✓</span>
        </button>
        <button
          onClick={() => setMode("alt")}
          className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${
            mode === "alt" ? pillActiveClass : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {toggleLabelAlt ?? "With YLWs"}
        </button>
        {hasThirdToggle && (
          <button
            onClick={() => setMode("alt2")}
            className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${
              mode === "alt2" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {toggleLabelAlt2}
          </button>
        )}
      </div>
    </div>
  ) : null;

  const valueBlock = (
    <div style={{ minWidth: 0 }} className={isCentered || emphasis ? "w-full break-words text-center" : "my-0.5"}>
      {isActual && (editing || isActualNotSet) ? (
        <div className={`flex items-center gap-1 ${isCentered || emphasis ? "justify-center" : ""}`}>
          <span className="text-muted-foreground font-mono" style={{ fontSize: 'clamp(0.75rem, 3cqi, 1.2rem)' }}>$</span>
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={() => {
              if (inputValue.trim()) saveActualBalance(inputValue);
              else { clearActualBalance(); }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (inputValue.trim()) saveActualBalance(inputValue);
                else clearActualBalance();
              }
              if (e.key === "Escape") setEditing(false);
            }}
            placeholder="Enter amount"
            className={`bg-transparent border-b border-primary/40 outline-none font-mono font-bold text-foreground placeholder:text-muted-foreground placeholder:font-normal w-full ${isCentered || emphasis ? "text-center" : ""}`}
            style={{ fontSize: 'clamp(0.75rem, 3.5cqi, 1.4rem)', lineHeight: '1.2' }}
            autoFocus
          />
        </div>
      ) : (
        <div className={`flex items-center gap-1 ${isCentered || emphasis ? "justify-center" : ""}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={`font-mono font-bold ${noData ? "text-muted-foreground" : `${accentGlow} ${accentColor}`} ${isCentered ? "w-full block text-center" : ""}`}
                style={isCentered || emphasis ? (isShort ? emphasisValueShortStyle : emphasisValueLongStyle) : (isShort ? valueShortStyle : valueLongStyle)}
                title={displayValue}
              >
                {abbreviatedDisplay}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs font-mono">
              {displayValue}
            </TooltipContent>
          </Tooltip>
          {isActual && !isActualNotSet && (
            <>
              <button
                onClick={handleEditClick}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
                title="Edit actual balance"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={clearActualBalance}
                className="text-muted-foreground hover:text-chart-red transition-colors p-0.5 rounded"
                title="Clear actual balance"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );

  const momBlock = !isActual && !noData && (showAlt && altMomDelta ? altMomDelta : momDelta) ? (
    <p
      className={`font-mono text-muted-foreground ${isCentered || emphasis ? "text-[0.65rem] whitespace-normal break-words text-center w-full px-1 leading-tight" : ""}`}
      style={isCentered || emphasis ? undefined : sublineStyle}
      title={showAlt && altMomDelta ? altMomDelta : momDelta}
    >
      {showAlt && altMomDelta ? altMomDelta : momDelta}
    </p>
  ) : null;


  const contextBlock = (() => {
    if (noData) return null;
    if (isActual) {
      if (isActualNotSet) return null;
      let discrepancy: React.ReactNode = null;
      if (localActualValue !== null) {
        const todayRaw = altValue ?? "";
        let todayNum = 0;
        const mM = todayRaw.match(/\$([0-9.]+)M/);
        const mK = todayRaw.match(/\$([0-9.]+)K/);
        const mPlain = todayRaw.match(/\$([0-9,]+)/);
        if (mM) todayNum = parseFloat(mM[1]) * 1_000_000;
        else if (mK) todayNum = parseFloat(mK[1]) * 1_000;
        else if (mPlain) todayNum = parseFloat(mPlain[1].replace(/,/g, ''));
        if (todayNum !== 0) {
          const diff = localActualValue - todayNum;
          const isOver = diff >= 0;
          const absDiff = Math.abs(diff);
          const diffFmt = absDiff >= 1000 ? `$${(absDiff / 1000).toFixed(1)}K` : `$${Math.round(absDiff).toLocaleString()}`;
          discrepancy = (
            <p
              style={emphasis ? undefined : sublineStyle}
              className={`font-mono font-medium leading-tight ${emphasis ? "text-[0.65rem]" : ""} ${isOver ? 'text-chart-green' : 'text-chart-red'}`}
            >
              {isOver ? '↑' : '↓'} {diffFmt} {isOver ? 'above' : 'below'} est.
            </p>
          );
        }
      }
      return (
        <div className="space-y-0.5">
          <p style={emphasis ? undefined : sublineStyle} className={`text-muted-foreground font-mono leading-tight ${emphasis ? "text-[0.65rem]" : ""}`}>
            {resolvedActualDate}
          </p>
          {discrepancy}
        </div>
      );
    }
    const ctx = showAlt && altMomContext ? altMomContext : momContext;
    return ctx ? (
      <p
        className={`font-mono text-muted-foreground/80 leading-tight ${isCentered || emphasis ? "text-[0.65rem] whitespace-normal break-words text-center w-full px-1" : ""}`}
        style={isCentered || emphasis ? undefined : noteStyle}
        title={ctx}
      >
        {ctx}
      </p>
    ) : null;
  })();



  const cashPositionSubtextBlock = isCashflowPosition ? (
    <p
      className="font-mono text-muted-foreground/80 leading-tight text-center w-full px-1 whitespace-nowrap overflow-hidden text-ellipsis"
      style={{ fontSize: "clamp(9px, 0.75vw, 11px)" }}
    >
      {mode === "alt2"
        ? isActualNotSet
          ? "Enter your real balance to compare"
          : "Your real bank balance (entered manually)"
        : mode === "alt"
        ? "Live cash balance right now"
        : "Balance on the 1st of this month"}
    </p>
  ) : null;

  const trendBlock = (
    <div style={{ minWidth: 0 }} className={`${isCentered || emphasis ? "w-full flex flex-col items-center" : "mt-auto pt-1"}`}>
      {showAlt && altDiff && !noData && (
        <p className={`font-mono text-amber-400/80 leading-tight ${isCentered || emphasis ? "text-[0.65rem]" : ""}`} style={isCentered || emphasis ? undefined : sublineStyle} title={`${altDiff} with YLWs`}>
          ↑ {altDiff} with YLWs
        </p>
      )}
      {!isActual && !noData && displayChange !== "--" && (
        <div
          className={`flex items-center gap-0.5 font-mono leading-tight ${isCentered || emphasis ? "justify-center text-[0.65rem]" : ""} ${accentColor}`}
          style={isCentered || emphasis ? undefined : { ...sublineStyle, display: 'flex', WebkitLineClamp: undefined, WebkitBoxOrient: undefined }}
        >
          {displayPositive ? <TrendingUp className="w-3 h-3 shrink-0" /> : <TrendingDown className="w-3 h-3 shrink-0" />}
          <span className={isCentered || emphasis ? "" : "truncate"} title={displayChange}>{displayChange}</span>
        </div>
      )}
    </div>
  );


  const barBlock = (
    <div className={`mt-1.5 h-[3px] bg-secondary rounded-full overflow-hidden w-full ${emphasis ? "mt-auto" : ""}`}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: noData ? "0%" : displayPositive ? "72%" : "45%" }}
        transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
        className={`h-full rounded-full ${barColor}`}
      />
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={`stat-card relative overflow-hidden flex flex-col ${emphasis ? "items-center text-center h-full p-3 gap-1" : "gap-0.5"} ${ylwGlowClass}`}
      style={emphasis
        ? { containerType: 'inline-size' }
        : { minHeight: "90px", containerType: 'inline-size', padding: "clamp(0.65rem, 1.5vw, 1.1rem)" }}
    >
      {emphasis ? (
        <>
          {/* HEADER — fixed height, 2-line capable, never truncate */}
          <div className="w-full min-h-[1.5rem] flex items-center justify-center gap-1.5 min-w-0 px-1">
            <p className={emphasisTitleClass} title={label} style={{ whiteSpace: 'normal', overflow: 'visible' }}>
              {label}
            </p>
            {badges}
          </div>
          {/* PILLS — reserved row even when empty */}
          <div className="w-full min-h-[1.5rem] flex items-center justify-center">
            {pillsBlock}
          </div>
          {/* BODY — figure + sub-lines centred (trend lives inside as a sub) */}
          <div className="flex-1 flex flex-col items-center justify-center gap-0.5 w-full min-w-0">
            {valueBlock}
            {cashPositionSubtextBlock}
            {momBlock}
            {contextBlock}
            {trendBlock}
          </div>
        </>


      ) : (
        <>
          {/* ROW 1 — Label + badges */}
          <div className="flex items-start justify-between gap-1" style={{ minWidth: 0, overflow: 'hidden' }}>
            <div style={{ minWidth: 0, flex: '1 1 0%' }}>
              <p className="font-mono text-muted-foreground font-medium" style={titleStyle} title={label}>{label}</p>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0 flex-wrap justify-end" style={{ maxWidth: "50%" }}>
              {badges}
            </div>
          </div>
          {pillsBlock}
          {valueBlock}
          {momBlock}
          {contextBlock}
          {trendBlock}
          {barBlock}
        </>
      )}
    </motion.div>
  );
};


export default StatCard;