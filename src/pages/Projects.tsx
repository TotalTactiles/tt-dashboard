import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { RoleProvider, useRole } from "@/hooks/useRole";
import { ProjectRail } from "@/components/projects/ProjectRail";
import { ProjectHeader } from "@/components/projects/ProjectHeader";
import { CalendarStrip } from "@/components/projects/CalendarStrip";
import { TaskListSection, TaskListColumnHeader } from "@/components/projects/TaskList";
import { TaskDrawer } from "@/components/projects/TaskDrawer";
import { ColumnsPopover } from "@/components/projects/ColumnsPopover";
import { CompleteProjectModal } from "@/components/projects/CompleteProjectModal";
import { SplitProjectModal } from "@/components/projects/SplitProjectModal";
import { VariationModal } from "@/components/projects/VariationModal";
import { BoardView, CalendarMonthView } from "@/components/projects/AltViews";
import { loadColumns, saveColumns, type ColumnKey } from "@/components/projects/columns";
import { useTasks } from "@/hooks/useTasks";
import {
  useProjectDetail,
  useIsPmMobile,
  useCanManageProjectLifecycle,
} from "@/hooks/useProjects";
import { useProfiles } from "@/hooks/useProfiles";
import { Ring } from "@/components/projects/Ring";
import { cn } from "@/lib/utils";
import { CheckCircle2, List, LayoutGrid, Calendar as CalendarIcon, Filter, ArrowUpDown, Group, Search } from "lucide-react";

type ViewMode = "list" | "board" | "calendar";

function formatCompletionUpper(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (isNaN(d.getTime())) return null;
  return d
    .toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
}

function ProjectsInner() {
  const { role, setRole } = useRole();
  const isMobile = useIsPmMobile();
  const canManageLifecycle = useCanManageProjectLifecycle();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"rail" | "detail">("rail");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [railRefreshTick, setRailRefreshTick] = useState(0);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [variationOpen, setVariationOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const [columns, setColumns] = useState<ColumnKey[]>(() => loadColumns());

  useEffect(() => {
    saveColumns(columns);
  }, [columns]);

  const { project, financials, refresh: refreshProject } = useProjectDetail(projectId);
  const { lists, tasks, refresh, toggleTaskStatus, updateTask } = useTasks(projectId);
  const assigneeOn = columns.includes("assignee");
  const profiles = useProfiles(assigneeOn);

  // On mobile, force a compact column set regardless of user preference.
  const effectiveColumns = useMemo<ColumnKey[]>(
    () => (isMobile ? (["name", "status"] as ColumnKey[]) : columns),
    [isMobile, columns],
  );

  const bump = useCallback(() => setRefreshTick((t) => t + 1), []);
  const bumpRail = useCallback(() => setRailRefreshTick((t) => t + 1), []);
  const handleChanged = useCallback(() => {
    bump();
    refresh();
  }, [bump, refresh]);
  const handleRailOpen = useCallback(() => {
    if (isMobile) setMobileView("detail");
  }, [isMobile]);
  const handleTaskOpen = useCallback((id: string) => setOpenTaskId(id), []);
  const handleDrawerClose = useCallback(() => setOpenTaskId(null), []);
  const handleToggle = useCallback(
    (t: typeof tasks[number]) => toggleTaskStatus(t.id, t.status),
    [toggleTaskStatus],
  );
  const openCompleteModal = useCallback(() => setCompleteOpen(true), []);
  const closeCompleteModal = useCallback(() => setCompleteOpen(false), []);
  const openSplitModal = useCallback(() => setSplitOpen(true), []);
  const closeSplitModal = useCallback(() => setSplitOpen(false), []);
  const openVariationModal = useCallback(() => setVariationOpen(true), []);
  const closeVariationModal = useCallback(() => setVariationOpen(false), []);
  const handleCompleted = useCallback(() => {
    // Refresh project detail + rail so the completed banner and rail chip show.
    refreshProject();
    bumpRail();
  }, [refreshProject, bumpRail]);

  const { pct, total, done, open } = useMemo(() => {
    const countable = tasks.filter((t) => !t.office_only);
    const d = countable.filter((t) => t.status === "done").length;
    const p = countable.length ? Math.round((100 * d) / countable.length) : 0;
    return { pct: p, total: countable.length, done: d, open: countable.length - d };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return tasks;
    const q = search.toLowerCase();
    return tasks.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.product_code ?? "").toLowerCase().includes(q),
    );
  }, [tasks, search]);

  const showRail = !isMobile || mobileView === "rail";
  const showDetail = !isMobile || mobileView === "detail";

  const hasProjectEnd = !!project?.project_end;
  const dateSourceIso = project?.project_end ?? project?.estimated_start ?? null;
  const dateSourceLabel = hasProjectEnd ? "COMPLETION" : "EST. START";
  const dateSourceValue = formatCompletionUpper(dateSourceIso);

  return (
    <div
      className={cn(
        "flex min-h-0 max-w-[100vw] overflow-x-clip",
        isMobile ? "min-h-[calc(100vh-48px)]" : "h-[calc(100vh-48px)]",
      )}
      style={{ background: "#000" }}
    >
      {showRail && (
        <ProjectRail
          activeProjectId={projectId}
          onSelect={setProjectId}
          onOpen={handleRailOpen}
          fullWidth={isMobile}
          refreshTick={railRefreshTick}
        />
      )}

      {showDetail && (
      <div className="flex-1 flex flex-col min-w-0">
        {isMobile ? (
          <div
            className="sticky top-0 z-40 flex items-center gap-2 px-3 py-2 border-b backdrop-blur-md"
            style={{ borderColor: "#1F2224", background: "rgba(8,8,8,0.94)" }}
          >
            <button
              onClick={() => setMobileView("rail")}
              className="p-2 -m-2 text-[11px] font-mono opacity-45 hover:opacity-80 shrink-0"
              aria-label="Back to projects"
            >
              ‹
            </button>
            {projectId && project ? (
              <>
                <div className="shrink-0">
                  <Ring pct={pct} size={34} stroke={3} showLabel labelSize={10} />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[14px] font-semibold tracking-[-0.2px] truncate text-foreground"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    {project.name}
                  </div>
                  <div
                    className="text-[10px] font-mono tracking-[0.4px] truncate"
                    style={{ color: "rgba(229,233,234,0.45)" }}
                  >
                    {pct}% ·{" "}
                    {dateSourceValue
                      ? `${dateSourceLabel} ${dateSourceValue}`
                      : "NO DATES SET"}
                  </div>
                </div>
              </>
            ) : (
              <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                Select a project
              </span>
            )}
            <div
              className="flex items-center rounded-md border overflow-hidden shrink-0"
              style={{ borderColor: "#1F2224" }}
            >
              <RoleTab active={role === "office"} onClick={() => setRole("office")}>Office</RoleTab>
              <RoleTab active={role === "worker"} onClick={() => setRole("worker")}>Worker</RoleTab>
            </div>
          </div>
        ) : (
          <div
            className="flex items-center justify-between px-3 md:px-6 py-2 border-b gap-2"
            style={{ borderColor: "#1F2224", background: "#0F1113" }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-[11px] md:text-[13px] font-mono uppercase tracking-widest text-muted-foreground truncate">
                Project Management
              </h1>
            </div>
            <div className="flex items-center rounded-md border overflow-hidden shrink-0" style={{ borderColor: "#1F2224" }}>
              <RoleTab active={role === "office"} onClick={() => setRole("office")}>Office</RoleTab>
              <RoleTab active={role === "worker"} onClick={() => setRole("worker")}>Worker</RoleTab>
            </div>
          </div>
        )}

        <div
          className={cn(
            "flex-1 overflow-y-auto overflow-x-clip min-h-0 max-w-[100vw]",
            isMobile && "pb-[calc(88px+env(safe-area-inset-bottom))]",
          )}
        >
          {project?.completed_at && (
            <div
              className="flex items-start gap-2.5 px-3 md:px-6 py-2.5 border-b"
              style={{
                borderColor: "rgba(34,197,94,0.25)",
                background: "rgba(34,197,94,0.06)",
                color: "#22C55E",
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div className="text-[11.5px] font-mono leading-snug">
                <span className="uppercase tracking-widest">Completed</span>
                {" · "}
                This project is complete. Its financial row is frozen.
              </div>
            </div>
          )}

          <ProjectHeader
            projectId={projectId}
            onChanged={handleChanged}
            progressPct={pct}
            totalTasks={total}
            doneTasks={done}
            openTasks={open}
          />

          {projectId && (
            <>
              <CalendarStrip
                onPatch={updateTask}
                key={`strip-${projectId}-${refreshTick}`}
                tasks={filteredTasks}
                projectStart={project?.project_start ?? null}
                projectEnd={project?.project_end ?? null}
                estStart={project?.estimated_start ?? null}
                onTaskClick={handleTaskOpen}
              />

              <ViewsBar
                search={search}
                onSearch={setSearch}
                columns={columns}
                onColumnsChange={setColumns}
                isMobile={isMobile}
                view={view}
                onViewChange={setView}
              />
            </>
          )}

          <div className={cn("py-4 space-y-3", isMobile ? "px-3" : "px-3 md:px-6")}>
            {projectId && lists.length === 0 && (
              <div
                className="rounded-md border p-6 text-sm text-muted-foreground text-center"
                style={{ borderColor: "#1F2224" }}
              >
                No task lists yet.
              </div>
            )}

            {projectId && lists.length > 0 && view === "list" && (
              <>
                {!isMobile && (
                  <div
                    className="rounded-md border overflow-hidden"
                    style={{ borderColor: "#1F2224", background: "#0A0A0A" }}
                  >
                    <TaskListColumnHeader columns={effectiveColumns} />
                  </div>
                )}
                {lists.map((l) => (
                  <TaskListSection
                    key={l.id}
                    list={l}
                    tasks={filteredTasks}
                    columns={effectiveColumns}
                    profiles={profiles}
                    project={project}
                    onOpen={handleTaskOpen}
                    onToggle={handleToggle}
                    onPatch={updateTask}
                  />
                ))}
              </>
            )}

            {projectId && lists.length > 0 && view === "board" && (
              <BoardView
                lists={lists}
                tasks={filteredTasks}
                profiles={profiles}
                onOpen={handleTaskOpen}
              />
            )}

            {projectId && lists.length > 0 && view === "calendar" && (
              <CalendarMonthView tasks={filteredTasks} onOpen={handleTaskOpen} />
            )}

            {/* Table view removed. */}

            {projectId && project && canManageLifecycle && (
              <LifecycleActionBar
                projectName={project.name}
                completedAt={project.completed_at}
                openTasks={open}
                totalTasks={total}
                isMobile={isMobile}
                onSplit={openSplitModal}
                onComplete={openCompleteModal}
                onVariation={openVariationModal}
              />
            )}
          </div>
        </div>
      </div>
      )}

      {completeOpen && projectId && project && canManageLifecycle && (
        <CompleteProjectModal
          project={{ id: project.id, name: project.name, zoho_deal_id: project.zoho_deal_id }}
          originalContractValue={financials?.contract_value ?? null}
          onClose={closeCompleteModal}
          onCompleted={handleCompleted}
        />
      )}

      {splitOpen && projectId && project && canManageLifecycle && (
        <SplitProjectModal
          project={{ id: project.id, name: project.name, zoho_deal_id: project.zoho_deal_id }}
          contractValue={financials?.contract_value ?? null}
          onClose={closeSplitModal}
        />
      )}

      {variationOpen && projectId && project && canManageLifecycle && (
        <VariationModal
          project={{ id: project.id, name: project.name, zoho_deal_id: project.zoho_deal_id }}
          onClose={closeVariationModal}
        />
      )}



      {openTaskId && (
        <TaskDrawer
          taskId={openTaskId}
          onClose={handleDrawerClose}
          onChanged={handleChanged}
        />
      )}
    </div>
  );
}

function LifecycleActionBar({
  projectName,
  completedAt,
  openTasks,
  totalTasks,
  isMobile,
  onSplit,
  onComplete,
  onVariation,
}: {
  projectName: string;
  completedAt: string | null;
  openTasks: number;
  totalTasks: number;
  isMobile: boolean;
  onSplit: () => void;
  onComplete: () => void;
  onVariation: () => void;
}) {
  // A project whose name ends with - S{n} or - V{n} is a stage or variation:
  // Complete may be pressed with trailing tasks open, otherwise its revenue
  // row would never freeze. Matches the regex used by the n8n workflows.
  const isStageOrVariation = /[\u2013\u2014-]\s*[SV]\d+\s*$/i.test(projectName);
  const isCompleted = !!completedAt;
  const allDone = totalTasks > 0 && openTasks === 0;
  const canComplete = isStageOrVariation ? true : allDone;

  const completeNote = isCompleted
    ? null
    : isStageOrVariation
      ? "Stage may be completed with tasks outstanding."
      : allDone
        ? "All tasks complete."
        : `${openTasks} of ${totalTasks} tasks remaining — complete all tasks to close this project`;

  const completedLabel = (() => {
    if (!completedAt) return null;
    const d = new Date(completedAt + (completedAt.length === 10 ? "T00:00:00" : ""));
    return isNaN(d.getTime())
      ? completedAt
      : d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
  })();

  return (
    <div
      className={cn(
        "mt-2 rounded-md border",
        isMobile ? "px-3 py-2.5" : "px-4 py-3",
      )}
      style={{ borderColor: "#1F2224", background: "#0A0A0A" }}
    >
      <div className="flex items-center justify-end gap-2 flex-wrap">
        {isCompleted && (
          <div
            className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1 mr-auto"
            style={{
              borderColor: "rgba(34,197,94,0.3)",
              background: "rgba(34,197,94,0.08)",
              color: "#22C55E",
            }}
          >
            <CheckCircle2 className="h-3 w-3" />
            <span className="text-[10.5px] font-mono uppercase tracking-widest">
              Completed {completedLabel}
            </span>
          </div>
        )}
        <button
          onClick={onVariation}
          className="h-8 px-3 rounded-md text-[11px] font-mono uppercase tracking-widest transition-colors"
          style={{
            border: "1px solid #3D89DA",
            color: "#3D89DA",
            background: "transparent",
          }}
        >
          Variation
        </button>
        <button
          onClick={onSplit}
          className="h-8 px-3 rounded-md text-[11px] font-mono uppercase tracking-widest transition-colors"
          style={{
            border: "1px solid #3D89DA",
            color: "#3D89DA",
            background: "transparent",
          }}
        >
          Split Project
        </button>
        {!isCompleted && (
          <button
            onClick={onComplete}
            disabled={!canComplete}
            className="h-8 px-3 rounded-md text-[11px] font-mono uppercase tracking-widest text-white disabled:cursor-not-allowed"
            style={{
              background: canComplete ? "#3D89DA" : "#1D1D22",
              opacity: canComplete ? 1 : 0.55,
            }}
          >
            Complete Project
          </button>
        )}
      </div>
      {completeNote && (
        <div
          className="mt-1 text-right text-[10px] font-mono"
          style={{
            opacity: canComplete ? 0.7 : 0.45,
            color: canComplete && !isStageOrVariation ? "#22C55E" : undefined,
          }}
        >
          {completeNote}
        </div>
      )}
    </div>
  );
}


function ViewsBar({
  search,
  onSearch,
  columns,
  onColumnsChange,
  isMobile,
  view,
  onViewChange,
}: {
  search: string;
  onSearch: (s: string) => void;
  columns: ColumnKey[];
  onColumnsChange: (c: ColumnKey[]) => void;
  isMobile: boolean;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 border-b",
        isMobile ? "px-3 py-2 overflow-x-auto [&::-webkit-scrollbar]:hidden" : "px-6 py-2",
      )}
      style={{
        borderColor: "#1F2224",
        background: "#0B0C0E",
        scrollbarWidth: isMobile ? "none" : undefined,
      }}
    >
      <ViewTab icon={<List className="h-3.5 w-3.5" />} label="List" active={view === "list"} onClick={() => onViewChange("list")} />
      <ViewTab icon={<LayoutGrid className="h-3.5 w-3.5" />} label="Board" active={view === "board"} onClick={() => onViewChange("board")} />
      <ViewTab icon={<CalendarIcon className="h-3.5 w-3.5" />} label="Calendar" active={view === "calendar"} onClick={() => onViewChange("calendar")} />
      <ViewTab icon={<TableIcon className="h-3.5 w-3.5" />} label="Table" active={view === "table"} onClick={() => onViewChange("table")} />

      <div className="h-4 w-px mx-2 shrink-0" style={{ background: "#1F2224" }} />

      <ToolButton icon={<Filter className="h-3 w-3" />} label="Filter" />
      <ToolButton icon={<ArrowUpDown className="h-3 w-3" />} label="Sort" />
      <ToolButton icon={<Group className="h-3 w-3" />} label="Group by" />
      {!isMobile && <ColumnsPopover columns={columns} onChange={onColumnsChange} />}

      {!isMobile && (
        <div className="ml-auto relative">
          <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search tasks…"
            className="h-7 pl-7 pr-2 rounded-md bg-black/40 border text-[11.5px] outline-none focus:border-primary/50 w-[220px]"
            style={{ borderColor: "#1F2224" }}
          />
        </div>
      )}
    </div>
  );
}

function ViewTab({
  icon,
  label,
  active,
  soon,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  soon?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={soon}
      className={cn(
        "h-7 px-2.5 rounded-md inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest transition-colors shrink-0",
        active ? "text-foreground" : "text-muted-foreground/70 hover:text-foreground",
        soon && "cursor-not-allowed",
      )}
      style={{ background: active ? "#16161A" : "transparent", opacity: soon ? 0.35 : undefined }}
    >
      {icon}
      {label}
      {soon && (
        <span className="text-[8.5px] font-mono normal-case tracking-normal opacity-60 ml-0.5">
          soon
        </span>
      )}
    </button>
  );
}

function ToolButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      disabled
      className="h-7 px-2 rounded-md inline-flex items-center gap-1.5 text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground/50 cursor-not-allowed shrink-0"
    >
      {icon}
      {label}
    </button>
  );
}

function RoleTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 h-7 text-[10.5px] font-mono uppercase tracking-widest transition-colors",
        active ? "text-white" : "text-muted-foreground hover:text-foreground",
      )}
      style={{ background: active ? "#3D89DA" : "transparent" }}
    >
      {children}
    </button>
  );
}

export default function Projects() {
  return (
    <DashboardLayout>
      <RoleProvider>
        <div className="-m-4 sm:-m-6 md:-m-8">
          <ProjectsInner />
        </div>
      </RoleProvider>
    </DashboardLayout>
  );
}
