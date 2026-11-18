import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, PanelRightClose, PanelRightOpen, Pencil, Sparkles, Upload } from "lucide-react";

type Props = {
  editorOpen: boolean;
  pdfAccessUrl: string | null;
  hasPdfUrl: boolean;
  articleId: string;
  extracting: boolean;
  uploadingPdf: boolean;
  onToggleEditor: () => void;
  onViewPdf: () => void;
  onUploadPdf: (file: File) => void;
  onExtractFromPdf: () => void;
};

export function ArticleDetailToolbar({ editorOpen, pdfAccessUrl, hasPdfUrl, articleId, extracting, uploadingPdf, onToggleEditor, onViewPdf, onUploadPdf, onExtractFromPdf }: Props) {
  return (
    <div className="sticky top-2 z-20 rounded-lg border border-border/60 bg-background/90 px-2 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={editorOpen ? "outline" : "default"}
          size="sm"
          className={editorOpen ? "border-primary/40 text-primary hover:bg-primary/10 hover:text-primary focus-visible:text-primary" : ""}
          onClick={onToggleEditor}
        >
          {editorOpen ? <PanelRightClose className="mr-1 h-4 w-4" /> : <PanelRightOpen className="mr-1 h-4 w-4" />}
          {editorOpen ? "Close review panel" : "Open review panel"}
        </Button>

        <Button asChild variant="outline" size="sm">
          <Link to={`/articles/${articleId}/edit`}>
            <Pencil className="mr-1 h-4 w-4" /> Edit Full Form
          </Link>
        </Button>

        {!hasPdfUrl ? (
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadPdf(f); }}
              disabled={uploadingPdf}
            />
            <Button variant="outline" size="sm" asChild disabled={uploadingPdf}>
              <span>
                {uploadingPdf ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                {uploadingPdf ? "Uploading..." : "Upload PDF"}
              </span>
            </Button>
          </label>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={onViewPdf} disabled={!pdfAccessUrl}>
              <FileText className="mr-1 h-4 w-4" /> View PDF
            </Button>
            <Button variant="outline" size="sm" onClick={onExtractFromPdf} disabled={extracting || !pdfAccessUrl}>
              {extracting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
              {extracting ? "Extracting..." : "Extract from PDF"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
