import { Fragment, useMemo, useState, type ReactNode } from "react";

const FragmentRow = ({ children }: { children: ReactNode }) => <Fragment>{children}</Fragment>;
import { ChevronDown, ChevronRight, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompanySummaries, useContactsByOrg, type CompanySummary } from "@/hooks/useContacts";
import EngagementBadge from "./EngagementBadge";

const DASH = "—";

function fmtDate(iso: string | null): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return DASH;
  const day = String(d.getDate()).padStart(2, "0");
  const m = d.toLocaleString("en-US", { month: "short" });
  return `${day} ${m} ${d.getFullYear()}`;
}

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return DASH;
  return String(n);
}

type SortKey =
  | "company_asc" | "company_desc"
  | "contacts" | "replied" | "emailed_no_reply"
  | "last_emailed" | "last_replied";

type ColKey = "company" | "contacts" | "replied" | "emailed_no_reply" | "never_contacted" | "last_emailed" | "last_replied";

const PAGE = 50;

export default function CompanyList() {
  const { rows, loading } = useCompanySummaries();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("company_asc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const base = s ? rows.filter(r => (r.company ?? "").toLowerCase().includes(s)) : rows;
    const sorted = base.slice().sort((a, b) => sortCompanies(a, b, sortKey));
    return sorted;
  }, [rows, search, sortKey]);

  const pageRows = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));

  const setCol = (col: ColKey) => {
    setSortKey((prev) => nextSortForColumn(col, prev));
    setPage(0);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search builder name…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="max-w-xs font-mono text-sm"
        />
        <Select value={sortKey} onValueChange={(v) => { setSortKey(v as SortKey); setPage(0); }}>
          <SelectTrigger className="w-[220px] font-mono text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="company_asc">Builder A–Z</SelectItem>
            <SelectItem value="company_desc">Builder Z–A</SelectItem>
            <SelectItem value="contacts">Most contacts</SelectItem>
            <SelectItem value="replied">Most replied</SelectItem>
            <SelectItem value="emailed_no_reply">Most emailed, no reply</SelectItem>
            <SelectItem value="last_emailed">Recently emailed</SelectItem>
            <SelectItem value="last_replied">Recently replied</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs font-mono text-muted-foreground ml-auto">
          {filtered.length} builder{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-6" />
                <ColHeader label="Builder" onClick={() => setCol("company")} align="left" />
                <ColHeader label="Contacts" onClick={() => setCol("contacts")} align="right" />
                <ColHeader label="Replied" onClick={() => setCol("replied")} align="right" />
                <ColHeader label="Emailed, no reply" onClick={() => setCol("emailed_no_reply")} align="right" />
                <ColHeader label="Never contacted" onClick={() => setCol("never_contacted")} align="right" />
                <ColHeader label="Last emailed" onClick={() => setCol("last_emailed")} align="right" />
                <ColHeader label="Last replied" onClick={() => setCol("last_replied")} align="right" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground text-sm">Loading…</td></tr>
              )}
              {!loading && pageRows.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground text-sm">No builders found.</td></tr>
              )}
              {pageRows.map((r) => {
                const isOpen = expanded === r.organisation_id;
                return (
                  <FragmentRow key={r.organisation_id}>
                    <tr
                      className="border-t border-border cursor-pointer hover:bg-muted/30"
                      onClick={() => setExpanded(isOpen ? null : r.organisation_id)}
                    >
                      <td className="pl-3 py-2">
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                      </td>
                      <td className="py-2 font-medium">{r.company ?? DASH}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{fmtNum(r.contacts)}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{fmtNum(r.replied)}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{fmtNum(r.emailed_no_reply)}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{fmtNum(r.never_contacted)}</td>
                      <td className="py-2 pr-3 text-right font-mono text-xs text-muted-foreground">{fmtDate(r.last_emailed)}</td>
                      <td className="py-2 pr-3 text-right font-mono text-xs text-muted-foreground">{fmtDate(r.last_replied)}</td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t border-border bg-muted/10">
                        <td />
                        <td colSpan={7} className="py-3 pr-3">
                          <ExpandedContacts organisationId={r.organisation_id} />
                        </td>
                      </tr>
                    )}
                  </FragmentRow>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</Button>
          <span className="text-xs font-mono text-muted-foreground">Page {page + 1} of {pageCount}</span>
          <Button size="sm" variant="outline" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

function ColHeader({ label, onClick, align }: { label: string; onClick: () => void; align: "left" | "right" }) {
  return (
    <th className={`px-2 py-2 ${align === "right" ? "text-right" : "text-left"}`}>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={onClick}>
        {label}
        <ArrowUpDown className="h-3 w-3 opacity-60" />
      </button>
    </th>
  );
}

function ExpandedContacts({ organisationId }: { organisationId: string }) {
  const { rows, loading } = useContactsByOrg(organisationId);
  if (loading) return <div className="text-xs font-mono text-muted-foreground py-2">Loading contacts…</div>;
  if (rows.length === 0) return <div className="text-xs font-mono text-muted-foreground py-2">No contacts on file.</div>;
  return (
    <div className="rounded border border-border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-1.5">Name</th>
            <th className="text-left px-2 py-1.5">Role</th>
            <th className="text-left px-2 py-1.5">Email</th>
            <th className="text-left px-2 py-1.5">Phone</th>
            <th className="text-left px-2 py-1.5">Engagement</th>
            <th className="text-right px-2 py-1.5">Sent</th>
            <th className="text-right px-3 py-1.5">Replies</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-t border-border">
              <td className="px-3 py-1.5 font-medium">{c.full_name ?? DASH}</td>
              <td className="px-2 py-1.5 text-muted-foreground">{c.role ?? DASH}</td>
              <td className="px-2 py-1.5">
                {c.email ? <a className="text-primary hover:underline" href={`mailto:${c.email}`}>{c.email}</a> : DASH}
              </td>
              <td className="px-2 py-1.5">
                {c.phone ? <a className="text-primary hover:underline" href={`tel:${c.phone}`}>{c.phone}</a> : DASH}
              </td>
              <td className="px-2 py-1.5"><EngagementBadge value={c.engagement} /></td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums">{fmtNum(c.emails_sent)}</td>
              <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmtNum(c.replies)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function nextSortForColumn(col: ColKey, prev: SortKey): SortKey {
  switch (col) {
    case "company": return prev === "company_asc" ? "company_desc" : "company_asc";
    case "contacts": return "contacts";
    case "replied": return "replied";
    case "emailed_no_reply": return "emailed_no_reply";
    case "never_contacted": return "emailed_no_reply"; // fallback sort key exists elsewhere
    case "last_emailed": return "last_emailed";
    case "last_replied": return "last_replied";
  }
}

function sortCompanies(a: CompanySummary, b: CompanySummary, key: SortKey): number {
  const nameA = (a.company ?? "").toLowerCase();
  const nameB = (b.company ?? "").toLowerCase();
  const cmpDate = (x: string | null, y: string | null) => {
    const tx = x ? new Date(x).getTime() : -Infinity;
    const ty = y ? new Date(y).getTime() : -Infinity;
    return ty - tx;
  };
  switch (key) {
    case "company_asc": return nameA.localeCompare(nameB);
    case "company_desc": return nameB.localeCompare(nameA);
    case "contacts": return (b.contacts ?? 0) - (a.contacts ?? 0) || nameA.localeCompare(nameB);
    case "replied": return (b.replied ?? 0) - (a.replied ?? 0) || nameA.localeCompare(nameB);
    case "emailed_no_reply": return (b.emailed_no_reply ?? 0) - (a.emailed_no_reply ?? 0) || nameA.localeCompare(nameB);
    case "last_emailed": return cmpDate(a.last_emailed, b.last_emailed) || nameA.localeCompare(nameB);
    case "last_replied": return cmpDate(a.last_replied, b.last_replied) || nameA.localeCompare(nameB);
  }
}
