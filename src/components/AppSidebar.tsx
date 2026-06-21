import {
  LayoutDashboard,
  Activity,
  HeartPulse,
  CalendarDays,
  Users,
  Target,
  BrainCircuit,
  FunctionSquare,
  Settings } from
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
  { title: "Deal Flow", url: "/deals", icon: Activity },
  { title: "Financial Health", url: "/financial-health", icon: HeartPulse },
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Employee Centre", url: "/employees", icon: Users },
  { title: "Goals & Targets", url: "/goals", icon: Target },
  { title: "Consulting", url: "/consulting", icon: BrainCircuit },
  { title: "Formulas", url: "/formulas", icon: FunctionSquare },
  { title: "Settings", url: "/settings", icon: Settings },
];



export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className={`p-4 sidebar-dot-pattern ${collapsed ? "px-2" : ""}`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-sm bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-mono font-bold text-sm tracking-tight">TT</span>
            </div>
            {!collapsed &&
            <div>
                <p className="text-sm font-mono font-bold tracking-wider text-foreground uppercase">Total Tactiles</p>
                <p className="text-[9px] text-muted-foreground font-mono tracking-widest uppercase">Ops Dashboard</p>
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
                <span className="pulse-dot bg-primary" />
                <span className="text-xs text-muted-foreground">Live · Syncing</span>
              </div>
            </div>
          </div>
        }
      </SidebarContent>
    </Sidebar>);

}
