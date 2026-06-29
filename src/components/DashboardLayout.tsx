import { useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsTablet } from "@/hooks/use-tablet";
import { useAuth } from "@/contexts/AuthContext";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isDesktop = !isMobile && !isTablet;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <SidebarProvider defaultOpen={isDesktop}>
      <div className="min-h-screen flex w-full">
        {isDesktop && <AppSidebar />}

        <div className="flex-1 flex flex-col min-w-0 landscape-main-offset">
          <header className="h-12 hidden md:flex items-center border-b border-border px-3 sm:px-4 shrink-0 gap-2">
            <SidebarTrigger className="mr-2" />
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <ThemeToggle />
              <span className="pulse-dot bg-primary" />
              <span className="text-xs text-primary font-mono hidden sm:inline">Live</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="h-8 px-2 text-xs font-mono text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-3.5 h-3.5 mr-1" />
                Log out
              </Button>
            </div>
          </header>

          <header className="h-12 flex items-center border-b border-border px-4 shrink-0 md:hidden">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-sm bg-primary flex items-center justify-center shrink-0">
                <span className="text-primary-foreground font-mono font-black text-[10px] tracking-widest">TT</span>
              </div>
              <span className="text-sm font-mono font-bold tracking-wider text-foreground uppercase">Total Tactiles</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <ThemeToggle />
              <span className="pulse-dot bg-primary" />
              <span className="text-xs text-muted-foreground font-mono">Live</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
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
