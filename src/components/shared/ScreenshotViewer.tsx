import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface ScreenshotViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title?: string;
}

export default function ScreenshotViewer({ open, onOpenChange, url, title = "Reference Screenshot" }: ScreenshotViewerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-auto">
        <DialogTitle className="text-xs font-mono text-muted-foreground">{title}</DialogTitle>
        <img
          src={url}
          alt={title}
          className="w-full rounded-md border border-border"
        />
      </DialogContent>
    </Dialog>
  );
}
