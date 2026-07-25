import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, X, Plus, Cloud, RefreshCw, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteFile,
  fileExtLabel,
  listFiles,
  uploadFile,
  uploadLargeFile,
  type OneDriveFile,
} from "@/lib/projects/onedrive";

const db = supabase as any;

const MAX_BYTES = 250 * 1024 * 1024; // 250 MB client-side cap
const SMALL_THRESHOLD = 4 * 1024 * 1024; // ≤ 4 MB → base64 path
const WARN_BYTES = 100 * 1024 * 1024; // > 100 MB → confirm before starting

interface Props {
  projectId: string;
  projectName: string;
  taskId: string;
  taskName: string;
  onCountChange?: (n: number) => void;
}

type PendingTile = {
  key: string;
  file: File;
  state: "uploading" | "error";
  error?: string;
  // Large-file only:
  chunked?: boolean;
  sent?: number;
  total?: number;
  abort?: AbortController;
};

function isDesktop() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(min-width: 768px)").matches;
}

function fmtMB(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilesSection({
  projectId,
  projectName,
  taskId,
  taskName,
  onCountChange,
}: Props) {
  const [files, setFiles] = useState<OneDriveFile[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingTile[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the latest onCountChange in a ref so callers can pass an inline
  // function without forcing `load` to change identity and re-running the
  // load effect on every parent render (which would refetch OneDrive in a
  // loop and trigger the parent's onChanged -> refresh -> re-render cycle).
  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  const namesOk =
    projectName.trim().length > 0 && taskName.trim().length > 0;

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!namesOk) {
        setFiles([]);
        setLoadError("File storage unavailable for this task");
        return;
      }
      setLoadError(null);
      try {
        const r = await listFiles({ projectName, taskName, signal });
        if (signal?.aborted) return;
        setFiles(r);
        onCountChangeRef.current?.(r.length);
      } catch (e: any) {
        if (signal?.aborted || e?.name === "AbortError") return;
        setLoadError(e?.message ?? "Failed to list files");
        setFiles([]);
      }
    },
    [projectName, taskName, namesOk],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const mirrorAttachment = useCallback(
    async (up: {
      onedrive_item_id: string;
      onedrive_web_url: string;
      file_name: string;
      size_bytes: number;
      mime_type: string;
    }) => {
      try {
        const { data: prof } = await db
          .from("profiles")
          .select("id")
          .eq("role", "office")
          .limit(1);
        const uploaded_by = (prof as Array<{ id: string }> | null)?.[0]?.id ?? null;
        await db.from("attachments").insert({
          task_id: taskId,
          onedrive_item_id: up.onedrive_item_id,
          onedrive_web_url: up.onedrive_web_url,
          file_name: up.file_name,
          size_bytes: up.size_bytes,
          mime_type: up.mime_type,
          uploaded_by,
        });
      } catch (mirrorErr) {
        console.warn("attachments mirror insert failed", mirrorErr);
      }
    },
    [taskId],
  );

  const uploadOne = useCallback(
    async (file: File) => {
      if (file.size > MAX_BYTES) {
        toast.error(
          `${file.name} is ${fmtMB(file.size)}. Limit is 250 MB.`,
        );
        return;
      }
      if (file.size > WARN_BYTES) {
        const proceed = window.confirm(
          `${file.name} is ${fmtMB(file.size)} and may take several minutes. Keep this tab open. Proceed?`,
        );
        if (!proceed) return;
      }

      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
      const useLarge = file.size > SMALL_THRESHOLD;
      const abort = useLarge ? new AbortController() : undefined;

      setPending((p) => [
        ...p,
        {
          key,
          file,
          state: "uploading",
          chunked: useLarge,
          sent: 0,
          total: file.size,
          abort,
        },
      ]);

      try {
        let up;
        if (useLarge) {
          up = await uploadLargeFile({
            projectName,
            taskName,
            projectId,
            taskId,
            file,
            signal: abort!.signal,
            onProgress: (sent, total) => {
              setPending((p) =>
                p.map((x) => (x.key === key ? { ...x, sent, total } : x)),
              );
            },
          });
        } else {
          up = await uploadFile({
            projectName,
            taskName,
            projectId,
            taskId,
            file,
          });
        }
        await mirrorAttachment(up);
        setPending((p) => p.filter((x) => x.key !== key));
        await load();
      } catch (e: any) {
        const msg = e?.message ?? "Upload failed";
        if (msg === "Upload cancelled") {
          setPending((p) => p.filter((x) => x.key !== key));
          return;
        }
        setPending((p) =>
          p.map((x) =>
            x.key === key ? { ...x, state: "error", error: msg } : x,
          ),
        );
        toast.error(`Upload failed: ${file.name}`);
      }
    },
    [projectName, taskName, projectId, taskId, load, mirrorAttachment],
  );

  const uploadMany = useCallback(
    async (list: File[]) => {
      // Sequential — n8n is single-instance and payloads are large.
      for (const f of list) {
        // eslint-disable-next-line no-await-in-loop
        await uploadOne(f);
      }
    },
    [uploadOne],
  );

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    if (list.length) uploadMany(list);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    if (!isDesktop()) return;
    e.preventDefault();
    setDragging(false);
    const list = Array.from(e.dataTransfer.files ?? []);
    if (list.length) uploadMany(list);
  };

  const onDelete = async (f: OneDriveFile) => {
    if (!window.confirm(`Delete ${f.file_name}?`)) return;
    const prev = files ?? [];
    setFiles(prev.filter((x) => x.onedrive_item_id !== f.onedrive_item_id));
    onCountChangeRef.current?.(Math.max(0, prev.length - 1));
    try {
      await deleteFile(f.onedrive_item_id);
      try {
        await db
          .from("attachments")
          .delete()
          .eq("onedrive_item_id", f.onedrive_item_id);
      } catch (mirrorErr) {
        console.warn("attachments mirror delete failed", mirrorErr);
      }
    } catch (e: any) {
      setFiles(prev);
      onCountChangeRef.current?.(prev.length);
      toast.error(`Couldn't delete ${f.file_name}: ${e?.message ?? ""}`);
    }
  };

  const retry = (t: PendingTile) => {
    setPending((p) => p.filter((x) => x.key !== t.key));
    uploadOne(t.file);
  };

  const dismissError = (t: PendingTile) => {
    setPending((p) => p.filter((x) => x.key !== t.key));
  };

  const cancelUpload = (t: PendingTile) => {
    t.abort?.abort();
    // uploadOne's catch clears the row on "Upload cancelled".
  };

  const showEmpty =
    (files?.length ?? 0) === 0 && pending.length === 0 && !loadError;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div
          className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-sm"
          style={{ background: "#3D89DA1A", color: "#3D89DA" }}
        >
          <Cloud className="h-3 w-3" /> OneDrive
        </div>
        <button
          onClick={load}
          disabled={!namesOk}
          className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground inline-flex items-center gap-1 disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      <div
        onDragOver={(e) => {
          if (!isDesktop() || !namesOk) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className="rounded-lg p-2 transition-colors"
        style={{
          border: `1px dashed ${dragging ? "#3D89DA" : "#1F2224"}`,
          background: dragging ? "#3D89DA0D" : "transparent",
        }}
      >
        {loadError && (
          <div
            className="text-[11px] font-mono italic px-1 py-2"
            style={{ color: namesOk ? "#B0B8BF" : "#E24B4A" }}
          >
            {namesOk
              ? "Couldn't reach OneDrive. Files are safe; try Refresh."
              : "File storage unavailable for this task."}
          </div>
        )}

        {files === null && !loadError ? (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="aspect-square rounded-[9px] animate-pulse"
                style={{ background: "#12151780" }}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {/* Add tile — always first */}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={!namesOk}
              className="aspect-square rounded-[9px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              style={{
                border: "1px dashed rgba(61,137,218,0.4)",
                background: "#0F1113",
              }}
              title="Upload files"
            >
              <Plus className="h-5 w-5" style={{ color: "#3D89DA" }} />
            </button>

            {(files ?? []).map((f) => (
              <FileTile
                key={f.onedrive_item_id}
                file={f}
                onDelete={() => onDelete(f)}
              />
            ))}
          </div>
        )}

        {showEmpty && (
          <div
            className="text-[11px] font-mono mt-2 px-1"
            style={{ opacity: 0.28 }}
          >
            No files yet
          </div>
        )}

        {/* Per-file progress rows */}
        {pending.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {pending.map((t) => (
              <ProgressRow
                key={t.key}
                tile={t}
                onRetry={() => retry(t)}
                onDismiss={() => dismissError(t)}
                onCancel={() => cancelUpload(t)}
              />
            ))}
          </div>
        )}
      </div>

      <div
        className="mt-2 text-[9.5px] font-mono uppercase tracking-widest flex items-center gap-1"
        style={{ color: "#4A4A52" }}
      >
        <Cloud className="h-2.5 w-2.5" />
        /TOTAL TACTILES/PROJECT MANAGEMENT/{projectName}/{taskName}/
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*,.pdf,.dwg,.dxf"
        className="hidden"
        onChange={onFilePicked}
      />
    </div>
  );
}

function FileTile({
  file,
  onDelete,
}: {
  file: OneDriveFile;
  onDelete: () => void;
}) {
  const isImage = file.is_image && !!file.thumbnail;
  const longPressTimer = useRef<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const startLongPress = () => {
    if (isDesktop()) return;
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => setMenuOpen(true), 500);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  return (
    <div
      className="relative group aspect-square rounded-[9px] overflow-hidden"
      style={{
        background: isImage
          ? `center/cover no-repeat url(${file.thumbnail})`
          : "#12151780",
        border: "1px solid #1F2224",
      }}
      title={file.file_name}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
    >
      <a
        href={file.onedrive_web_url}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 flex items-center justify-center p-1"
      >
        {!isImage && <GlyphView name={file.file_name} />}
      </a>

      {/* Cloud badge */}
      <div
        className="absolute inset-x-0 bottom-0 h-3 flex items-center justify-center pointer-events-none"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0))",
        }}
      >
        <Cloud className="h-2 w-2" style={{ color: "#3D89DA" }} />
      </div>

      {/* Hover menu (desktop) */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenuOpen((o) => !o);
        }}
        className="hidden md:flex absolute top-0.5 right-0.5 w-5 h-5 rounded-full items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: "rgba(0,0,0,0.75)", color: "#fff" }}
        title="More"
      >
        <MoreHorizontal className="h-3 w-3" />
      </button>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen(false);
            }}
          />
          <div
            className="absolute z-50 top-6 right-1 rounded-md border shadow-xl"
            style={{ background: "#0A0A0A", borderColor: "#1F2224" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => {
                e.preventDefault();
                setMenuOpen(false);
                onDelete();
              }}
              className="px-2.5 py-1 text-[10.5px] font-mono uppercase tracking-widest hover:bg-white/[0.06] flex items-center gap-1"
              style={{ color: "#E24B4A" }}
            >
              <X className="h-3 w-3" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function GlyphView({ name }: { name: string }) {
  const ext = fileExtLabel(name);
  return (
    <div className="flex flex-col items-center justify-center text-center leading-tight w-full">
      <div
        className="text-[11px] font-mono font-semibold uppercase tracking-wider"
        style={{ color: "#E6EEF3" }}
      >
        {ext}
      </div>
      <div
        className="text-[9px] font-mono mt-0.5 w-full px-1"
        style={{
          color: "#B0B8BF",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {name}
      </div>
    </div>
  );
}

function ProgressRow({
  tile,
  onRetry,
  onDismiss,
  onCancel,
}: {
  tile: PendingTile;
  onRetry: () => void;
  onDismiss: () => void;
  onCancel: () => void;
}) {
  if (tile.state === "error") {
    return (
      <div
        className="flex items-center gap-2 px-2 py-1.5 rounded-md"
        style={{ background: "#E24B4A14", border: "1px solid #E24B4A55" }}
      >
        <div className="min-w-0 flex-1">
          <div
            className="text-[11px] font-mono truncate"
            style={{ color: "#E24B4A" }}
          >
            {tile.file.name}
          </div>
          <div
            className="text-[10px] font-mono truncate"
            style={{ color: "#E24B4A" }}
          >
            {tile.error ?? "Upload failed"}
          </div>
        </div>
        <button
          onClick={onRetry}
          className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-sm"
          style={{ background: "#3D89DA", color: "#fff" }}
        >
          Retry
        </button>
        <button
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground"
          title="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  const isChunked = !!tile.chunked;
  const total = tile.total ?? tile.file.size;
  const sent = Math.min(tile.sent ?? 0, total);
  const pct = total > 0 ? Math.floor((sent / total) * 100) : 0;

  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded-md"
      style={{ background: "#12151780", border: "1px solid #1F2224" }}
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" style={{ color: "#3D89DA" }} />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-mono truncate" style={{ color: "#E6EEF3" }}>
          {tile.file.name}
        </div>
        <div className="mt-1 h-[3px] rounded-full overflow-hidden" style={{ background: "#1F2224" }}>
          {isChunked ? (
            <div
              className="h-full rounded-full transition-[width] duration-200"
              style={{ background: "#3D89DA", width: `${pct}%` }}
            />
          ) : (
            <div
              className="h-full w-1/3 rounded-full"
              style={{
                background: "#3D89DA",
                animation: "tt-indeterminate 1.2s ease-in-out infinite",
              }}
            />
          )}
        </div>
        {isChunked && (
          <div
            className="text-[10px] font-mono mt-0.5"
            style={{ color: "#E6EEF3", opacity: 0.45 }}
          >
            {fmtMB(sent)} of {fmtMB(total)} · {pct}%
          </div>
        )}
      </div>
      {isChunked ? (
        <button
          onClick={onCancel}
          className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-sm shrink-0"
          style={{ border: "1px solid #1F2224", color: "#B0B8BF" }}
          title="Cancel upload"
        >
          Cancel
        </button>
      ) : (
        <div className="text-[10px] font-mono shrink-0" style={{ color: "#B0B8BF" }}>
          {fmtMB(tile.file.size)}
        </div>
      )}
      <style>{`
        @keyframes tt-indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
