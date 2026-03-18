import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { useIsMobile } from "@/hooks/use-mobile";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="min-h-screen flex w-full">
        {/* Sidebar hidden on mobile via CSS */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border px-4 shrink-0 hidden md:flex">
            <SidebarTrigger className="mr-4" />
            <div className="flex items-center gap-2 ml-auto">
              <span className="pulse-dot bg-chart-green" />
              <span className="text-xs text-muted-foreground font-mono">Live</span>
            </div>
          </header>
          {/* Mobile header */}
          <header className="h-12 flex items-center border-b border-border px-4 shrink-0 md:hidden">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-mono font-bold text-[10px]">PE</span>
              </div>
              <span className="text-sm font-semibold text-foreground">Meridian Capital</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className="pulse-dot bg-chart-green" />
              <span className="text-xs text-muted-foreground font-mono">Live</span>
            </div>
          </header>
          <main className="flex-1 overflow-auto dashboard-main-padding pb-20 md:pb-6">
            <div className="dashboard-max-width mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
      {/* Mobile bottom tab bar */}
      <MobileNav />
    </SidebarProvider>);

};

export default DashboardLayout;