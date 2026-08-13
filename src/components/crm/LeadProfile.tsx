import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, UserCog } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import SectionHeader from "@/components/dashboard/SectionHeader";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getStoredOperator, OperatorPicker, useOperators } from "@/components/crm/WorkingAsGate";

const db = supabase as any;


const DASH = "-";
const CALL_ACCENT = "#3D89DA";

const STAGE_LABEL: Record<string, string> = {
  new: "New",
  enriching: "Enriching",
  ready_to_call: "Ready to call",
  actioned: "Actioned",
  responded: "Responded",
  needs_attention: "Needs attention",
  converted: "Converted",
  archived: "Archived",
};

const STAGES = [
  "new",
  "enriching",
  "ready_to_call",
  "actioned",
  "responded",
  "needs_attention",
  "converted",
  "archived",
] as const;


interface Profile {
  id: string;
  company_builder: string | null;
  project_name: string | null;
  state: string | null;
  notes: string | null;
  stage: string | null;
  organisation_name: string | null;
  org_phone: string | null;
  org_website: string | null;
  project_contact_name: string | null;
  direct_email: string | null;
  role: string | null;
  phone: string | null;
  reception_name: string | null;
  timing_band: string | null;
  days_overdue: number | null;
  due_date: string | null;
  guidance: string | null;
  date_source: string | null;
  lead_timezone: string | null;
  deals_completed: number | null;
  deals_live: number | null;
  deals_lost: number | null;
  org_leads: number | null;
  org_emailed: number | null;
  org_replied: number | null;
  response_rate_pct: number | null;
  claim_holder: string | null;
  claim_active: boolean | null;
  date_precision: string | null;
  period_label: string | null;
  period_end: string | null;
  days_overdue_max: number | null;
  organisation_id: string | null;
}

interface TimelineRow {
  at: string;
  source: string;
  kind: string | null;
  label: string | null;
  detail: string | null;
  who: string | null;
  actor: string | null;
  ref: string | null;
}

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded border border-border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">
    {children}
  </span>
);

const Dim = () => <span className="text-muted-foreground/50">{DASH}</span>;

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-wrap items-baseline gap-2 text-sm">
    <span className="w-28 shrink-0 font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">
      {label}
    </span>
    <span>{children}</span>
  </div>
);

const Stat = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded border border-border px-2 py-1.5">
    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    <div className="font-mono text-base leading-tight">{value}</div>
  </div>
);

function sourceLine(src: string | null) {
  if (src === "notes") return "from the lead notes";
  if (src === "search") return "from a search";
  if (src === "manual") return "entered by hand";
  return null;
}

function fmtPeriodEnd(raw: string) {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtWhen(iso: string, tz: string | null) {
  try {
    return new Date(iso).toLocaleString("en-AU", {
      timeZone: tz || "Australia/Sydney",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return new Date(iso).toLocaleString("en-AU");
  }
}

/**
 * The one write on this page. Stage changes go through the tt-lead-stage n8n
 * workflow, never through a direct table update. Three outcomes always: ok,
 * error (including a HTTP 200 carrying ok:false) and network.
 */
function StageControl({
  leadId,
  stage,
  operator,
  onChanged,
}: {
  leadId: string;
  stage: string | null;
  operator: string | null;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);


  const options = STAGES.filter((s) => s !== stage);
  const current = stage ? STAGE_LABEL[stage] ?? stage.replace(/_/g, " ") : "no stage";

  async function change(to: string) {
    if (busy || !operator) return;
    setBusy(true);

    let result:
      | { kind: "ok"; to: string }
      | { kind: "error"; message: string }
      | { kind: "network"; message: string } = { kind: "network", message: "the stage workflow did not respond" };

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30_000);
      const res = await fetch("https://n8n.srv1437130.hstgr.cloud/webhook/tt-lead-stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, operator, to_stage: to }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      let json: any = null;
      try { json = await res.json(); } catch { /* non-json */ }
      if (!res.ok || json?.ok !== true) {
        const reason = json?.reason ?? json?.error ?? json?.message;
        const held = json?.held_by ? ` (held by ${json.held_by})` : "";
        result = {
          kind: "error",
          message: `${String(reason ?? `HTTP ${res.status}`)}${held}`,
        };
      } else {
        result = { kind: "ok", to: String(json.to_stage ?? to) };
      }
    } catch {
      result = { kind: "network", message: "the stage workflow did not respond" };
    }

    setBusy(false);

    if (result.kind === "ok") {
      toast({
        title: "Stage changed",
        description: `Moved to ${STAGE_LABEL[result.to] ?? result.to.replace(/_/g, " ")}`,
      });
      onChanged();
    } else {
      toast({
        title: "The stage was not changed",
        description: result.message,
        className: "border-chart-orange/40 bg-chart-orange/10 text-chart-orange",
      });
    }
  }

  return (
    <Select value="" onValueChange={change} disabled={busy || !operator}>
      <SelectTrigger
        className="h-auto w-auto gap-1.5 rounded border-border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground"
        title={operator ? "Change the stage" : "Pick who is working, using the button beside this, before changing the stage"}
      >
        {busy ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> saving
          </span>
        ) : (
          <SelectValue placeholder={operator ? current : `${current} - pick who is working`} />
        )}

      </SelectTrigger>
      <SelectContent>
        {options.map((s) => (
          <SelectItem key={s} value={s} className="text-xs">
            {STAGE_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}


/**
 * Reads the operator list from the one producer in WorkingAsGate so this page
 * never keeps a second copy of it. Nothing here writes to the database.
 */
function OperatorControl({
  operator,
  onChoose,
}: {
  operator: string | null;
  onChoose: (handle: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { operators, loading, error } = useOperators();

  const match = operator ? operators.find((o) => o.handle === operator) : undefined;
  const unknown = !!operator && !loading && !error && !match;

  const label = !operator
    ? "pick who is working"
    : match
      ? `working as ${match.display_name}`
      : unknown
        ? `working as ${operator} (not an active user)`
        : `working as ${operator}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-auto gap-1.5 rounded px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-widest ${
            operator ? "text-muted-foreground" : "border-primary/50 text-primary"
          }`}
        >
          <UserCog className="h-3 w-3" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm uppercase tracking-wider">Who's working?</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Activity on this lead is attributed to the name you pick.
        </p>
        <OperatorPicker
          compact
          onChoose={(handle) => { onChoose(handle); setOpen(false); }}
        />
      </DialogContent>
    </Dialog>
  );
}

export default function LeadProfile() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [timeline, setTimeline] = useState<TimelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [operator, setOperator] = useState<string | null>(() => getStoredOperator());



  useEffect(() => {
    if (!id) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      setTimelineError(null);
      const [p, t] = await Promise.all([
        db.from("v_lead_profile").select("*").eq("id", id).maybeSingle(),
        db.from("v_lead_timeline").select("*").eq("lead_id", id).order("at", { ascending: false }),
      ]);
      if (cancel) return;

      if (p.error) {
        setLoadError(p.error.message || "The lead could not be loaded.");
        setProfile(null);
        setNotFound(false);
      } else if (!p.data) {
        setProfile(null);
        setNotFound(true);
        setLoadError(null);
      } else {
        setProfile(p.data as Profile);
        setNotFound(false);
        setLoadError(null);
      }

      if (t.error) {
        setTimelineError(t.error.message || "The timeline could not be loaded.");
        setTimeline([]);
      } else {
        setTimeline((t.data as TimelineRow[]) ?? []);
      }

      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [id, refreshNonce]);

  const tz = profile?.lead_timezone ?? null;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
        <SectionHeader title="LEAD PROFILE">
          <Link to="/oven" className="flex items-center gap-1 font-mono text-xs text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> back to the Oven
          </Link>
        </SectionHeader>

        {loading && (
          <div className="flex items-center justify-center rounded-md border border-border bg-card py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        {!loading && loadError && (
          <div className="rounded-md border border-border bg-card px-3 py-8 text-center text-sm text-muted-foreground">
            <div>That lead could not be loaded.</div>
            <div className="mt-1 text-xs text-muted-foreground/80">{loadError}</div>
          </div>
        )}

        {!loading && !loadError && notFound && (
          <div className="rounded-md border border-border bg-card px-3 py-8 text-center text-sm text-muted-foreground">
            That lead could not be found.
          </div>
        )}

        {!loading && profile && (
          <>
            {/* 1. header */}
            <div className="rounded-md border border-border bg-card px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl md:text-2xl font-semibold leading-tight">
                    <FieldControl
                      leadId={profile.id}
                      field="company_builder"
                      label="builder"
                      value={profile.company_builder}
                      operator={operator}
                      placeholder="no builder"
                      className="text-xl md:text-2xl font-semibold leading-tight"
                      onSaved={() => setRefreshNonce((n) => n + 1)}
                    />
                  </h1>
                  <div className="text-sm text-muted-foreground">
                    <FieldControl
                      leadId={profile.id}
                      field="project_name"
                      label="project name"
                      value={profile.project_name}
                      operator={operator}
                      placeholder="add a project name"
                      className="text-sm text-muted-foreground"
                      onSaved={() => setRefreshNonce((n) => n + 1)}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-border px-2 py-0.5">
                    <FieldControl
                      leadId={profile.id}
                      field="state"
                      label="state"
                      value={profile.state}
                      operator={operator}
                      placeholder="state"
                      className="w-16 font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground"
                      onSaved={() => setRefreshNonce((n) => n + 1)}
                    />
                  </span>

                  <OperatorControl operator={operator} onChoose={setOperator} />
                  <StageControl
                    leadId={profile.id}
                    stage={profile.stage}
                    operator={operator}
                    onChanged={() => setRefreshNonce((n) => n + 1)}
                  />


                  {profile.timing_band && <Chip>{profile.timing_band}</Chip>}
                </div>
              </div>
              {profile.claim_active && profile.claim_holder && (
                <div className="mt-2 font-mono text-xs text-muted-foreground">
                  {profile.claim_holder} is working this lead
                </div>
              )}
            </div>

            {/* 2. contact */}
            <div className="rounded-md border border-border bg-card px-4 py-3 space-y-1.5">
              <div className="font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">Contact</div>
              <Row label="name">
                <span className="flex flex-wrap items-center gap-1">
                  <FieldControl
                    leadId={profile.id}
                    field="project_contact_name"
                    label="contact name"
                    value={profile.project_contact_name}
                    operator={operator}
                    placeholder="add a name"
                    onSaved={() => setRefreshNonce((n) => n + 1)}
                  />
                  <span className="text-muted-foreground"> - </span>
                  <FieldControl
                    leadId={profile.id}
                    field="role"
                    label="role"
                    value={profile.role}
                    operator={operator}
                    placeholder="add a role"
                    className="text-muted-foreground"
                    onSaved={() => setRefreshNonce((n) => n + 1)}
                  />
                </span>
              </Row>
              <Row label="email">
                <span className="flex items-center gap-1">
                  <FieldControl
                    leadId={profile.id}
                    field="direct_email"
                    label="direct email"
                    value={profile.direct_email}
                    operator={operator}
                    placeholder="add an email"
                    onSaved={() => setRefreshNonce((n) => n + 1)}
                  />
                  {profile.direct_email && (
                    <a
                      className="text-primary hover:underline"
                      href={`mailto:${profile.direct_email}`}
                      title="Open in your mail client"
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </a>
                  )}
                </span>
              </Row>
              <Row label="phone">
                <span className="flex items-center gap-1">
                  <FieldControl
                    leadId={profile.id}
                    field="phone"
                    label="phone"
                    value={profile.phone}
                    operator={operator}
                    placeholder="add a phone number"
                    onSaved={() => setRefreshNonce((n) => n + 1)}
                  />
                  {profile.phone && (
                    <a className="text-primary hover:underline" href={`tel:${profile.phone}`} title="Call this number">
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  )}
                </span>
              </Row>
              <Row label="reception">
                <FieldControl
                  leadId={profile.id}
                  field="reception_name"
                  label="reception name"
                  value={profile.reception_name}
                  operator={operator}
                  placeholder="add a name"
                  onSaved={() => setRefreshNonce((n) => n + 1)}
                />
              </Row>
              <Row label="reception email">
                <FieldControl
                  leadId={profile.id}
                  field="reception_email"
                  label="reception email"
                  value={profile.reception_email}
                  operator={operator}
                  placeholder="add an email"
                  onSaved={() => setRefreshNonce((n) => n + 1)}
                />
              </Row>
              <Row label="site">
                <FieldControl
                  leadId={profile.id}
                  field="site_address"
                  label="site address"
                  value={profile.site_address}
                  operator={operator}
                  placeholder="add an address"
                  onSaved={() => setRefreshNonce((n) => n + 1)}
                />
              </Row>
            </div>


            {/* 3. company */}
            <div className="rounded-md border border-border bg-card px-4 py-3 space-y-1.5">
              <div className="font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">Company</div>
              <Row label="name">{profile.organisation_name || <Dim />}</Row>
              <Row label="phone">
                {profile.org_phone
                  ? <a className="text-primary hover:underline" href={`tel:${profile.org_phone}`}>{profile.org_phone}</a>
                  : <Dim />}
              </Row>
              <Row label="website">
                {profile.org_website
                  ? (
                    <a
                      className="text-primary hover:underline"
                      href={/^https?:\/\//i.test(profile.org_website) ? profile.org_website : `https://${profile.org_website}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {profile.org_website}
                    </a>
                  )
                  : <Dim />}
              </Row>
              {profile.organisation_id ? (
                <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-3 lg:grid-cols-7">
                  <Stat label="completed" value={profile.deals_completed ?? 0} />
                  <Stat label="live" value={profile.deals_live ?? 0} />
                  <Stat label="lost" value={profile.deals_lost ?? 0} />
                  <Stat label="leads" value={profile.org_leads ?? 0} />
                  <Stat label="emailed" value={profile.org_emailed ?? 0} />
                  <Stat label="replied" value={profile.org_replied ?? 0} />
                  {profile.response_rate_pct != null && (
                    <Stat label="reply rate" value={`${Number(profile.response_rate_pct).toFixed(0)}%`} />
                  )}
                </div>
              ) : (
                <div className="rounded border border-border px-2 py-1.5 pt-2">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">NO ORGANISATION LINKED</div>
                  <div className="text-sm">This lead is not linked to an organisation, so its company history is unknown. It is not zero.</div>
                </div>
              )}
            </div>

            {/* 4. timing */}
            <div className="rounded-md border border-border bg-card px-4 py-3 space-y-1.5">
              <div className="font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">Timing</div>
              <Row label="band">{profile.timing_band || <Dim />}</Row>
              <Row label="due">{profile.period_label || <Dim />}</Row>
              {profile.period_label && profile.period_end && profile.date_precision !== "day" && (
                <Row label="period">{`any time up to ${fmtPeriodEnd(profile.period_end)}`}</Row>
              )}
              <Row label="overdue">
                {profile.days_overdue == null
                  ? <Dim />
                  : profile.days_overdue_max != null && profile.days_overdue_max !== profile.days_overdue
                    ? `${profile.days_overdue} to ${profile.days_overdue_max} days`
                    : `${profile.days_overdue} days`}
              </Row>
              <Row label="date source">{sourceLine(profile.date_source) || <Dim />}</Row>
              {profile.guidance && (
                <div className="pt-1 text-sm text-muted-foreground">{profile.guidance}</div>
              )}
              {profile.date_precision && profile.date_precision !== "day" && (
                <div className="pt-1 text-sm text-muted-foreground">
                  {`Stated to ${profile.date_precision} precision, so this is a range rather than a date.`}
                </div>
              )}
            </div>

            {/* 5. timeline */}
            <div className="rounded-md border border-border bg-card px-4 py-3">
              <div className="mb-3 font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">
                Timeline
              </div>
              {timelineError ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <div>The timeline could not be loaded.</div>
                  <div className="mt-1 text-xs text-muted-foreground/80">{timelineError}</div>
                </div>
              ) : timeline.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No activity recorded yet</div>
              ) : (
                <div className="space-y-2">
                  {timeline.map((e, i) => (
                    <div
                      key={`${e.at}-${e.source}-${e.ref ?? i}`}
                      className="flex items-start justify-between gap-3 pl-3"
                      style={{
                        borderLeft: `2px solid ${e.source === "call" ? CALL_ACCENT : "hsl(var(--border))"}`,
                      }}
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">
                          {fmtWhen(e.at, tz)}
                        </div>
                        <div className="text-sm">{e.label || e.kind || DASH}</div>
                        {e.detail && (
                          <div className="whitespace-pre-line break-words text-xs text-muted-foreground">
                            {e.detail}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 font-mono text-xs text-muted-foreground">
                        {e.actor || e.who || DASH}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 6. notes */}
            <div className="rounded-md border border-border bg-card px-4 py-3">
              <div className="mb-2 font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">Notes</div>
              <FieldControl
                leadId={profile.id}
                field="notes"
                label="notes"
                value={profile.notes}
                operator={operator}
                placeholder="No notes recorded."
                multiline
                className="text-sm"
                onSaved={() => setRefreshNonce((n) => n + 1)}
              />
            </div>

          </>
        )}
      </div>
    </DashboardLayout>
  );
}
