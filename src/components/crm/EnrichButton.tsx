import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { enrichLead } from "@/hooks/useCrmLeads";

interface Props {
  leadId: string;
  operator: string;
  label?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "secondary" | "outline" | "ghost";
  className?: string;
  onDone?: (matched: boolean) => void;
}

/**
 * Standalone Apollo enrichment. Always uses mode: "enrich" — fills in
 * contact details only. Never sends an email; never creates a Zoho lead.
 * The heavier `full` mode is only used by the New Leads view's Find Details.
 */
export default function EnrichButton({
  leadId, operator, label = "Find contact details",
  size = "sm", variant = "outline", className, onDone,
}: Props) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await enrichLead(leadId, operator, "enrich");
      if (r.ok && r.matched) {
        const name = r.contact?.name?.trim() || "contact";
        const email = r.contact?.email?.trim();
        toast({
          title: email ? `Found ${name} — ${email}` : `Found ${name}`,
          description: "Contact details updated.",
        });
        onDone?.(true);
      } else if (r.ok && r.matched === false) {
        toast({
          title: "No match",
          description: r.detail || "Apollo could not find a matching contact.",
          className: "border-chart-orange/40 bg-chart-orange/10 text-chart-orange",
        });
        onDone?.(false);
      } else {
        toast({
          title: "Enrichment failed",
          description: r.detail || "Apollo did not respond — the lead is unchanged",
          className: "border-chart-orange/40 bg-chart-orange/10 text-chart-orange",
        });
        onDone?.(false);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size={size} variant={variant} onClick={run} disabled={busy} className={className}>
      {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
      {busy ? "Searching Apollo…" : label}
    </Button>
  );
}
