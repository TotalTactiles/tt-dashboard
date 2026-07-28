import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePeopleSearch, type PeopleFilters } from "@/hooks/useContacts";
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

const PAGE_SIZE = 50;

export default function PersonSearch() {
  const [rawQ, setRawQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [engagement, setEngagement] = useState<PeopleFilters["engagement"]>("all");
  const [source, setSource] = useState<PeopleFilters["source"]>("all");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(rawQ), 300);
    return () => clearTimeout(t);
  }, [rawQ]);

  useEffect(() => { setPage(0); }, [debouncedQ, engagement, source]);

  const hasQuery = debouncedQ.trim().length >= 2;
  const hasFilter = engagement !== "all" || source !== "all";
  const enabled = hasQuery || hasFilter;

  const filters: PeopleFilters = useMemo(
    () => ({ q: debouncedQ, engagement, source, page, pageSize: PAGE_SIZE }),
    [debouncedQ, engagement, source, page]
  );

  const { rows, total, loading } = usePeopleSearch(filters, enabled);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by name, email, builder or role"
          value={rawQ}
          onChange={(e) => setRawQ(e.target.value)}
          className="max-w-md font-mono text-sm"
        />
        <Select value={engagement} onValueChange={(v) => setEngagement(v as PeopleFilters["engagement"])}>
          <SelectTrigger className="w-[180px] font-mono text-xs"><SelectValue placeholder="Engagement" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All engagement</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
            <SelectItem value="emailed">Emailed, no reply</SelectItem>
            <SelectItem value="known">Never contacted</SelectItem>
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={(v) => setSource(v as PeopleFilters["source"])}>
          <SelectTrigger className="w-[160px] font-mono text-xs"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="apollo">From Apollo</SelectItem>
            <SelectItem value="leads">From leads</SelectItem>
          </SelectContent>
        </Select>
        {enabled && (
          <span className="text-xs font-mono text-muted-foreground ml-auto">
            {total.toLocaleString()} match{total === 1 ? "" : "es"}
          </span>
        )}
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-2 py-2">Role</th>
                <th className="text-left px-2 py-2">Builder</th>
                <th className="text-left px-2 py-2">Email</th>
                <th className="text-left px-2 py-2">Phone</th>
                <th className="text-left px-2 py-2">Engagement</th>
                <th className="text-right px-2 py-2">Sent</th>
                <th className="text-right px-2 py-2">Replies</th>
                <th className="text-right px-3 py-2">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {!enabled && (
                <tr><td colSpan={9} className="text-center py-10 text-sm text-muted-foreground">
                  Search by name, email, builder or role<br />Or filter by engagement to browse.
                </td></tr>
              )}
              {enabled && loading && (
                <tr><td colSpan={9} className="text-center py-8 text-sm text-muted-foreground">Searching…</td></tr>
              )}
              {enabled && !loading && rows.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-sm text-muted-foreground">No contacts match.</td></tr>
              )}
              {enabled && !loading && rows.map((c) => {
                const lastActRaw = pickLater(c.last_replied, c.last_emailed);
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">{c.full_name ?? DASH}</td>
                    <td className="px-2 py-2 text-muted-foreground">{c.role ?? DASH}</td>
                    <td className="px-2 py-2">{c.company ?? DASH}</td>
                    <td className="px-2 py-2">
                      {c.email ? <a className="text-primary hover:underline" href={`mailto:${c.email}`}>{c.email}</a> : DASH}
                    </td>
                    <td className="px-2 py-2">
                      {c.phone ? <a className="text-primary hover:underline" href={`tel:${c.phone}`}>{c.phone}</a> : DASH}
                    </td>
                    <td className="px-2 py-2"><EngagementBadge value={c.engagement} /></td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums">{fmtNum(c.emails_sent)}</td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums">{fmtNum(c.replies)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{fmtDate(lastActRaw)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {enabled && pageCount > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</Button>
          <span className="text-xs font-mono text-muted-foreground">Page {page + 1} of {pageCount}</span>
          <Button size="sm" variant="outline" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

function pickLater(a: string | null, b: string | null): string | null {
  const ta = a ? new Date(a).getTime() : -Infinity;
  const tb = b ? new Date(b).getTime() : -Infinity;
  if (ta === -Infinity && tb === -Infinity) return null;
  return ta >= tb ? a : b;
}
