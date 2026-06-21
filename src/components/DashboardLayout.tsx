import { useState } from "react";
import { Menu } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsTablet } from "@/hooks/use-tablet";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isDesktop = !isMobile && !isTablet;
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <SidebarProvider defaultOpen={isDesktop}>
      <div className="min-h-screen flex w-full">
        {isDesktop && <AppSidebar />}

        <div className="flex-1 flex flex-col min-w-0 landscape-main-offset">
          <header className="h-12 flex items-center border-b border-border px-3 sm:px-4 shrink-0 gap-2">
            {isDesktop ? (
              <SidebarTrigger className="mr-2" />
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDrawerOpen(true)}
                className="h-9 w-9 shrink-0"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}

            {!isDesktop && (
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-sm bg-primary flex items-center justify-center shrink-0">
                  <span className="text-primary-foreground font-mono font-bold text-[10px] tracking-tight">TT</span>
                </div>
                <span className="text-sm font-mono font-bold tracking-wider text-foreground truncate uppercase">
                  Total Tactiles
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto shrink-0">
              <ThemeToggle />
              <span className="pulse-dot bg-primary" />
              <span className="text-xs text-primary font-mono hidden sm:inline">Live</span>
            </div>
          </header>

          <main
            className="flex-1 overflow-auto dashboard-main-padding pb-20 md:pb-6"
            style={{ overflowX: "hidden", minWidth: 0 }}
          >
            <div className="dashboard-max-width mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Drawer with sidebar nav for mobile/tablet */}
      {!isDesktop && (
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="left" className="p-0 w-[280px]">
            <div onClick={() => setDrawerOpen(false)} className="h-full">
              <AppSidebar />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Mobile bottom tab bar (also handles landscape rail internally) */}
      {!isDesktop && <MobileNav />}
    </SidebarProvider>
  );
};

export default DashboardLayout;
