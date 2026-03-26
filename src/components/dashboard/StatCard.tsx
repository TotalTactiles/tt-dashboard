import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Pencil } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
}

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

// Inline styles for fluid typography using container query inline units
const titleStyle: React.CSSProperties = {
  fontSize: 'clamp(0.5rem, 1.8cqi, 0.65rem)',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
  maxWidth: '100%',
};

const valueShortStyle: React.CSSProperties = {
  fontSize: 'clamp(1rem, 4.5cqi, 1.8rem)',
  lineHeight: '1.2',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
  display: 'block',
  maxWidth: '100%',
};

const valueLongStyle: React.CSSProperties = {
  fontSize: 'clamp(0.75rem, 3.5cqi, 1.4rem)',
  lineHeight: '1.2',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
  display: 'block',
  maxWidth: '100%',
};

const sublineStyle: React.CSSProperties = {
  fontSize: 'clamp(0.55rem, 1.6cqi, 0.72rem)',
  lineHeight: '1.4',
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  minWidth: 0,
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

const StatCard = ({ label, value, change, positive, index, noData, formulaDriven, altValue, altChange, altPositive, altDiff, goalAdjusted, toggleLabelBase, toggleLabelAlt, momDelta, altMomDelta, momContext, altMomContext, greenAltPill, altValue2, altChange2, altPositive2, toggleLabelAlt2 }: StatCardProps) => {
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

  const hasToggle = !!altValue;
  const hasThirdToggle = !!toggleLabelAlt2;

  // Legacy compat
  const showAlt = mode === "alt";

  // Use local state for Actual if available (instant update without reload)
  const resolvedActualValue = localActualValue !== null
    ? `$${localActualValue >= 1_000_000 ? (localActualValue / 1_000_000).toFixed(2) + 'M' : localActualValue >= 1000 ? (localActualValue / 1000).toFixed(1) + 'K' : localActualValue.toFixed(0)}`
    : altValue2 ?? "Tap to set";
  const resolvedActualDate = localActualDate ? `Actual · ${localActualDate}` : (altChange2 ?? 'Actual · not set');
  const isActualNotSet = resolvedActualValue === "Tap to set";

  const displayValue = mode === "alt2" ? resolvedActualValue : mode === "alt" && altValue ? altValue : value;
  const displayChange = mode === "alt2" ? resolvedActualDate : mode === "alt" && altChange ? altChange : change;
  const displayPositive = mode === "alt2" ? (localActualValue ?? 0) >= 0 : mode === "alt" && altPositive !== undefined ? altPositive : positive;

  const isYellow = hasToggle && mode === "alt" && !greenAltPill;
  const isActual = mode === "alt2";

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={`stat-card relative overflow-hidden flex flex-col gap-0.5 ${ylwGlowClass}`}
      style={{ minHeight: "100px", containerType: 'inline-size' }}
    >
      {/* ROW 1 — Label + badges */}
      <div className="flex items-start justify-between gap-1" style={{ minWidth: 0, overflow: 'hidden' }}>
        <div style={{ minWidth: 0, flex: '1 1 0%' }}>
          <p
            className="font-mono text-muted-foreground font-medium"
            style={titleStyle}
            title={label}
          >
            {label}
          </p>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0 flex-wrap justify-end" style={{ maxWidth: "50%" }}>
          {isActual && (
            <span className="text-[9px] font-mono text-amber-400/70 bg-amber-400/10 border border-amber-400/20 rounded px-1 py-0.5 leading-none whitespace-nowrap" style={{ flexShrink: 0 }}>
              manual
            </span>
          )}
          {goalAdjusted && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-[9px] font-mono text-amber-400/70 bg-amber-400/10 border border-amber-400/20 rounded px-1 py-0.5 leading-none cursor-help whitespace-nowrap" style={{ flexShrink: 0 }}>
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
                <span className="text-[9px] font-mono text-chart-green/70 bg-chart-green/10 border border-chart-green/20 rounded px-1 py-0.5 leading-none whitespace-nowrap" style={{ flexShrink: 0 }}>
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
      </div>

      {/* Toggle pills — own row below label when present */}
      {hasToggle && !noData && (
        <div className="flex mt-0.5 mb-0.5">
          <div className="flex rounded-full bg-secondary/80 p-0.5 leading-none" style={{ fontSize: "clamp(8px, 0.85vw, 10px)" }}>
            <button
              onClick={() => setMode("base")}
              className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${
                mode === "base"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="hidden sm:inline">{toggleLabelBase ?? "Confirmed"}</span>
              <span className="sm:hidden">✓</span>
            </button>
            <button
              onClick={() => setMode("alt")}
              className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${
                mode === "alt"
                  ? pillActiveClass
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {toggleLabelAlt ?? "With YLWs"}
            </button>
            {hasThirdToggle && (
              <button
                onClick={() => setMode("alt2")}
                className={`px-1.5 py-0.5 rounded-full transition-all duration-150 font-mono whitespace-nowrap ${
                  mode === "alt2"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {toggleLabelAlt2}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ROW 2 — Main value */}
      <div style={{ minWidth: 0, overflow: 'hidden' }} className="my-0.5">
        {isActual && (editing || isActualNotSet) ? (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground font-mono" style={{ fontSize: 'clamp(0.75rem, 3cqi, 1.2rem)' }}>$</span>
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={() => {
                if (inputValue.trim()) saveActualBalance(inputValue);
                else setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && inputValue.trim()) saveActualBalance(inputValue);
                if (e.key === "Escape") setEditing(false);
              }}
              placeholder="Enter bank balance..."
              className="bg-transparent border-b border-primary/40 outline-none font-mono font-bold text-foreground w-full"
              style={{ fontSize: 'clamp(0.75rem, 3.5cqi, 1.4rem)', lineHeight: '1.2' }}
              autoFocus
            />
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={`font-mono font-bold ${noData ? "text-muted-foreground" : `${accentGlow} ${accentColor}`}`}
                  style={isShort ? valueShortStyle : valueLongStyle}
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
              <button
                onClick={handleEditClick}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
                title="Edit actual balance"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ROW 3 — MoM delta (hidden for Actual toggle) */}
      {!isActual && !noData && (showAlt && altMomDelta ? altMomDelta : momDelta) && (
        <p
          className="font-mono text-muted-foreground"
          style={sublineStyle}
          title={showAlt && altMomDelta ? altMomDelta : momDelta}
        >
          {showAlt && altMomDelta ? altMomDelta : momDelta}
        </p>
      )}

      {/* ROW 3b — Monthly context / Actual discrepancy */}
      {!noData && (() => {
        if (isActual) {
          if (isActualNotSet) return null;
          return (
            <div className="space-y-0.5">
              {/* Date line */}
              <p style={sublineStyle} className="text-muted-foreground font-mono">
                {resolvedActualDate}
              </p>
              {/* Discrepancy vs Today estimate */}
              {(() => {
                if (localActualValue === null) return null;
                const todayRaw = altValue ?? "";
                let todayNum = 0;
                const mM = todayRaw.match(/\$([0-9.]+)M/);
                const mK = todayRaw.match(/\$([0-9.]+)K/);
                const mPlain = todayRaw.match(/\$([0-9,]+)/);
                if (mM) todayNum = parseFloat(mM[1]) * 1_000_000;
                else if (mK) todayNum = parseFloat(mK[1]) * 1_000;
                else if (mPlain) todayNum = parseFloat(mPlain[1].replace(/,/g, ''));
                if (todayNum === 0) return null;
                const diff = localActualValue - todayNum;
                const isOver = diff >= 0;
                const absDiff = Math.abs(diff);
                const diffFmt = absDiff >= 1000
                  ? `$${(absDiff / 1000).toFixed(1)}K`
                  : `$${Math.round(absDiff).toLocaleString()}`;
                return (
                  <p
                    style={sublineStyle}
                    className={`font-mono font-medium ${isOver ? 'text-chart-green' : 'text-chart-red'}`}
                  >
                    {isOver ? '↑' : '↓'} {diffFmt} {isOver ? 'above' : 'below'} est.
                  </p>
                );
              })()}
            </div>
          );
        }
        const ctx = showAlt && altMomContext ? altMomContext : momContext;
        return ctx ? (
          <p className="font-mono text-muted-foreground/80" style={noteStyle} title={ctx}>
            {ctx}
          </p>
        ) : null;
      })()}

      {/* ROW 4 — Secondary metric / change + alt diff */}
      <div style={{ minWidth: 0, overflow: 'hidden' }} className="mt-auto pt-1">
        {showAlt && altDiff && !noData && (
          <p className="font-mono text-amber-400/80" style={sublineStyle} title={`${altDiff} with YLWs`}>
            ↑ {altDiff} with YLWs
          </p>
        )}
        {!isActual && !noData && displayChange !== "--" && (
          <div className={`flex items-center gap-0.5 font-mono ${accentColor}`} style={{ ...sublineStyle, display: 'flex', WebkitLineClamp: undefined, WebkitBoxOrient: undefined }}>
            {displayPositive ? <TrendingUp className="w-3 h-3 shrink-0" /> : <TrendingDown className="w-3 h-3 shrink-0" />}
            <span className="truncate" title={displayChange}>{displayChange}</span>
          </div>
        )}
      </div>

      {/* ROW 5 — Progress bar */}
      <div className="mt-1.5 h-[3px] bg-secondary rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: noData ? "0%" : displayPositive ? "72%" : "45%" }}
          transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
          className={`h-full rounded-full ${barColor}`}
        />
      </div>
    </motion.div>
  );
};

export default StatCard;