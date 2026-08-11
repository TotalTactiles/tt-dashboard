import {
  LayoutDashboard,
  Activity,
  HeartPulse,
  CalendarDays,
  Users,
  Target,
  BrainCircuit,
  FunctionSquare,
  Hammer,
  Contact,
  Settings,
  Inbox,
  Briefcase,
  Code2 } from
"lucide-react";
import { OvenIcon } from "@/components/icons/OvenIcon";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar } from
"@/components/ui/sidebar";

const overviewItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Deal Flow", url: "/deals", icon: Activity },
  { title: "Financial Health", url: "/financial-health", icon: HeartPulse },
  { title: "Goals & Targets", url: "/goals", icon: Target },
  { title: "Consulting", url: "/consulting", icon: BrainCircuit },
];

const operationsAfterLeads = [
  { title: "Projects", url: "/projects", icon: Hammer },
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Employee Centre - connect", url: "/employees", icon: Users },
];

const systemsItems = [
  { title: "Formulas", url: "/formulas", icon: FunctionSquare },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const renderItem = (item: { title: string; url: string; icon: React.ElementType }) => (
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
  );

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
                <p className="text-[9px] text-muted-foreground font-mono tracking-widest uppercase">LEGACY VIEW</p>
              </div>
            }
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>BUSINESS OVERVIEW</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {overviewItems.map(renderItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>BUSINESS OPERATIONS</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderItem({ title: "Contacts", url: "/contacts", icon: Contact })}

              {collapsed ?
              renderItem({ title: "The Oven - to complete", url: "/crm", icon: OvenIcon }) :
              <>
                  <SidebarMenuItem>
                    <SidebarMenuButton className="hover:bg-sidebar-accent/50">
                      <Inbox className="mr-2 h-4 w-4" />
                      <span>Leads</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild>
                        <NavLink
                        to="/crm"
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">

                          <OvenIcon className="mr-2 h-4 w-4" />
                          <span>The Oven - to complete</span>
                        </NavLink>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                      {...({ disabled: true } as Record<string, unknown>)}
                      aria-disabled="true"
                      onClick={(e) => e.preventDefault()}
                      className="opacity-50 cursor-not-allowed pointer-events-none">


                        <Briefcase className="mr-2 h-4 w-4" />
                        <span>Deals - to be built</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </>
              }

              {operationsAfterLeads.map(renderItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>SYSTEMS</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemsItems.map(renderItem)}

              <SidebarMenuItem>
                <SidebarMenuButton disabled aria-disabled="true" className="opacity-50 cursor-not-allowed">
                  <Code2 className="mr-2 h-4 w-4" />
                  {!collapsed && <span>Developers - to be built</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>

              {renderItem({ title: "Settings", url: "/settings", icon: Settings })}
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
