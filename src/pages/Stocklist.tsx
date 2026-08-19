import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Filter, Flag, Layers, Ruler, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import StockShell from "@/components/stock/StockShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const DASH = "-";

interface StockProduct {
  id: string;
  product_code: string;
  description: string;
  category: string;
  unit: string;
  quantity_per_unit: number;
  cost_per_item: number;
  cost_per_unit: number | null;
  current_inventory: number | null;
  current_inventory_raw: string;
  low_stock_amount: number | null;
}

const CATEGORIES = ["TACTILE", "STAIR_NOSING", "ACCESSORY", "ENTRY_MAT"];
const UNITS = ["LM", "M2", "UNIT"];

const CATEGORY_PILL: Record<string, string> = {
  TACTILE: "bg-primary/10 text-primary border-primary/30",
  STAIR_NOSING: "bg-chart-orange/10 text-chart-orange border-chart-orange/30",
  ACCESSORY: "bg-muted text-muted-foreground border-border",
  ENTRY_MAT: "bg-accent/20 text-accent-foreground border-border",
};

const money = (n: number) =>
  n.toLocaleString("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2 });

const num = (n: number) =>
  n.toLocaleString("en-AU", { maximumFractionDigits: 2 });

function CategoryPill({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono tracking-wide",
        CATEGORY_PILL[value] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      {value}
    </span>
  );
}

function FilterChip({
  icon: Icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-auto gap-1.5 rounded-full border-border bg-transparent px-3 text-xs font-mono">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}: all</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function Stocklist() {
  const [rows, setRows] = useState<StockProduct[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [unit, setUnit] = useState("all");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("stock_products")
        .select(
          "id, product_code, description, category, unit, quantity_per_unit, cost_per_item, current_inventory, current_inventory_raw, low_stock_amount",
        )
        .order("product_code", { ascending: true });

      if (!live) return;
      if (error) {
        setLoadError(error.message);
        setRows(null);
        setLoading(false);
        toast.error("Could not load the stocklist");
        return;
      }
      setLoadError(null);
      setRows((data ?? []) as StockProduct[]);
      setLoading(false);
    })();
    return () => {
      live = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const list = rows ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (unit !== "all" && r.unit !== unit) return false;
      if (!q) return true;
      return (
        (r.product_code ?? "").toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, category, unit]);

  useEffect(() => {
    setPage(0);
  }, [search, category, unit, pageSize]);

  const total = filtered.length;
  const start = page * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const rangeFrom = total === 0 ? 0 : start + 1;
  const rangeTo = Math.min(start + pageSize, total);

  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  const toggleAllOnPage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      pageRows.forEach((r) => (allOnPage ? next.delete(r.id) : next.add(r.id)));
      return next;
    });

  return (
    <StockShell>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code or description"
              className="h-8 pl-8 text-xs font-mono"
            />
          </div>
          <FilterChip
            icon={Layers}
            label="Category"
            value={category}
            options={CATEGORIES}
            onChange={setCategory}
          />
          <FilterChip icon={Ruler} label="Unit" value={unit} options={UNITS} onChange={setUnit} />
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
          </span>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : loadError !== null ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-6 py-12 text-center">
            <AlertTriangle className="mx-auto mb-3 h-5 w-5 text-destructive" />
            <p className="text-sm font-medium text-destructive">The stocklist fetch failed</p>
            <p className="mx-auto mt-2 max-w-md text-xs font-mono text-muted-foreground break-words">
              {loadError}
            </p>
          </div>
        ) : total === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/10 px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">Nothing matches these filters</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Clear the search or widen the category and unit filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[1100px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  <th className="w-8 px-2 py-2">
                    <Checkbox
                      checked={allOnPage}
                      onCheckedChange={toggleAllOnPage}
                      aria-label="Select all rows on this page"
                    />
                  </th>
                  <th className="px-2 py-2 text-left">Product Code</th>
                  <th className="px-2 py-2 text-left">Description</th>
                  <th className="px-2 py-2 text-left">Category</th>
                  <th className="px-2 py-2 text-left">Unit</th>
                  <th className="px-2 py-2 text-right">Qty Per Unit</th>
                  <th className="px-2 py-2 text-right">Cost Per Item</th>
                  <th className="px-2 py-2 text-right">Cost Per Unit</th>
                  <th className="px-2 py-2 text-right">Current Inventory</th>
                  <th className="px-2 py-2 text-right">Total Value</th>
                  <th className="px-2 py-2 text-right">Low Stock Amount</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => {
                  const inv = r.current_inventory;
                  const isLow = r.low_stock_amount !== null && inv !== null && inv <= r.low_stock_amount;
                  const isNegative = inv !== null && inv < 0;
                  return (
                    <tr
                      key={r.id}
                      className="h-9 border-b border-border/60 last:border-b-0 hover:bg-muted/20"
                    >
                      <td className="px-2">
                        <Checkbox
                          checked={selected.has(r.id)}
                          onCheckedChange={() => toggleRow(r.id)}
                          aria-label={`Select ${r.product_code}`}
                        />
                      </td>
                      <td className="whitespace-nowrap px-2 font-mono text-foreground">
                        {r.product_code}
                      </td>
                      <td className="max-w-[260px] truncate px-2 text-foreground" title={r.description}>
                        {r.description}
                      </td>
                      <td className="whitespace-nowrap px-2">
                        <CategoryPill value={r.category} />
                      </td>
                      <td className="whitespace-nowrap px-2 font-mono text-muted-foreground">
                        {r.unit}
                      </td>
                      <td className="whitespace-nowrap px-2 text-right font-mono tabular-nums">
                        {num(r.quantity_per_unit)}
                      </td>
                      <td className="whitespace-nowrap px-2 text-right font-mono tabular-nums">
                        {money(r.cost_per_item)}
                      </td>
                      <td className="whitespace-nowrap px-2 text-right font-mono tabular-nums">
                        {money(r.quantity_per_unit * r.cost_per_item)}
                      </td>
                      <td className="whitespace-nowrap px-2 text-right font-mono tabular-nums">
                        <span className="inline-flex items-center gap-1.5">
                          {inv === null ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                  <span className="text-foreground">{r.current_inventory_raw}</span>
                                  <AlertTriangle className="h-3 w-3 text-chart-orange" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                This reading is not a clean number, so it is shown as recorded.
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className={isNegative ? "text-destructive" : ""}>{num(inv)}</span>
                          )}
                          {isNegative && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center rounded-full border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-mono text-destructive">
                                  check
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>This value is under review.</TooltipContent>
                            </Tooltip>
                          )}
                          {isLow && !isNegative && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-chart-orange/40 bg-chart-orange/10 px-1.5 py-0.5 text-[10px] font-mono text-chart-orange">
                              <Flag className="h-2.5 w-2.5" />
                              low
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2 text-right font-mono tabular-nums">
                        {inv === null ? (
                          <span className="text-muted-foreground">{DASH}</span>
                        ) : (
                          money(inv * r.cost_per_item)
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 text-right font-mono tabular-nums">
                        {r.low_stock_amount === null ? (
                          <span className="text-muted-foreground">not set</span>
                        ) : (
                          num(r.low_stock_amount)
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && loadError === null && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="h-8 w-[130px] text-xs font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s} per page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground tabular-nums">
                {rangeFrom} {DASH} {rangeTo} of {total} results
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Previous page"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Next page"
                disabled={rangeTo >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </StockShell>
  );
}
