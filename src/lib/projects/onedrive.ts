// OneDrive integration via n8n webhooks.
// The dashboard NEVER talks to OneDrive directly — only these four endpoints.

const BASE = "https://n8n.srv1437130.hstgr.cloud/webhook";

export interface OneDriveFile {
  onedrive_item_id: string;
  file_name: string;
  web_url: string;
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
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export async function uploadFile(args: {
  projectName: string;
  taskName: string;
  projectId: string;
  taskId: string;
  file: File;
}): Promise<UploadedFile> {
  const file_base64 = await readAsBase64(args.file);
  const res = await fetch(`${BASE}/onedrive-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_name: args.projectName,
      task_name: args.taskName,
      file_name: args.file.name,
      file_base64,
      mime_type: args.file.type || "application/octet-stream",
      project_id: args.projectId,
      task_id: args.taskId,
    }),
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const data = await res.json();
  if (!data?.ok) throw new Error("Upload rejected by server");
  return {
    onedrive_item_id: data.onedrive_item_id,
    onedrive_web_url: data.onedrive_web_url,
    file_name: data.file_name,
    size_bytes: data.size_bytes,
    mime_type: data.mime_type,
  };
}

export async function listFiles(args: {
  projectName: string;
  taskName: string;
}): Promise<OneDriveFile[]> {
  const res = await fetch(`${BASE}/onedrive-list`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_name: args.projectName,
      task_name: args.taskName,
    }),
  });
  if (!res.ok) throw new Error(`List failed (${res.status})`);
  const data = await res.json();
  if (!data?.ok) throw new Error("List rejected by server");
  return (data.files ?? []) as OneDriveFile[];
}

export async function deleteFile(onedriveItemId: string): Promise<void> {
  const res = await fetch(`${BASE}/onedrive-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ onedrive_item_id: onedriveItemId }),
  });
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
  const data = await res.json();
  if (!data?.ok || !data?.deleted) throw new Error("Delete rejected by server");
}

export function fileGlyph(mime: string, name: string): { label: string; hint: string } {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  if (mime.startsWith("video/")) return { label: `.${ext || "mp4"}`, hint: "video" };
  if (mime === "application/pdf" || ext === "pdf") return { label: ".pdf", hint: "pdf" };
  if (ext === "dwg" || ext === "dxf") return { label: `.${ext}`, hint: "cad" };
  if (ext === "docx" || ext === "doc") return { label: `.${ext}`, hint: "doc" };
  if (ext === "xlsx" || ext === "xls") return { label: `.${ext}`, hint: "sheet" };
  return { label: `.${ext || "file"}`, hint: "file" };
}
