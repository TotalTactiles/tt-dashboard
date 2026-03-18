import {
  LayoutDashboard,
  Settings,
  TrendingUp,
  Activity,
  CalendarDays,
  Target,
  FunctionSquare } from
"lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar } from
"@/components/ui/sidebar";

const navItems = [
{ title: "Dashboard", url: "/", icon: LayoutDashboard },
{ title: "Calendar", url: "/calendar", icon: CalendarDays },
{ title: "Goals & Targets", url: "/goals", icon: Target },
{ title: "Formulas", url: "/formulas", icon: FunctionSquare },
{ title: "Portfolio", url: "/portfolio", icon: TrendingUp },
{ title: "Deal Flow", url: "/deals", icon: Activity },
{ title: "Settings", url: "/settings", icon: Settings }];


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className={`p-4 ${collapsed ? "px-2" : ""}`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-mono font-bold text-sm">K&M</span>
            </div>
            {!collapsed &&
            <div>
                <p className="text-sm font-semibold text-foreground">K&M Enterprises </p>
                <p className="text-[10px] text-muted-foreground font-mono">Business Operations</p>
              </div>
            }
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) =>
              <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                    to={item.url}
                    end={item.url === "/"}
                    className="hover:bg-sidebar-accent/50"
                    activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                    
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!collapsed &&
        <div className="mt-auto p-4">
            <div className="stat-card !p-3">
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Live Feed</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="pulse-dot bg-chart-green" />
                <span className="text-xs text-muted-foreground">3 sources connected</span>
              </div>
            </div>
          </div>
        }
      </SidebarContent>
    </Sidebar>);

}