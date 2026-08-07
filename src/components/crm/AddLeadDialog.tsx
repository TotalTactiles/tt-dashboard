import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useCrmRefs,
  findSimilarLeads,
  searchOrganisations,
  fetchLeadStates,
  createLead,
  type OrgSuggestion,
  type SimilarLeadRow,
} from "@/hooks/useCrmLeads";
import DuplicateWarning, { classifyDuplicates, type DupState, type SimilarLead } from "./DuplicateWarning";

export default function AddLeadDialog({
  open, onOpenChange, onCreated, onOpenLead,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (leadId: string) => void;
  onOpenLead: (leadId: string) => void;
}) {
  const refs = useCrmRefs();
  const { toast } = useToast();

  const [projectName, setProjectName] = useState("");
  const [companyBuilder, setCompanyBuilder] = useState("");
  const [organisationId, setOrganisationId] = useState<string | null>(null);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companySuggestions, setCompanySuggestions] = useState<OrgSuggestion[]>([]);
  const [state, setState] = useState("");
  const [states, setStates] = useState<string[]>(["NSW", "QLD"]);
  const [source, setSource] = useState("");

  const [contactName, setContactName] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [directEmail, setDirectEmail] = useState("");
  const [receptionName, setReceptionName] = useState("");
  const [receptionEmail, setReceptionEmail] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [dupRows, setDupRows] = useState<SimilarLead[]>([]);
  const [dupChecking, setDupChecking] = useState(false);
  const [dupConfirmed, setDupConfirmed] = useState(false);
  const [dupRaceExact, setDupRaceExact] = useState<SimilarLead | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProjectName(""); setCompanyBuilder(""); setOrganisationId(null);
    setCompanyOpen(false); setCompanySuggestions([]);
    setState(""); setSource("");
    setContactName(""); setRole(""); setPhone(""); setDirectEmail("");
    setReceptionName(""); setReceptionEmail(""); setSiteAddress(""); setNotes("");
    setDupRows([]); setDupConfirmed(false);
    fetchLeadStates().then(setStates).catch(() => {});
  }, [open]);

  // -------- duplicate check (debounced) --------
  const dupSeq = useRef(0);
  useEffect(() => {
    if (!open) return;
    const p = projectName.trim();
    if (p.length < 3) { setDupRows([]); setDupConfirmed(false); return; }
    const seq = ++dupSeq.current;
    setDupChecking(true);
    const t = setTimeout(async () => {
      try {
        const rows = await findSimilarLeads(p, companyBuilder.trim() || null);
        if (dupSeq.current !== seq) return;
        setDupRows(rows as SimilarLead[]);
        setDupConfirmed(false);
      } catch {
        if (dupSeq.current !== seq) return;
        setDupRows([]);
      } finally {
        if (dupSeq.current === seq) setDupChecking(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [open, projectName, companyBuilder]);

  const dupState: DupState = useMemo(() => classifyDuplicates(dupRows), [dupRows]);

  // -------- company autocomplete --------
  const companySeq = useRef(0);
  useEffect(() => {
    if (!open) return;
    const q = companyBuilder.trim();
    if (q.length < 2) { setCompanySuggestions([]); return; }
    const seq = ++companySeq.current;
    const t = setTimeout(async () => {
      try {
        const rows = await searchOrganisations(q);
        if (companySeq.current === seq) setCompanySuggestions(rows);
      } catch {
        if (companySeq.current === seq) setCompanySuggestions([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [open, companyBuilder]);

  function pickOrganisation(o: OrgSuggestion) {
    setCompanyBuilder(o.name);
    setOrganisationId(o.id);
    setCompanyOpen(false);
  }
  function useTypedCompany() {
    setOrganisationId(null);
    setCompanyOpen(false);
  }

  const exactMatchFromExisting =
    companySuggestions.find((o) => o.name.toLowerCase() === companyBuilder.trim().toLowerCase());
  const showCreateNew = companyBuilder.trim().length >= 2 && !exactMatchFromExisting;

  // -------- readiness --------
  const canSave =
    projectName.trim().length >= 2 &&
    companyBuilder.trim().length >= 2 &&
    state.trim().length > 0 &&
    dupState.kind !== "exact_live" &&
    (dupState.kind === "none" || dupConfirmed) &&
    !dupChecking &&
    !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      const lead = await createLead({
        project_name: projectName,
        company_builder: companyBuilder,
        organisation_id: organisationId,
        state,
        project_contact_name: contactName,
        role,
        phone,
        direct_email: directEmail,
        reception_name: receptionName,
        reception_email: receptionEmail,
        site_address: siteAddress,
        notes,
        source_code: source || null,
      });
      toast({ title: "Lead created", description: `${lead.project_name} · ${lead.company_builder}` });
      onCreated(lead.id);
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Could not create lead",
        description: err?.message ?? "Try again",
        className: "border-destructive/40 bg-destructive/10 text-destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add lead</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Required block */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Project name *</Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="mt-1"
                placeholder="e.g. Prosper, Kogarah"
              />
              {dupChecking && projectName.trim().length >= 3 && (
                <div className="text-[10px] font-mono text-muted-foreground mt-1">Checking for duplicates…</div>
              )}
            </div>

            <DuplicateWarning
              state={dupState}
              confirmed={dupConfirmed}
              onConfirm={setDupConfirmed}
              onOpen={(id) => { onOpenLead(id); onOpenChange(false); }}
            />

            <div className="relative">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Company / builder *</Label>
              <Input
                value={companyBuilder}
                onChange={(e) => { setCompanyBuilder(e.target.value); setOrganisationId(null); setCompanyOpen(true); }}
                onFocus={() => setCompanyOpen(true)}
                onBlur={() => setTimeout(() => setCompanyOpen(false), 150)}
                className="mt-1"
                placeholder="Start typing…"
                autoComplete="off"
              />
              {organisationId && (
                <div className="text-[10px] font-mono text-chart-green mt-1">
                  Linked to existing builder record
                </div>
              )}
              {companyOpen && (companySuggestions.length > 0 || showCreateNew) && (
                <div className="absolute z-50 left-0 right-0 mt-1 rounded-md border border-border bg-popover shadow-md max-h-64 overflow-y-auto">
                  {companySuggestions.map((o) => (
                    <button
                      type="button"
                      key={o.id}
                      onMouseDown={(e) => { e.preventDefault(); pickOrganisation(o); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                    >
                      <span className="flex-1">{o.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {o.lead_count} lead{o.lead_count === 1 ? "" : "s"}
                      </span>
                    </button>
                  ))}
                  {showCreateNew && (
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); useTypedCompany(); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-t border-border text-chart-orange"
                    >
                      Create new builder: <span className="font-semibold">{companyBuilder.trim()}</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">State *</Label>
                <Select value={state || "__none"} onValueChange={(v) => setState(v === "__none" ? "" : v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent>
                    {states.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Source</Label>
                <Select value={source || "__none"} onValueChange={(v) => setSource(v === "__none" ? "" : v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {(refs?.sources ?? []).map((s) => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Optional block */}
          <div className="rounded-md border border-border p-3 space-y-3">
            <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">Optional details</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Contact name</Label>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Role</Label>
                <Input value={role} onChange={(e) => setRole(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Direct email</Label>
                <Input value={directEmail} onChange={(e) => setDirectEmail(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Reception name</Label>
                <Input value={receptionName} onChange={(e) => setReceptionName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Reception email</Label>
                <Input value={receptionEmail} onChange={(e) => setReceptionEmail(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Site address</Label>
              <Input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" rows={3} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button disabled={!canSave} onClick={save}>{saving ? "Creating…" : "Create lead"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
