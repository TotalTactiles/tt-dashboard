// OneDrive integration via n8n webhooks.
// The dashboard NEVER talks to OneDrive directly — only these endpoints.
//
// Contract quirks handled at this boundary:
//   1. Failures do NOT return { ok: false } — they return { FATAL: "..." } with
//      no `ok` key. Treat only `ok === true` as success; surface FATAL as error.
//   2. The list endpoint returns `web_url`; upload returns `onedrive_web_url`.
//      Normalise both to `onedrive_web_url` here so components never care.
//   3. Small files (≤ 4 MB) go via /onedrive-upload as base64. Large files use
//      /onedrive-create-session to get a pre-authenticated Graph upload URL and
//      PUT raw Blob slices directly to Microsoft — bypassing the n8n VPS.

const BASE = "https://n8n.srv1437130.hstgr.cloud/webhook";

export interface OneDriveFile {
  onedrive_item_id: string;
  file_name: string;
  onedrive_web_url: string;
  size_bytes: number;
  is_image: boolean;
  mime_type: string;
  thumbnail: string | null;
  modified: string;
}

export interface UploadedFile {
  onedrive_item_id: string;
  onedrive_web_url: string;
  file_name: string;
  size_bytes: number;
  mime_type: string;
  chunked?: boolean;
}

interface UploadSession {
  ok: true;
  upload_url: string;
  expires: string;
  chunk_size: number;
  file_name: string;
  mime_type: string;
  path: string;
  project_id: string;
  task_id: string;
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      // Strip `data:<mime>;base64,` prefix — webhook needs the raw payload only.
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

// Module-level in-flight registry. If two callers fire the same webhook with
// the same signature before the first resolves, they share the promise instead
// of hitting the network twice. Bounds damage from any future render loop.
const inflight = new Map<string, Promise<any>>();

async function callWebhook(
  path: string,
  body: unknown,
  opts?: { dedupeKey?: string; signal?: AbortSignal },
): Promise<any> {
  const key = opts?.dedupeKey;
  if (key) {
    const existing = inflight.get(key);
    if (existing) return existing;
  }

  const run = (async () => {
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: opts?.signal,
      });
    } catch (e: any) {
      if (e?.name === "AbortError") throw e;
      throw new Error(e?.message ?? "Network error");
    }
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      /* fall through */
    }
    if (!res.ok) {
      const msg = data?.FATAL || data?.error || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    if (data?.FATAL) throw new Error(String(data.FATAL));
    if (data?.ok !== true) throw new Error("Server did not confirm success");
    return data;
  })();

  if (key) {
    inflight.set(key, run);
    run.finally(() => {
      if (inflight.get(key) === run) inflight.delete(key);
    });
  }
  return run;
}

/**
 * Generic n8n webhook POST with the same in-flight dedup + AbortSignal handling
 * as callWebhook, but WITHOUT the { ok: true } assertion. Some endpoints
 * (complete-project, split-project) return richer envelopes where { ok:false }
 * is a meaningful non-fatal state we need to surface to the caller. Throws only
 * on network failures, non-2xx HTTP, and { FATAL: ... } payloads.
 */
export async function postN8nWebhook<T = any>(
  path: string,
  body: unknown,
  opts?: { dedupeKey?: string; signal?: AbortSignal },
): Promise<{ status: number; data: T }> {
  const key = opts?.dedupeKey;
  if (key) {
    const existing = inflight.get(key);
    if (existing) return existing;
  }

  const run = (async () => {
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: opts?.signal,
      });
    } catch (e: any) {
      if (e?.name === "AbortError") throw e;
      throw new Error(e?.message ?? "Network error");
    }
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      /* fall through */
    }
    if (res.status === 400) {
      // Validation error — return so caller can render errors[] inline.
      return { status: 400, data };
    }
    if (!res.ok) {
      const msg = data?.FATAL || data?.error || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    if (data?.FATAL) throw new Error(String(data.FATAL));
    return { status: res.status, data };
  })();

  if (key) {
    inflight.set(key, run as any);
    (run as Promise<any>).finally(() => {
      if (inflight.get(key) === (run as any)) inflight.delete(key);
    });
  }
  return run;
}

export async function uploadFile(args: {
  projectName: string;
  taskName: string;
  projectId: string;
  taskId: string;
  file: File;
}): Promise<UploadedFile> {
  const file_base64 = await readAsBase64(args.file);
  const data = await callWebhook("/onedrive-upload", {
    project_name: args.projectName,
    task_name: args.taskName,
    file_name: args.file.name,
    file_base64,
    mime_type: args.file.type || "application/octet-stream",
    project_id: args.projectId,
    task_id: args.taskId,
  });
  return {
    onedrive_item_id: data.onedrive_item_id,
    onedrive_web_url: data.onedrive_web_url,
    file_name: data.file_name,
    size_bytes: data.size_bytes,
    mime_type: data.mime_type,
    chunked: !!data.chunked,
  };
}

async function createUploadSession(args: {
  projectName: string;
  taskName: string;
  projectId: string;
  taskId: string;
  file: File;
}): Promise<UploadSession> {
  const data = await callWebhook("/onedrive-create-session", {
    project_name: args.projectName,
    task_name: args.taskName,
    file_name: args.file.name,
    mime_type: args.file.type || "application/octet-stream",
    project_id: args.projectId,
    task_id: args.taskId,
  });
  return data as UploadSession;
}

// Large-file path: PUT raw Blob slices to a pre-authenticated Microsoft URL.
// Never send Authorization (URL is pre-signed) and never set Content-Type
// (that breaks Graph range uploads). Never base64 the slice — the whole point
// of this path is streaming the raw bytes without VPS memory pressure.
export async function uploadLargeFile(args: {
  projectName: string;
  taskName: string;
  projectId: string;
  taskId: string;
  file: File;
  onProgress?: (bytesSent: number, totalBytes: number) => void;
  signal?: AbortSignal;
}): Promise<UploadedFile> {
  const session = await createUploadSession({
    projectName: args.projectName,
    taskName: args.taskName,
    projectId: args.projectId,
    taskId: args.taskId,
    file: args.file,
  });

  const total = args.file.size;
  // Graph requires chunks to be multiples of 320 KiB; the session dictates this.
  const CHUNK = session.chunk_size;
  let offset = 0;
  let finalItem: any = null;

  while (offset < total) {
    if (args.signal?.aborted) throw new Error("Upload cancelled");

    const end = Math.min(offset + CHUNK, total) - 1;
    const slice = args.file.slice(offset, end + 1);

    let attempt = 0;
    let putRes: Response | null = null;
    let lastErr: any = null;

    while (attempt < 3) {
      try {
        putRes = await fetch(session.upload_url, {
          method: "PUT",
          headers: {
            "Content-Range": `bytes ${offset}-${end}/${total}`,
          },
          body: slice,
          signal: args.signal,
        });
        if (putRes.status === 404) {
          throw new Error("Upload session expired — please retry");
        }
        // Retry on 5xx / 429
        if (putRes.status >= 500 || putRes.status === 429) {
          throw new Error(`Chunk failed (${putRes.status})`);
        }
        break;
      } catch (e: any) {
        if (args.signal?.aborted) throw new Error("Upload cancelled");
        if (String(e?.message ?? "").includes("session expired")) throw e;
        lastErr = e;
        attempt += 1;
        if (attempt >= 3) throw new Error(lastErr?.message ?? "Chunk upload failed");
        await new Promise((r) => setTimeout(r, [1000, 2000, 4000][attempt - 1]));
      }
    }

    if (!putRes) throw new Error(lastErr?.message ?? "Chunk upload failed");

    if (putRes.status === 200 || putRes.status === 201) {
      // Final chunk — response is the DriveItem
      finalItem = await putRes.json().catch(() => null);
      offset = total;
      args.onProgress?.(total, total);
      break;
    }

    // 202 Accepted — parse nextExpectedRanges to compute next offset (allows
    // a partially-failed chunk to resume at the right byte).
    let nextOffset = end + 1;
    try {
      const body = await putRes.json();
      const ranges: string[] = body?.nextExpectedRanges ?? [];
      if (ranges.length > 0) {
        const first = ranges[0].split("-")[0];
        const parsed = parseInt(first, 10);
        if (!Number.isNaN(parsed)) nextOffset = parsed;
      }
    } catch {
      /* fall through to sequential */
    }
    offset = nextOffset;
    args.onProgress?.(offset, total);
  }

  if (!finalItem || !finalItem.id) {
    throw new Error("Upload completed but server did not return a file");
  }

  return {
    onedrive_item_id: finalItem.id,
    onedrive_web_url: finalItem.webUrl,
    file_name: finalItem.name ?? args.file.name,
    size_bytes: finalItem.size ?? total,
    mime_type: args.file.type || "application/octet-stream",
    chunked: true,
  };
}

export async function listFiles(args: {
  projectName: string;
  taskName: string;
  signal?: AbortSignal;
}): Promise<OneDriveFile[]> {
  const data = await callWebhook(
    "/onedrive-list",
    {
      project_name: args.projectName,
      task_name: args.taskName,
    },
    {
      dedupeKey: `list::${args.projectName}::${args.taskName}`,
      signal: args.signal,
    },
  );
  const raw = (data.files ?? []) as Array<Record<string, any>>;
  // Normalise `web_url` → `onedrive_web_url` at the client boundary.
  return raw.map((f) => ({
    onedrive_item_id: f.onedrive_item_id,
    file_name: f.file_name,
    onedrive_web_url: f.onedrive_web_url ?? f.web_url ?? "",
    size_bytes: f.size_bytes ?? 0,
    is_image: !!f.is_image,
    mime_type: f.mime_type ?? "application/octet-stream",
    thumbnail: f.thumbnail ?? null,
    modified: f.modified ?? "",
  }));
}

export async function deleteFile(onedriveItemId: string): Promise<void> {
  const data = await callWebhook(
    "/onedrive-delete",
    { onedrive_item_id: onedriveItemId },
    { dedupeKey: `delete::${onedriveItemId}` },
  );
  if (!data.deleted) throw new Error("Delete rejected by server");
}

export function fileExtLabel(name: string): string {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  return ext ? ext.toUpperCase() : "FILE";
}
