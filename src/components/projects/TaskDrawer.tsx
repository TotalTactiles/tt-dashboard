import { useEffect, useState } from "react";
import { X, Circle, CheckCircle2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Task } from "@/hooks/useTasks";
import { DATE_RULE_LABELS, formatDateShort } from "@/lib/projects/dateRules";
import { useRole } from "@/hooks/useRole";
import { ProjectCalcTable, TABLE_LABEL, TABLE_OFFICE_ONLY } from "@/components/projects/tables";
import { FilesSection } from "@/components/projects/FilesSection";

const db = supabase as any;

interface Comment {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  profiles?: { full_name: string; initials: string | null; colour: string | null } | null;
}

interface Props {
  taskId: string | null;
  onClose: () => void;
  onChanged: () => void;
}

export function TaskDrawer({ taskId, onClose, onChanged }: Props) {
  const { role } = useRole();
  const [task, setTask] = useState<Task | null>(null);
  const [projectName, setProjectName] = useState<string>("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      setComments([]);
      setProjectName("");
      return;
    }
    setLoading(true);
    (async () => {
      const [{ data: t }, { data: c }] = await Promise.all([
        db.from("tasks").select("*").eq("id", taskId).maybeSingle(),
        db
          .from("comments")
          .select("id, body, created_at, user_id, profiles:user_id (full_name, initials, colour)")
          .eq("task_id", taskId)
          .order("created_at", { ascending: true }),
      ]);
      setTask(t as Task | null);
      setComments((c as Comment[]) ?? []);
      if (t?.project_id) {
        const { data: p } = await db.from("projects").select("name").eq("id", t.project_id).maybeSingle();
        setProjectName((p as { name?: string } | null)?.name ?? "");
      }
      setLoading(false);
    })();
  }, [taskId, role]);


  const toggleStatus = async () => {
    if (!task) return;
    const next = task.status === "open" ? "done" : "open";
    await db
      .from("tasks")
      .update({
        status: next,
        completed_at: next === "done" ? new Date().toISOString() : null,
      })
      .eq("id", task.id);
    setTask({ ...task, status: next });
    onChanged();
  };

  const addComment = async () => {
    if (!task || !newComment.trim()) return;
    // Use first office profile as author placeholder — real auth wiring lands with Part 5.
    const { data: profiles } = await db.from("profiles").select("id").eq("role", "office").limit(1);
    const authorId = (profiles as Array<{ id: string }> | null)?.[0]?.id;
    if (!authorId) return;
    const { data } = await db
      .from("comments")
      .insert({ task_id: task.id, user_id: authorId, body: newComment.trim() })
      .select("id, body, created_at, user_id, profiles:user_id (full_name, initials, colour)")
      .maybeSingle();
    if (data) setComments((prev) => [...prev, data as Comment]);
    setNewComment("");
  };

  if (!taskId) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        className="w-full max-w-[620px] h-full flex flex-col shadow-2xl border-l"
        style={{ borderColor: "#1F2224", background: "#0A0A0A" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "#1F2224", background: "#0F1113" }}
        >
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Task Detail
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-white/[0.06] text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading || !task ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: "#1F2224" }}>
              <div className="flex items-start gap-3">
                <button
                  onClick={toggleStatus}
                  className="mt-1 shrink-0 text-muted-foreground hover:text-foreground"
                >
                  {task.status === "done" ? (
                    <CheckCircle2 className="h-5 w-5" style={{ color: "#22C55E" }} />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <h2
                    className="text-[16px] font-semibold tracking-tight"
                    style={{
                      color: task.status === "done" ? "#6B7280" : "#E6EEF3",
                      textDecoration: task.status === "done" ? "line-through" : "none",
                    }}
                  >
                    {task.name}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {task.product_code && (
                      <span
                        className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-sm"
                        style={{ background: "rgba(255,255,255,0.05)", color: "#B0B8BF" }}
                      >
                        {task.product_code}
                      </span>
                    )}
                    {task.calc_table && (
                      <span
                        className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-sm"
                        style={{ background: "#3D89DA22", color: "#3D89DA" }}
                      >
                        {task.calc_table.replace(/_/g, " ")}
                      </span>
                    )}
                    {task.office_only && (
                      <span
                        className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-sm inline-flex items-center gap-1"
                        style={{ background: "#7C5BC722", color: "#B9A5E5" }}
                      >
                        <Lock className="h-2.5 w-2.5" />
                        office only
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* DETAILS */}
            <Section title="Details">
              <div className="space-y-3">
                <Field label="Description">
                  {task.description ? (
                    <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap">
                      {task.description}
                    </p>
                  ) : (
                    <span className="text-[12px] text-muted-foreground italic">No description.</span>
                  )}
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start">
                    <span className="font-mono text-[12.5px]">{formatDateShort(task.start_date)}</span>
                  </Field>
                  <Field label="End">
                    <span className="font-mono text-[12.5px]">{formatDateShort(task.end_date)}</span>
                  </Field>
                  <Field label="Rule">
                    <span className="font-mono text-[11.5px]">
                      {DATE_RULE_LABELS[task.rule]}
                      {task.date_manual && (
                        <span className="ml-1" style={{ color: "#F59E0B" }}>
                          · manual
                        </span>
                      )}
                    </span>
                  </Field>
                  <Field label="Status">
                    <span
                      className="font-mono text-[11.5px] uppercase tracking-widest"
                      style={{ color: task.status === "done" ? "#22C55E" : "#3D89DA" }}
                    >
                      {task.status}
                    </span>
                  </Field>
                </div>
              </div>
            </Section>

            {/* TABLE SECTION — only when calc_table set and role permits */}
            {(() => {
              const kind = task.calc_table;
              if (!kind) return null;
              const officeOnly = TABLE_OFFICE_ONLY.has(kind);
              if (officeOnly && role !== "office") return null;
              return (
                <Section title={TABLE_LABEL[kind] ?? "Table"}>
                  <ProjectCalcTable
                    kind={kind}
                    projectId={task.project_id}
                    taskId={task.id}
                  />
                </Section>
              );
            })()}

            {/* COMMENTS */}
            <Section title={`Comments · ${comments.length}`}>
              <div className="space-y-3 mb-3">
                {comments.length === 0 && (
                  <div className="text-[12px] text-muted-foreground italic">No comments yet.</div>
                )}
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0"
                      style={{
                        background: c.profiles?.colour ?? "#3D89DA",
                        color: "#fff",
                      }}
                    >
                      {c.profiles?.initials ?? "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-mono text-muted-foreground">
                        {c.profiles?.full_name ?? "Unknown"} ·{" "}
                        {new Date(c.created_at).toLocaleString("en-AU", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="text-[12.5px] mt-0.5 whitespace-pre-wrap">{c.body}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addComment()}
                  placeholder={role === "office" ? "Add a comment…" : "Reply as worker…"}
                  className="flex-1 h-8 px-2 rounded-md bg-black/40 border text-[12.5px] outline-none focus:border-primary/50"
                  style={{ borderColor: "#1F2224" }}
                />
                <button
                  onClick={addComment}
                  disabled={!newComment.trim()}
                  className="h-8 px-3 text-[11px] font-mono rounded-md text-white disabled:opacity-50"
                  style={{ background: "#3D89DA" }}
                >
                  Send
                </button>
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="px-5 py-[22px] border-t first:border-t-0"
      style={{ borderColor: "#1C1C21" }}
    >
      <div
        className="uppercase mb-[9px]"
        style={{
          fontSize: "9.5px",
          fontWeight: 600,
          letterSpacing: "0.09em",
          color: "#5C5C65",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9.5px] font-mono tracking-widest uppercase text-muted-foreground mb-1">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

