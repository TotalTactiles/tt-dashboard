import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { RoleProvider, useRole } from "@/hooks/useRole";
import { ProjectRail } from "@/components/projects/ProjectRail";
import { ProjectHeader } from "@/components/projects/ProjectHeader";
import { CalendarStrip } from "@/components/projects/CalendarStrip";
import { TaskListSection } from "@/components/projects/TaskList";
import { TaskDrawer } from "@/components/projects/TaskDrawer";
import { useTasks } from "@/hooks/useTasks";
import { useProjectDetail } from "@/hooks/useProjects";
import { cn } from "@/lib/utils";

function ProjectsInner() {
  const { role, setRole } = useRole();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const { project } = useProjectDetail(projectId);
  const { lists, tasks, refresh, toggleTaskStatus } = useTasks(projectId);

  const bump = () => setRefreshTick((t) => t + 1);

  return (
    <div className="flex h-[calc(100vh-48px)] min-h-0" style={{ background: "#000" }}>
      <ProjectRail activeProjectId={projectId} onSelect={setProjectId} />

      <div className="flex-1 flex flex-col min-w-0">
        <div
          className="flex items-center justify-between px-6 py-2 border-b"
          style={{ borderColor: "#1F2224", background: "#0F1113" }}
        >
          <h1
            className="text-[13px] font-mono uppercase tracking-widest text-muted-foreground"
          >
            Project Management
          </h1>
          <div
            className="flex items-center rounded-md border overflow-hidden"
            style={{ borderColor: "#1F2224" }}
          >
            <RoleTab active={role === "office"} onClick={() => setRole("office")}>
              Office
            </RoleTab>
            <RoleTab active={role === "worker"} onClick={() => setRole("worker")}>
              Worker
            </RoleTab>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          <ProjectHeader projectId={projectId} onChanged={() => { bump(); refresh(); }} />

          {projectId && (
            <CalendarStrip
              key={`strip-${projectId}-${refreshTick}`}
              tasks={tasks}
              projectStart={project?.project_start ?? null}
              projectEnd={project?.project_end ?? null}
              estStart={project?.estimated_start ?? null}
              onTaskClick={setOpenTaskId}
            />
          )}

          <div className="px-6 py-5 space-y-3">
            {projectId && lists.length === 0 && (
              <div
                className="rounded-md border p-6 text-sm text-muted-foreground text-center"
                style={{ borderColor: "#1F2224" }}
              >
                No task lists yet — the project template will seed these when Part 5 lands.
              </div>
            )}
            {lists.map((l) => (
              <TaskListSection
                key={l.id}
                list={l}
                tasks={tasks}
                onOpen={setOpenTaskId}
                onToggle={(t) => toggleTaskStatus(t.id, t.status)}
              />
            ))}
          </div>
        </div>
      </div>

      {openTaskId && (
        <TaskDrawer
          taskId={openTaskId}
          onClose={() => setOpenTaskId(null)}
          onChanged={() => {
            refresh();
            bump();
          }}
        />
      )}
    </div>
  );
}

function RoleTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
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
