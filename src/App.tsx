import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import InvestmentMemorandum from "./pages/InvestmentMemorandum";
import NotFound from "./pages/NotFound";
import { DashboardDataProvider } from "@/contexts/DashboardDataContext";
import { Loader2 } from "lucide-react";

// Lazy-load non-index pages — reduces initial bundle size.
// Wrap dynamic imports so a stale chunk hash (after redeploy) triggers a
// one-time hard reload instead of a blank-screen "Failed to fetch dynamically
// imported module" error.
const lazyWithReload = <T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) =>
  React.lazy(() =>
    factory().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (/dynamically imported module|Failed to fetch|Importing a module script failed/i.test(msg)) {
        const KEY = "tt_chunk_reload_at";
        const last = Number(sessionStorage.getItem(KEY) || 0);
        if (Date.now() - last > 10_000) {
          sessionStorage.setItem(KEY, String(Date.now()));
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
      }
      throw err;
    }),
  );

const Settings = lazyWithReload(() => import("./pages/Settings"));
const CalendarView = lazyWithReload(() => import("./pages/CalendarView"));
const GoalsTargets = lazyWithReload(() => import("./pages/GoalsTargets"));
const Formulas = lazyWithReload(() => import("./pages/Formulas"));
const EmployeeTracking = lazyWithReload(() => import("./pages/EmployeeTracking"));
const DealFlow = lazyWithReload(() => import("./pages/DealFlow"));
const FinancialHealth = lazyWithReload(() => import("./pages/FinancialHealth"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <Loader2 className="w-6 h-6 animate-spin text-primary" />
  </div>
);

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" storageKey="km-theme" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <DashboardDataProvider>
          <BrowserRouter>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/consulting" element={<InvestmentMemorandum />} />
                <Route path="/calendar" element={<CalendarView />} />
                <Route path="/employees" element={<EmployeeTracking />} />
                <Route path="/goals" element={<GoalsTargets />} />
                <Route path="/formulas" element={<Formulas />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/deals" element={<DealFlow />} />
                <Route path="/financial-health" element={<FinancialHealth />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </DashboardDataProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
