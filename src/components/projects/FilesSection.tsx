import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, X, Plus, Cloud, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteFile,
  fileGlyph,
  listFiles,
  uploadFile,
  type OneDriveFile,
} from "@/lib/projects/onedrive";

const db = supabase as any;

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
};

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

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await listFiles({ projectName, taskName });
      setFiles(r);
      onCountChange?.(r.length);
    } catch (e: any) {
      setLoadError(e?.message ?? "Failed to list files");
      setFiles([]);
    }
  }, [projectName, taskName, onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  const uploadOne = useCallback(
    async (file: File) => {
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
      setPending((p) => [...p, { key, file, state: "uploading" }]);
      try {
        const up = await uploadFile({
          projectName,
          taskName,
          projectId,
          taskId,
          file,
        });
        // Best-effort attachments row insert — non-blocking on failure.
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
        } catch {
          /* ignore — the file is safe in OneDrive */
        }
        setPending((p) => p.filter((x) => x.key !== key));
        await load();
      } catch (e: any) {
        setPending((p) =>
          p.map((x) =>
            x.key === key
              ? { ...x, state: "error", error: e?.message ?? "Upload failed" }
              : x,
          ),
        );
        toast.error(`Upload failed: ${file.name}`);
      }
    },
    [projectName, taskName, projectId, taskId, load],
  );

  const uploadMany = useCallback(
    async (list: File[]) => {
      for (const f of list) {
        // sequential, each appears as it completes
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
    e.preventDefault();
    setDragging(false);
    const list = Array.from(e.dataTransfer.files ?? []);
    if (list.length) uploadMany(list);
  };

  const onDelete = async (f: OneDriveFile) => {
    const prev = files ?? [];
    setFiles(prev.filter((x) => x.onedrive_item_id !== f.onedrive_item_id));
    onCountChange?.(Math.max(0, prev.length - 1));
    try {
      await deleteFile(f.onedrive_item_id);
      try {
        await db
          .from("attachments")
          .delete()
          .eq("onedrive_item_id", f.onedrive_item_id);
      } catch {
        /* ignore */
      }
    } catch (e: any) {
      setFiles(prev);
      onCountChange?.(prev.length);
      toast.error(`Couldn't delete ${f.file_name}`);
    }
  };

  const retry = (t: PendingTile) => {
    setPending((p) => p.filter((x) => x.key !== t.key));
    uploadOne(t.file);
  };

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
          className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          title="Refresh"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      <div
        onDragOver={(e) => {
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
          <div className="text-[12px] text-muted-foreground italic px-1 py-2">
            Couldn't reach OneDrive. Files are safe; try reopening.
          </div>
        )}

        {files === null && !loadError ? (
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-[66px] h-[66px] rounded-[7px] animate-pulse"
                style={{ background: "#12151780" }}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(files ?? []).map((f) => (
              <FileTile key={f.onedrive_item_id} file={f} onDelete={() => onDelete(f)} />
            ))}
            {pending.map((t) => (
              <PendingTileView key={t.key} tile={t} onRetry={() => retry(t)} />
            ))}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-[66px] h-[66px] rounded-[7px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
              style={{ border: "1px dashed #2A2E32", background: "#0F1113" }}
              title="Upload files"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        )}

        {(files?.length ?? 0) === 0 && pending.length === 0 && !loadError && (
          <div className="text-[11px] text-muted-foreground italic mt-2 px-1">
            Drag files here or click + to upload to OneDrive
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
        className="hidden"
        onChange={onFilePicked}
      />
    </div>
  );
}

function FileTile({ file, onDelete }: { file: OneDriveFile; onDelete: () => void }) {
  const isImage = file.is_image && file.thumbnail;
  return (
    <div
      className="relative group w-[66px] h-[66px] rounded-[7px] overflow-hidden"
      style={{
        background: isImage ? `center/cover no-repeat url(${file.thumbnail})` : "#12151780",
        border: "1px solid #1F2224",
      }}
      title={file.file_name}
    >
      <a
        href={file.web_url}
        target="_blank"
        rel="noreferrer"
        className="absolute inset-0 flex items-center justify-center"
      >
        {!isImage && <GlyphView mime={file.mime_type} name={file.file_name} />}
      </a>
      <div
        className="absolute inset-x-0 bottom-0 h-3 flex items-center justify-center pointer-events-none"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0))",
        }}
      >
        <Cloud className="h-2 w-2" style={{ color: "#3D89DA" }} />
      </div>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: "rgba(0,0,0,0.75)", color: "#fff" }}
        title="Delete"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

function GlyphView({ mime, name }: { mime: string; name: string }) {
  const g = fileGlyph(mime, name);
  return (
    <div className="flex flex-col items-center justify-center text-center leading-tight">
      <div
        className="text-[9px] font-mono uppercase tracking-widest"
        style={{ color: "#B0B8BF" }}
      >
        {g.hint}
      </div>
      <div
        className="text-[10px] font-mono"
        style={{ color: "#E6EEF3" }}
      >
        {g.label}
      </div>
    </div>
  );
}

function PendingTileView({
  tile,
  onRetry,
}: {
  tile: PendingTile;
  onRetry: () => void;
}) {
  if (tile.state === "error") {
    return (
      <button
        onClick={onRetry}
        className="w-[66px] h-[66px] rounded-[7px] flex flex-col items-center justify-center text-center px-1"
        style={{
          background: "#EF444422",
          border: "1px solid #EF4444",
          color: "#EF4444",
        }}
        title={`Retry ${tile.file.name}`}
      >
        <span className="text-[9px] font-mono uppercase tracking-widest">Retry</span>
        <span className="text-[8.5px] font-mono truncate w-[58px]">
          {tile.file.name}
        </span>
      </button>
    );
  }
  return (
    <div
      className="w-[66px] h-[66px] rounded-[7px] flex items-center justify-center"
      style={{ background: "#12151780", border: "1px solid #1F2224" }}
      title={`Uploading ${tile.file.name}`}
    >
      <Loader2 className="h-4 w-4 animate-spin" style={{ color: "#3D89DA" }} />
    </div>
  );
}
