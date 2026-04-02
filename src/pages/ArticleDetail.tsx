import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchArticle, updateArticle, type ArticleInsert } from "@/lib/articles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Pencil, FileText, MessageCircle, Download, ExternalLink } from "lucide-react";
import PdfChatPanel from "@/components/PdfChatPanel";
import VerificationToggles from "@/components/article/VerificationToggles";
import QualityAssessmentTab from "@/components/article/QualityAssessmentTab";
import ArticleDetailContent from "@/components/article/ArticleDetailContent";
import { toast } from "sonner";
import { getPdfAccessUrl } from "@/lib/pdf-storage";

type VerificationKey = "verify_peer1" | "verify_peer2" | "verify_qa3" | "verify_qa4";

const ArticleDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [showPdf, setShowPdf] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [doiInput, setDoiInput] = useState("");
  const [doiEditing, setDoiEditing] = useState(false);
  const [pdfAccessUrl, setPdfAccessUrl] = useState<string | null>(null);

  const { data: article, isLoading } = useQuery({
    queryKey: ["article", id],
    queryFn: () => fetchArticle(id!),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["article", id] });
    queryClient.invalidateQueries({ queryKey: ["articles"] });
  };

  useEffect(() => {
    let mounted = true;
    if (!article?.pdf_url) {
      setPdfAccessUrl(null);
      return;
    }
    getPdfAccessUrl(article.pdf_url).then((url) => {
      if (mounted) setPdfAccessUrl(url);
    });
    return () => {
      mounted = false;
    };
  }, [article?.pdf_url]);

  const handleVerificationToggle = async (key: VerificationKey) => {
    if (!article) return;
    try {
      const payload = { [key]: !article[key] } as Pick<ArticleInsert, VerificationKey>;
      await updateArticle(article.id, payload);
      invalidate();
      toast.success(`${key.replace("verify_", "").replace("_", " ").toUpperCase()} ${article[key] ? "reverted" : "verified"}!`);
    } catch {
      toast.error("Failed to update verification");
    }
  };

  const handleDoiSave = async () => {
    if (!article) return;
    try {
      await updateArticle(article.id, { doi: doiInput || null });
      invalidate();
      setDoiEditing(false);
      toast.success("DOI updated!");
    } catch {
      toast.error("Failed to update DOI");
    }
  };

  const handleDownloadPdf = () => {
    if (!article || !pdfAccessUrl) return;
    const link = document.createElement("a");
    link.href = pdfAccessUrl;
    link.download = `${article.title || "article"}.pdf`;
    link.target = "_blank";
    link.click();
  };

  const handleBack = () => {
    const state = location.state as { from?: string } | null;
    if (state?.from) {
      navigate(state.from);
      return;
    }
    navigate(-1);
  };

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Loading…</div>;
  if (!article) return <div className="py-20 text-center text-muted-foreground">Article not found</div>;

  const statusBadge = article.review_status === "verified"
    ? <Badge className="bg-green-600 text-white">Verified</Badge>
    : <Badge className="bg-yellow-500 text-white">Pending Review</Badge>;

  return (
    <div className="animate-fade-in max-w-6xl mx-auto">
      {/* Top Bar */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack} aria-label="Go back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-serif text-foreground">
              {article.title || article.author || "No author"} {article.year ? `(${article.year})` : ""}
            </h1>
            <div className="flex gap-2 mt-1 flex-wrap">
              {article.is_draft && <Badge variant="outline">Draft</Badge>}
              {statusBadge}
              {article.country && <Badge variant="secondary">{article.country}</Badge>}
              {article.qa_score != null && (
                <Badge variant="outline" className="font-mono">QA: {article.qa_score}/10</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {pdfAccessUrl && (
            <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
              <Download className="mr-1 h-4 w-4" /> Download PDF
            </Button>
          )}
          {pdfAccessUrl && (
            <Button variant="outline" size="sm" onClick={() => { setShowPdf(!showPdf); if (showPdf) setShowChat(false); }}>
              <FileText className="mr-1 h-4 w-4" />
              {showPdf ? "Hide PDF" : "View PDF"}
            </Button>
          )}
          {showPdf && pdfAccessUrl && (
            <Button variant="outline" size="sm" onClick={() => setShowChat(!showChat)}>
              <MessageCircle className="mr-1 h-4 w-4" />
              {showChat ? "Hide Chat" : "Chat"}
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to={`/articles/${article.id}/edit`}>
              <Pencil className="mr-1 h-4 w-4" /> Edit
            </Link>
          </Button>
        </div>
      </div>

      {/* DOI Row */}
      <div className="mb-4 flex items-center gap-3">
        <Label className="text-sm font-medium text-muted-foreground shrink-0">DOI:</Label>
        {doiEditing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={doiInput}
              onChange={(e) => setDoiInput(e.target.value)}
              placeholder="10.xxxx/xxxxx"
              className="max-w-sm"
            />
            <Button size="sm" onClick={handleDoiSave}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setDoiEditing(false)}>Cancel</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {article.doi ? (
              <a href={`https://doi.org/${article.doi}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline hover:text-primary/80 flex items-center gap-1">
                {article.doi} <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="text-sm text-muted-foreground">Not set</span>
            )}
            <Button size="sm" variant="ghost" onClick={() => { setDoiInput(article.doi || ""); setDoiEditing(true); }}>
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Verifications */}
      <div className="mb-4">
        <Label className="text-sm font-medium text-muted-foreground mb-2 block">Verifications:</Label>
        <VerificationToggles
          values={{
            verify_peer1: article.verify_peer1,
            verify_peer2: article.verify_peer2,
            verify_qa3: article.verify_qa3,
            verify_qa4: article.verify_qa4,
          }}
          onToggle={handleVerificationToggle}
        />
      </div>

      {/* Tabs: Details | Quality Assessment */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Article Details</TabsTrigger>
          <TabsTrigger value="qa">Quality Assessment</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          {showPdf ? (
            <div className="grid grid-cols-2 gap-4" style={{ height: "calc(100vh - 280px)" }}>
              <div className="overflow-y-auto pr-2">
                <ArticleDetailContent article={article} />
              </div>
              <div className="flex flex-col gap-2 h-full">
                <iframe src={pdfAccessUrl ?? undefined} className="flex-1 w-full rounded-lg border" title="PDF Viewer" />
                {showChat && article.pdf_url && (
                  <PdfChatPanel articleId={article.id} articleTitle={article.title || article.author || "this paper"} />
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mt-4">
              <ArticleDetailContent article={article} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="qa">
          <div className="max-w-4xl mt-4">
            <QualityAssessmentTab article={article} onUpdated={invalidate} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ArticleDetail;
