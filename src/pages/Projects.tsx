import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { RoleProvider, useRole } from "@/hooks/useRole";
import { ProjectRail } from "@/components/projects/ProjectRail";
import { ProjectHeader } from "@/components/projects/ProjectHeader";
import { CalendarStrip } from "@/components/projects/CalendarStrip";
import { TaskListSection, TaskListColumnHeader } from "@/components/projects/TaskList";
import { TaskDrawer } from "@/components/projects/TaskDrawer";
import { ColumnsPopover } from "@/components/projects/ColumnsPopover";
import { loadColumns, saveColumns, type ColumnKey } from "@/components/projects/columns";
import { useTasks } from "@/hooks/useTasks";
import { useProjectDetail } from "@/hooks/useProjects";
import { useProfiles } from "@/hooks/useProfiles";
import { cn } from "@/lib/utils";
import { List, LayoutGrid, Calendar as CalendarIcon, Table as TableIcon, Filter, ArrowUpDown, Group, Search } from "lucide-react";

function ProjectsInner() {
  const { role, setRole } = useRole();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [search, setSearch] = useState("");
  const [columns, setColumns] = useState<ColumnKey[]>(() => loadColumns());

  useEffect(() => {
    saveColumns(columns);
  }, [columns]);

  const { project } = useProjectDetail(projectId);
  const { lists, tasks, refresh, toggleTaskStatus, updateTask } = useTasks(projectId);
  // Only join profiles when the Assignee column is active.
  const assigneeOn = columns.includes("assignee");
  const profiles = useProfiles(assigneeOn);

  const bump = () => setRefreshTick((t) => t + 1);

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

  return (
    <div className="flex h-[calc(100vh-48px)] min-h-0" style={{ background: "#000" }}>
      <ProjectRail activeProjectId={projectId} onSelect={setProjectId} />

      <div className="flex-1 flex flex-col min-w-0">
        <div
          className="flex items-center justify-between px-6 py-2 border-b"
          style={{ borderColor: "#1F2224", background: "#0F1113" }}
        >
          <h1 className="text-[13px] font-mono uppercase tracking-widest text-muted-foreground">
            Project Management
          </h1>
          <div className="flex items-center rounded-md border overflow-hidden" style={{ borderColor: "#1F2224" }}>
            <RoleTab active={role === "office"} onClick={() => setRole("office")}>Office</RoleTab>
            <RoleTab active={role === "worker"} onClick={() => setRole("worker")}>Worker</RoleTab>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          <ProjectHeader
            projectId={projectId}
            onChanged={() => { bump(); refresh(); }}
            progressPct={pct}
            totalTasks={total}
            doneTasks={done}
            openTasks={open}
          />

          {projectId && (
            <>
              <CalendarStrip
                key={`strip-${projectId}-${refreshTick}`}
                tasks={filteredTasks}
                projectStart={project?.project_start ?? null}
                projectEnd={project?.project_end ?? null}
                estStart={project?.estimated_start ?? null}
                onTaskClick={setOpenTaskId}
              />

              <ViewsBar
                search={search}
                onSearch={setSearch}
                columns={columns}
                onColumnsChange={setColumns}
              />
            </>
          )}

          <div className="px-6 py-4 space-y-3">
            {projectId && lists.length === 0 && (
              <div
                className="rounded-md border p-6 text-sm text-muted-foreground text-center"
                style={{ borderColor: "#1F2224" }}
              >
                No task lists yet.
              </div>
            )}
            {lists.length > 0 && (
              <div
                className="rounded-md border overflow-hidden"
                style={{ borderColor: "#1F2224", background: "#0A0A0A" }}
              >
                <TaskListColumnHeader columns={columns} />
              </div>
            )}
            {lists.map((l) => (
              <TaskListSection
                key={l.id}
                list={l}
                tasks={filteredTasks}
                columns={columns}
                profiles={profiles}
                project={project}
                onOpen={setOpenTaskId}
                onToggle={(t) => toggleTaskStatus(t.id, t.status)}
                onPatch={updateTask}
              />
            ))}
          </div>
        </div>
      </div>

      {openTaskId && (
        <TaskDrawer
          taskId={openTaskId}
          onClose={() => setOpenTaskId(null)}
          onChanged={() => { refresh(); bump(); }}
        />
      )}
    </div>
  );
}

function ViewsBar({
  search,
  onSearch,
  columns,
  onColumnsChange,
}: {
  search: string;
  onSearch: (s: string) => void;
  columns: ColumnKey[];
  onColumnsChange: (c: ColumnKey[]) => void;
}) {
  return (
    <div
      className="flex items-center gap-1 px-6 py-2 border-b"
      style={{ borderColor: "#1F2224", background: "#0B0C0E" }}
    >
      <ViewTab icon={<List className="h-3.5 w-3.5" />} label="List" active />
      <ViewTab icon={<LayoutGrid className="h-3.5 w-3.5" />} label="Board" soon />
      <ViewTab icon={<CalendarIcon className="h-3.5 w-3.5" />} label="Calendar" soon />
      <ViewTab icon={<TableIcon className="h-3.5 w-3.5" />} label="Table" soon />

      <div className="h-4 w-px mx-2" style={{ background: "#1F2224" }} />

      <ToolButton icon={<Filter className="h-3 w-3" />} label="Filter" />
      <ToolButton icon={<ArrowUpDown className="h-3 w-3" />} label="Sort" />
      <ToolButton icon={<Group className="h-3 w-3" />} label="Group by" />
      <ColumnsPopover columns={columns} onChange={onColumnsChange} />

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
    </div>
  );
}

function ViewTab({
  icon,
  label,
  active,
  soon,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  soon?: boolean;
}) {
  return (
    <button
      disabled={!active}
      className={cn(
        "h-7 px-2.5 rounded-md inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest transition-colors",
        active ? "text-foreground" : "text-muted-foreground/60 cursor-not-allowed",
      )}
      style={{ background: active ? "#16161A" : "transparent" }}
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
      className="h-7 px-2 rounded-md inline-flex items-center gap-1.5 text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground/50 cursor-not-allowed"
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
