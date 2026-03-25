import { useState } from "react";
import { X, Plus, Upload } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { motion, AnimatePresence } from "framer-motion";

interface KeepNote {
  id: string;
  title: string;
  body: string;
  color: string | null;
  createdAt: string;
  source: "manual" | "keep";
}

const STORAGE_KEY = "tt_keep_notes";
const uid = () => Math.random().toString(36).slice(2, 10);

const NOTE_COLORS: (string | null)[] = [
  null,
  "#378ADD",
  "#1D9E75",
  "#E24B4A",
  "#BA7517",
  "#7F77DD",
  "#888780",
];

function loadNotes(): KeepNote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveNotes(notes: KeepNote[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function parseKeepJson(raw: string): KeepNote[] {
  const parsed = JSON.parse(raw);
  const arr: any[] = Array.isArray(parsed) ? parsed : (parsed.notes ?? []);
  return arr
    .filter((n: any) => n.textContent || n.title)
    .map((n: any) => ({
      id: uid(),
      title: n.title || "Untitled",
      body: n.textContent || "",
      color: null,
      createdAt: n.createdTimestampUsec
        ? new Date(n.createdTimestampUsec / 1000).toISOString()
        : new Date().toISOString(),
      source: "keep" as const,
    }));
}

export default function KeepNotesPanel() {
  const [notes, setNotes] = useState(loadNotes);
  const [search, setSearch] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [importJson, setImportJson] = useState("");
  const [importCount, setImportCount] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const persist = (next: KeepNote[]) => {
    setNotes(next);
    saveNotes(next);
  };

  const filtered = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.body.toLowerCase().includes(search.toLowerCase())
  );

  const handleSaveNew = () => {
    if (!newTitle.trim() && !newBody.trim()) return;
    const note: KeepNote = {
      id: uid(),
      title: newTitle.trim() || "Untitled",
      body: newBody.trim(),
      color: null,
      createdAt: new Date().toISOString(),
      source: "manual",
    };
    persist([note, ...notes]);
    setNewTitle("");
    setNewBody("");
    setAddingNote(false);
  };

  const handleImport = () => {
    try {
      const imported = parseKeepJson(importJson);
      const existingKeys = new Set(notes.map((n) => n.title + n.body));
      const deduped = imported.filter((n) => !existingKeys.has(n.title + n.body));
      persist([...deduped, ...notes]);
      setImportCount(deduped.length);
      setImportJson("");
    } catch {
      setImportCount(-1);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-fluid-lg font-semibold text-foreground">Notes</h2>
          <p className="text-fluid-xs text-muted-foreground font-mono">Google Keep &amp; manual notes</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 px-3 rounded-lg text-xs bg-muted border-0 outline-none focus:ring-1 focus:ring-primary/40 w-36"
          />

          {/* Import Popover */}
          <Popover open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) setImportCount(null); }}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors">
                <Upload className="h-3 w-3" />
                Import from Keep
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 space-y-3" side="bottom" align="end">
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Import Google Keep notes</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Export via takeout.google.com → select Keep → download. Open the zip, find Notes.json, then paste its contents or upload below.
                </p>
              </div>
              <textarea
                placeholder="Paste Notes.json contents here…"
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                rows={5}
                className="w-full bg-muted rounded-lg px-3 py-2 text-[11px] font-mono text-foreground outline-none resize-none placeholder:text-muted-foreground/50 border-0 focus:ring-1 focus:ring-primary/40"
              />
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer border border-border rounded-lg px-3 py-1.5 transition-colors">
                  Upload .json
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => setImportJson(ev.target?.result as string);
                      reader.readAsText(file);
                    }}
                  />
                </label>
                <button
                  onClick={handleImport}
                  className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Import
                </button>
              </div>
              {importCount !== null && (
                <p className={`text-[11px] font-medium ${importCount === -1 ? "text-destructive" : "text-emerald-500"}`}>
                  {importCount === -1
                    ? "Invalid JSON — check the file format."
                    : importCount === 0
                    ? "No new notes (all duplicates)."
                    : `${importCount} note${importCount !== 1 ? "s" : ""} imported.`}
                </p>
              )}
            </PopoverContent>
          </Popover>

          <button
            onClick={() => setAddingNote(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3 w-3" />
            New Note
          </button>
        </div>
      </div>

      {/* New note inline card */}
      <AnimatePresence>
        {addingNote && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="mb-4"
          >
            <div className="stat-card" style={{ borderLeft: "4px solid hsl(var(--primary))" }}>
              <input
                autoFocus
                placeholder="Title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveNew()}
                className="w-full bg-transparent text-sm font-semibold text-foreground outline-none mb-2 placeholder:text-muted-foreground/40"
              />
              <textarea
                placeholder="Note…"
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                rows={4}
                className="w-full bg-transparent text-xs text-muted-foreground outline-none resize-none placeholder:text-muted-foreground/30"
              />
              <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-border/30">
                <button
                  onClick={() => { setAddingNote(false); setNewTitle(""); setNewBody(""); }}
                  className="text-xs text-muted-foreground hover:text-foreground px-3 py-1 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNew}
                  className="text-xs px-3 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes grid */}
      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground py-10 text-center">
          {search ? "No notes match your search." : "No notes yet — add one or import from Google Keep."}
        </p>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-3">
          {filtered.map((note) => (
            <div
              key={note.id}
              className="stat-card break-inside-avoid mb-3 group/note relative"
              style={note.color ? { borderLeft: `4px solid ${note.color}` } : {}}
            >
              {/* Delete */}
              <button
                onClick={() => persist(notes.filter((n) => n.id !== note.id))}
                className="absolute top-2 right-2 opacity-0 group-hover/note:opacity-100 transition-opacity"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive transition-colors" />
              </button>

              {/* Title */}
              <p
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) =>
                  persist(notes.map((n) => n.id === note.id ? { ...n, title: e.currentTarget.textContent?.trim() || "Untitled" } : n))
                }
                className="text-sm font-semibold text-foreground outline-none mb-1.5 pr-5 empty:before:content-['Untitled'] empty:before:text-muted-foreground/40"
              >
                {note.title}
              </p>

              {/* Body */}
              <p
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) =>
                  persist(notes.map((n) => n.id === note.id ? { ...n, body: e.currentTarget.textContent?.trim() || "" } : n))
                }
                className="text-xs text-muted-foreground outline-none whitespace-pre-wrap min-h-[20px] empty:before:content-['Add_a_note…'] empty:before:text-muted-foreground/30"
              >
                {note.body}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
                <div className="flex items-center gap-1">
                  {NOTE_COLORS.map((c) => (
                    <button
                      key={c ?? "none"}
                      onClick={() => persist(notes.map((n) => n.id === note.id ? { ...n, color: c } : n))}
                      className="w-3 h-3 rounded-full border transition-transform hover:scale-125"
                      style={{
                        background: c ?? "transparent",
                        borderColor: c ?? "hsl(var(--border))",
                        outline: note.color === c ? `2px solid ${c ?? "hsl(var(--foreground))"}` : "none",
                        outlineOffset: "1px",
                      }}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-mono text-muted-foreground/50 flex items-center gap-1">
                  {new Date(note.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "2-digit" })}
                  {note.source === "keep" && (
                    <span className="text-[9px] opacity-60 ml-0.5">Keep</span>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
