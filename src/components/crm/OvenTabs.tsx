import { Button } from "@/components/ui/button";

export type OvenTab = "new" | "cold" | "test";

export default function OvenTabs({
  value, onChange, newCount, coldCount, testCount,
}: {
  value: OvenTab;
  onChange: (t: OvenTab) => void;
  newCount: number;
  coldCount: number;
  testCount: number;
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-muted/30 p-1">
      <Button
        variant={value === "new" ? "default" : "ghost"}
        size="sm"
        className="font-mono"
        onClick={() => onChange("new")}
      >
        New Leads
        <span className="ml-2 text-[10px] opacity-70 tabular-nums">{newCount}</span>
      </Button>
      <Button
        variant={value === "cold" ? "default" : "ghost"}
        size="sm"
        className="font-mono"
        onClick={() => onChange("cold")}
      >
        Cold Call
        <span className="ml-2 text-[10px] opacity-70 tabular-nums">{coldCount}</span>
      </Button>
      <Button
        variant={value === "test" ? "default" : "ghost"}
        size="sm"
        className="font-mono"
        onClick={() => onChange("test")}
      >
        Test
        <span className="ml-2 text-[10px] opacity-70 tabular-nums">{testCount}</span>
      </Button>
    </div>
  );
}
