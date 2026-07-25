// OneDrive integration via n8n webhooks.
// The dashboard NEVER talks to OneDrive directly — only these endpoints.
//
// Contract quirks handled at this boundary:
//   1. Failures do NOT return { ok: false } — they return { FATAL: "..." } with
//      no `ok` key. Treat only `ok === true` as success; surface FATAL as error.
//   2. The list endpoint returns `web_url`; upload returns `onedrive_web_url`.
//      Normalise both to `onedrive_web_url` here so components never care.

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

async function callWebhook(path: string, body: unknown): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e: any) {
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

export async function listFiles(args: {
  projectName: string;
  taskName: string;
}): Promise<OneDriveFile[]> {
  const data = await callWebhook("/onedrive-list", {
    project_name: args.projectName,
    task_name: args.taskName,
  });
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
  const data = await callWebhook("/onedrive-delete", {
    onedrive_item_id: onedriveItemId,
  });
  if (!data.deleted) throw new Error("Delete rejected by server");
}

export function fileExtLabel(name: string): string {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  return ext ? ext.toUpperCase() : "FILE";
}
