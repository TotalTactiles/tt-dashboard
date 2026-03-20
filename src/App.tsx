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

// Lazy-load non-index pages — reduces initial bundle size
const Settings = React.lazy(() => import("./pages/Settings"));
const CalendarView = React.lazy(() => import("./pages/CalendarView"));
const GoalsTargets = React.lazy(() => import("./pages/GoalsTargets"));
const Formulas = React.lazy(() => import("./pages/Formulas"));

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
                <Route path="/investment-memorandum" element={<InvestmentMemorandum />} />
                <Route path="/calendar" element={<CalendarView />} />
                <Route path="/goals" element={<GoalsTargets />} />
                <Route path="/formulas" element={<Formulas />} />
                <Route path="/settings" element={<Settings />} />
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
