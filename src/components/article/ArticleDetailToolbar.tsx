import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, PanelRightClose, PanelRightOpen, Pencil } from "lucide-react";

type Props = {
  editorOpen: boolean;
  pdfAccessUrl: string | null;
  articleId: string;
  onToggleEditor: () => void;
  onViewPdf: () => void;
};

export function ArticleDetailToolbar({ editorOpen, pdfAccessUrl, articleId, onToggleEditor, onViewPdf }: Props) {
  return (
    <div className="sticky top-2 z-20 mt-5 -mx-1 rounded-lg border border-border/60 bg-background/90 px-2 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
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

        <Button variant="outline" size="sm" onClick={onViewPdf} disabled={!pdfAccessUrl}>
          <FileText className="mr-1 h-4 w-4" /> View PDF
        </Button>
      </div>
    </div>
  );
}
