import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Team members who work the CRM. Add names here as the team grows —
// temporary stand-in until real user accounts exist.
export const CRM_OPERATORS = ["Krishan", "Mehmet"] as const;

export const CRM_OPERATOR_KEY = "tt_crm_operator";

export function getStoredOperator(): string | null {
  try {
    const v = localStorage.getItem(CRM_OPERATOR_KEY);
    if (!v || !(CRM_OPERATORS as readonly string[]).includes(v)) {
      if (v) localStorage.removeItem(CRM_OPERATOR_KEY);
      return null;
    }
    return v;
  } catch { return null; }
}
export function setStoredOperator(name: string | null) {
  try {
    if (name && (CRM_OPERATORS as readonly string[]).includes(name)) {
      localStorage.setItem(CRM_OPERATOR_KEY, name);
    } else {
      localStorage.removeItem(CRM_OPERATOR_KEY);
    }
  } catch {}
}

export default function WorkingAsGate({ onChoose }: { onChoose: (name: string) => void }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-8">
        <h2 className="text-lg font-mono uppercase tracking-wider text-center mb-1">Who's working?</h2>
        <p className="text-xs text-muted-foreground text-center mb-6">
          Sales inbox is shared. Pick your name so activity is attributed correctly.
        </p>
        <div className="grid gap-3">
          {CRM_OPERATORS.map((name) => (
            <Button
              key={name}
              variant="outline"
              className="h-12 text-base"
              onClick={() => { setStoredOperator(name); onChoose(name); }}
            >
              {name}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}
