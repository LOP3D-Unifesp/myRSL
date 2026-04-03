import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, GripVertical, MessageCircle } from "lucide-react";
import PdfChatPanel from "@/components/PdfChatPanel";
import { usePdfChatDrag } from "@/hooks/usePdfChatDrag";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfAccessUrl: string | null;
  articleId: string;
  articleTitle: string;
  hasPdfUrl: boolean;
};

export function PdfViewerDialog({ open, onOpenChange, pdfAccessUrl, articleId, articleTitle, hasPdfUrl }: Props) {
  const [showChat, setShowChat] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { pdfChatWidth, isDraggingPdfSplit, setIsDraggingPdfSplit } = usePdfChatDrag(open && showChat, containerRef);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setShowChat(false);
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] w-[96vw] max-w-[1200px] overflow-hidden border-border/80 p-0">
        <DialogHeader className="space-y-0 border-b border-border/70 bg-card px-4 py-3 pr-14 sm:px-5 sm:pr-16">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <DialogTitle className="text-lg">PDF Viewer</DialogTitle>
              <DialogDescription className="mt-1">Read the paper and discuss findings without leaving this page.</DialogDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!pdfAccessUrl) return;
                  const link = document.createElement("a");
                  link.href = pdfAccessUrl;
                  link.download = `${articleTitle}.pdf`;
                  link.target = "_blank";
                  link.click();
                }}
                disabled={!pdfAccessUrl}
              >
                <Download className="mr-1 h-4 w-4" /> Download PDF
              </Button>
              <Button variant={showChat ? "default" : "outline"} size="sm" onClick={() => setShowChat((prev) => !prev)}>
                <MessageCircle className="mr-1 h-4 w-4" /> {showChat ? "Hide Chat" : "Open Chat"}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {!pdfAccessUrl ? (
          <div className="p-6">
            <p className="text-sm text-muted-foreground">No PDF available for this article yet.</p>
          </div>
        ) : (
          <div
            ref={containerRef}
            className="grid gap-3 bg-muted/25 p-3 sm:p-4"
            style={showChat
              ? { gridTemplateColumns: `minmax(0,1fr) 12px ${pdfChatWidth}px` }
              : { gridTemplateColumns: "minmax(0,1fr)" }}
          >
            <div className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
              <iframe src={pdfAccessUrl} className="h-[68vh] w-full" title="PDF Viewer" />
            </div>

            {showChat ? (
              <>
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize PDF chat panel"
                  className="group relative z-10 h-[68vh] cursor-col-resize"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setIsDraggingPdfSplit(true);
                  }}
                >
                  <div
                    className={`pointer-events-none absolute left-1/2 top-1/2 z-10 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/80 bg-background/95 shadow-sm transition-all duration-150 ${
                      isDraggingPdfSplit
                        ? "opacity-100 scale-100 border-primary/60 bg-card"
                        : "opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 group-hover:border-primary/40 group-hover:bg-card"
                    }`}
                  >
                    <div className="flex h-full w-full items-center justify-center">
                      <GripVertical className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </div>
                </div>

                <div className="h-[68vh] overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
                  <div className="flex h-full flex-col">
                    <div className="border-b border-border/60 px-3 py-2">
                      <p className="text-sm font-medium text-foreground">PDF Chat</p>
                    </div>
                    {hasPdfUrl ? (
                      <div className="min-h-0 flex-1 overflow-y-auto p-2">
                        <PdfChatPanel articleId={articleId} articleTitle={articleTitle} />
                      </div>
                    ) : (
                      <div className="flex flex-1 items-center justify-center px-4 text-center">
                        <p className="text-sm text-muted-foreground">Chat unavailable for this PDF.</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
