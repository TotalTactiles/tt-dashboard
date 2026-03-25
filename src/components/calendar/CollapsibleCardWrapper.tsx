import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CollapsibleCardWrapperProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string | number;
}

export default function CollapsibleCardWrapper({ title, defaultOpen = true, children, badge }: CollapsibleCardWrapperProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="stat-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {open
            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          {title}
          {badge !== undefined && (
            <span className="text-[10px] font-mono text-muted-foreground ml-1">({badge})</span>
          )}
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
