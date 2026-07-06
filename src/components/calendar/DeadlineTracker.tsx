import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Circle, AlertTriangle, ExternalLink } from "lucide-react";
import { type LiveCalendarEvent } from "@/contexts/DashboardDataContext";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface DeadlineTrackerProps {
  events: LiveCalendarEvent[];
}

const STRATEGIC_COLOR = "#BA7517";

const PHASE_COLORS: Record<string, string> = {
  "Pre Seal": "#E24B4A",
  "Close the Seal": "#378ADD",
  "Post Seal": "#22C55E",
  "Legacy": "#BA7517",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDeadline(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

const DeadlineTracker = ({ events }: DeadlineTrackerProps) => {
  const [openId, setOpenId] = useState<string | null>(null);

  const deadlines = useMemo(() => {
    const now = new Date();
    return events
      .filter((e) => e.source === "Strategic Board" || e.id?.startsWith("sqb-"))
      .map((e) => {
        const eventDate = new Date(e.start);
        const diffMs = eventDate.getTime() - now.getTime();
        const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const status: "overdue" | "upcoming" | "completed" =
          daysRemaining < 0 ? "overdue" : "upcoming";
        return { ...e, daysRemaining, deadlineStatus: status, eventDate };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [events]);

  const statusConfig = {
    overdue: { icon: AlertTriangle },
    upcoming: { icon: Circle },
    completed: { icon: CheckCircle },
  };

  const selected = openId ? deadlines.find((d) => d.id === openId) ?? null : null;
  const selMeta = selected?.meta ?? null;
  const selPhase = (selMeta?.phase as string) ?? "Legacy";
  const selPhaseColor = PHASE_COLORS[selPhase] ?? STRATEGIC_COLOR;
  const selIsOverdue = selected ? selected.daysRemaining < 0 : false;
  const selCountdownColor = selIsOverdue ? "#E24B4A" : selPhaseColor;
  const selCountdownLabel = selected
    ? selected.daysRemaining < 0
      ? `${Math.abs(selected.daysRemaining)}d overdue`
      : selected.daysRemaining === 0
      ? "today"
      : `${selected.daysRemaining}d left`
    : "";

  const handleOpenInBoard = () => {
    setOpenId(null);
    // wait a tick so dialog unmounts cleanly before scroll
    requestAnimationFrame(() => {
      document.getElementById("strategic-quarters")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <>
      {/* Amber Strategic Board rail on the card */}
      <span className="absolute inset-y-0 left-0 w-[3px] bg-[#BA7517] pointer-events-none" />
      {/* Strategic Board pill */}
      <span
        className="absolute top-2 right-2 font-mono text-[8.5px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full pointer-events-none z-10"
        style={{ color: STRATEGIC_COLOR, background: hexA(STRATEGIC_COLOR, 0.16) }}
      >
        Strategic Board
      </span>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex-1 min-h-0 min-w-0 space-y-1 max-h-[320px] overflow-y-auto pr-1"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.15) transparent",
        }}
      >
        {deadlines.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[120px] px-4 py-8">
            <p className="text-[11.5px] text-muted-foreground/70 text-center leading-relaxed">
              No upcoming deadlines — set due dates on tasks in the Strategic Quarters board below
            </p>
          </div>
        ) : (
          deadlines.map((d) => {
            const cfg = statusConfig[d.deadlineStatus];
            const Icon = cfg.icon;
            const phaseMatch = d.title.match(/^\[([^\]]+)\]/);
            const phase = (d.meta?.phase as string) ?? phaseMatch?.[1] ?? "Strategic";
            const phaseColor = PHASE_COLORS[phase] ?? "#888780";
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setOpenId(d.id)}
                className="relative w-full text-left flex items-center gap-2.5 py-2 pl-3 pr-2.5 rounded-xl cursor-pointer transition-colors hover:bg-white/[0.04] min-w-0"
              >
                <span
                  className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-full"
                  style={{ background: STRATEGIC_COLOR }}
                />
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[12.5px] font-medium text-foreground/85 truncate"
                    title={d.title.replace(/^\[[^\]]+\]\s*/, "")}
                  >
                    {d.title.replace(/^\[[^\]]+\]\s*/, "")}
                  </p>
                  <div className="font-mono text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 min-w-0">
                    <span className="truncate">
                      {d.eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <span
                      className={`truncate ${
                        d.daysRemaining < 0
                          ? "text-destructive"
                          : d.daysRemaining <= 7
                          ? "text-chart-amber"
                          : "text-muted-foreground"
                      }`}
                    >
                      {d.daysRemaining < 0
                        ? `${Math.abs(d.daysRemaining)}d overdue`
                        : d.daysRemaining === 0
                        ? "Today"
                        : `${d.daysRemaining}d left`}
                    </span>
                  </div>
                </div>
                <span
                  className="font-mono text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
                  style={{ background: phaseColor + "29", color: phaseColor }}
                >
                  {phase}
                </span>
              </button>
            );
          })
        )}
      </motion.div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-[460px] rounded-2xl bg-background border-border p-5 gap-3">
          {selected && (
            <>
              <div className="flex items-start gap-2.5">
                <span
                  className="font-mono text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 mt-0.5"
                  style={{ color: selPhaseColor, background: hexA(selPhaseColor, 0.18) }}
                >
                  {selPhase}
                </span>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-[15px] font-semibold text-foreground leading-tight">
                    {selMeta?.taskTitle ?? selected.title.replace(/^\[[^\]]+\]\s*/, "")}
                  </DialogTitle>
                  {selMeta?.parent && (
                    <p className="font-mono text-[10.5px] text-muted-foreground mt-1 truncate">
                      {selMeta.parent}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="font-mono text-[10.5px] px-2.5 py-1 rounded-full"
                  style={{ color: selCountdownColor, background: hexA(selCountdownColor, 0.15) }}
                >
                  {fmtDeadline(selMeta?.deadline ?? selected.start)} · {selCountdownLabel}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-mono">
                    Progress
                  </span>
                  <span
                    className="font-mono text-[11px] font-semibold"
                    style={{ color: selPhaseColor }}
                  >
                    {selMeta?.progress ?? 0}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${selMeta?.progress ?? 0}%`,
                      background: selPhaseColor,
                    }}
                  />
                </div>
              </div>

              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-mono mb-2">
                  What's needed to complete this
                </p>
                {selMeta?.subtasks && selMeta.subtasks.length > 0 ? (
                  <ul className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1"
                      style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}>
                    {selMeta.subtasks.map((s: { title: string; done: boolean }, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span
                          className="mt-[3px] w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center shrink-0"
                          style={{
                            borderColor: s.done ? selPhaseColor : "hsl(var(--border))",
                            background: s.done ? selPhaseColor : "transparent",
                          }}
                        >
                          {s.done && (
                            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white">
                              <path d="M2 6l2.5 2.5L10 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <span
                          className={`text-[12px] leading-snug ${
                            s.done
                              ? "line-through text-muted-foreground/60"
                              : "text-foreground/90"
                          }`}
                        >
                          {s.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12px] text-muted-foreground/70 italic">
                    No sub-items — this deadline is a single item.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleOpenInBoard}
                  className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-foreground/80 hover:text-foreground transition-colors"
                >
                  Open in Strategic Quarters
                  <ExternalLink className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-[11.5px] font-medium hover:bg-primary/90 transition-colors"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DeadlineTracker;
