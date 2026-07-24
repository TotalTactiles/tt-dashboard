export type ColumnKey =
  | "name"
  | "status"
  | "start"
  | "due"
  | "comments"
  | "files"
  | "assignee"
  | "table"
  | "rule"
  | "product_code"
  | "list";

export interface ColumnDef {
  key: ColumnKey;
  label: string;
  width: string; // css grid width
  defaultOn: boolean;
  locked?: boolean;
}

export const COLUMN_DEFS: Record<ColumnKey, ColumnDef> = {
  name:         { key: "name",         label: "Name",         width: "minmax(240px,1fr)", defaultOn: true,  locked: true },
  status:       { key: "status",       label: "Status",       width: "120px",             defaultOn: true },
  start:        { key: "start",        label: "Start",        width: "108px",             defaultOn: true },
  due:          { key: "due",          label: "Due",          width: "128px",             defaultOn: true },
  comments:     { key: "comments",     label: "Comments",     width: "44px",              defaultOn: true },
  files:        { key: "files",        label: "Files",        width: "44px",              defaultOn: true },
  assignee:     { key: "assignee",     label: "Assignee",     width: "120px",             defaultOn: false },
  table:        { key: "table",        label: "Table",        width: "110px",             defaultOn: false },
  rule:         { key: "rule",         label: "Rule",         width: "120px",             defaultOn: false },
  product_code: { key: "product_code", label: "Product code", width: "90px",              defaultOn: false },
  list:         { key: "list",         label: "List",         width: "140px",             defaultOn: false },
};

export const ALL_COLUMN_KEYS: ColumnKey[] = [
  "name","status","start","due","comments","files","assignee","table","rule","product_code","list",
];

export const DEFAULT_COLUMNS: ColumnKey[] = ["name","status","start","due","comments","files"];

export const COLUMNS_STORAGE_KEY = "tt.projects.columns";

export function loadColumns(): ColumnKey[] {
  try {
    const raw = localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMNS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_COLUMNS;
    const valid = parsed.filter((k): k is ColumnKey => typeof k === "string" && k in COLUMN_DEFS);
    if (valid.length === 0 || valid[0] !== "name") {
      // enforce name first & present
      const rest = valid.filter((k) => k !== "name");
      return ["name", ...rest];
    }
    return valid;
  } catch {
    return DEFAULT_COLUMNS;
  }
}

export function saveColumns(cols: ColumnKey[]) {
  try {
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(cols));
  } catch {
    /* noop */
  }
}

/** Build the CSS grid-template-columns string. Prefix: drag(24) + checkbox(28); suffix: overflow(32). */
export function buildRowGrid(cols: ColumnKey[]): string {
  const middle = cols.map((k) => COLUMN_DEFS[k].width).join(" ");
  return `24px 28px ${middle} 32px`;
}
