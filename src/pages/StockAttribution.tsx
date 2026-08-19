import StockShell, { StockNotBuilt } from "@/components/stock/StockShell";

export default function StockAttribution() {
  return (
    <StockShell>
      <StockNotBuilt section="Project Attribution" />
    </StockShell>
  );
}
