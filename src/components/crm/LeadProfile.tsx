import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import SectionHeader from "@/components/dashboard/SectionHeader";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

const DASH = "-";
const CALL_ACCENT = "#3D89DA";

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

export default function LeadProfile() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [timeline, setTimeline] = useState<TimelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const [p, t] = await Promise.all([
        db.from("v_lead_profile").select("*").eq("id", id).maybeSingle(),
        db.from("v_lead_timeline").select("*").eq("lead_id", id).order("at", { ascending: false }),
      ]);
      if (cancel) return;
      setProfile((p.data as Profile) ?? null);
      setNotFound(!p.data);
      setTimeline((t.data as TimelineRow[]) ?? []);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [id]);

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

        {!loading && notFound && (
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
                    {profile.company_builder || "no builder"}
                  </h1>
                  <div className="text-sm text-muted-foreground">{profile.project_name || DASH}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {profile.state && <Chip>{profile.state}</Chip>}
                  {profile.stage && <Chip>{profile.stage.replace(/_/g, " ")}</Chip>}
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
                {profile.project_contact_name
                  ? <>
                      {profile.project_contact_name}
                      {profile.role && <span className="text-muted-foreground"> - {profile.role}</span>}
                    </>
                  : <Dim />}
              </Row>
              <Row label="email">
                {profile.direct_email
                  ? <a className="text-primary hover:underline" href={`mailto:${profile.direct_email}`}>{profile.direct_email}</a>
                  : <Dim />}
              </Row>
              <Row label="phone">
                {profile.phone
                  ? <a className="text-primary hover:underline" href={`tel:${profile.phone}`}>{profile.phone}</a>
                  : <Dim />}
              </Row>
              <Row label="reception">{profile.reception_name || <Dim />}</Row>
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
              {timeline.length === 0 ? (
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
              {profile.notes
                ? <div className="whitespace-pre-line break-words text-sm">{profile.notes}</div>
                : <div className="text-sm text-muted-foreground">No notes recorded.</div>}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
