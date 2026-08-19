import React from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const SUB_ROUTES = [
  { label: "Dashboard", to: "/stock/dashboard" },
  { label: "Stocklist", to: "/stock/stocklist" },
  { label: "Project Attribution", to: "/stock/attribution" },
];

const LATER_BUILD = "Editing arrives in a later build.";

/**
 * Shared shell for the Stock and Inventory routes.
 * Read only in this build: the primary action and the overflow menu are disabled.
 */
export default function StockShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout>
      <div className="p-4 md:p-6">
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 md:px-5">
            <div className="min-w-0">
              <h1 className="text-base md:text-lg font-semibold text-foreground truncate">
                Stock and Inventory
              </h1>
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Read only
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled
                      aria-label="More stock actions"
                      className="h-8 w-8"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{LATER_BUILD}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button size="sm" disabled className="h-8 rounded-full px-4 font-mono text-xs">
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      New product
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{LATER_BUILD}</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="px-4 pt-3 md:px-5">
            <nav className="inline-flex rounded-md border border-border bg-muted/30 p-1">
              {SUB_ROUTES.map((r) => (
                <NavLink
                  key={r.to}
                  to={r.to}
                  className="rounded-sm px-3 py-1.5 text-xs font-mono text-muted-foreground transition-colors hover:text-foreground"
                  activeClassName="bg-background text-foreground shadow-sm"
                >
                  {r.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="p-4 md:p-5">{children}</div>
        </div>
      </div>
    </DashboardLayout>
  );
}

/** Honest empty state for the sections that are not built yet. */
export function StockNotBuilt({ section }: { section: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/10 px-6 py-14 text-center">
      <p className="text-sm font-medium text-foreground">{section} is not built yet</p>
      <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
        Nothing is shown here on purpose. There are no figures for this section yet, so none are
        invented. Stocklist is the only section carrying data in this build.
      </p>
    </div>
  );
}
