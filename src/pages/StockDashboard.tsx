import StockShell, { StockNotBuilt } from "@/components/stock/StockShell";

export default function StockDashboard() {
  return (
    <StockShell>
      <StockNotBuilt section="Stock Dashboard" />
    </StockShell>
  );
}
