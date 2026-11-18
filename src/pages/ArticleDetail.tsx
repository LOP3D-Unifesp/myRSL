import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchArticle, updateArticle, type ArticleInsert } from "@/lib/articles";
import { sanitizeExtractedArticle } from "@/lib/article-schemas";
import { supabase } from "@/integrations/supabase/client";
import { articleKeys } from "@/lib/article-query-keys";
import { formatCompactAuthors } from "@/lib/article-authors";
import { useMyReviewerRole, useReviewMemberNames } from "@/hooks/useReviewMemberNames";
import { useQaQuestions } from "@/hooks/useProtocolData";
import { QA_QUESTIONS, calculateQAScore, type QAKey } from "@/lib/qa-questions";
import { countCompletedVerifications, isFullyVerified, verificationLabelFor, type VerificationKey } from "@/lib/article-verification";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft, GripVertical, X } from "lucide-react";
import PageState from "@/components/layout/PageState";
import { getPdfAccessUrl } from "@/lib/pdf-storage";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSplitPaneDrag } from "@/hooks/useSplitPaneDrag";
import ArticleReviewEditorPanel from "@/components/article/ArticleReviewEditorPanel";
import { ArticleDetailHeader } from "@/components/article/ArticleDetailHeader";
import { ArticleDetailToolbar } from "@/components/article/ArticleDetailToolbar";
import { ArticleSummaryStrip } from "@/components/article/ArticleSummaryStrip";
import { ArticleOverviewTab } from "@/components/article/ArticleOverviewTab";
import { ArticleQaTab } from "@/components/article/ArticleQaTab";
import { ArticleTechnicalTab } from "@/components/article/ArticleTechnicalTab";
import { PdfViewerDialog } from "@/components/article/PdfViewerDialog";
import { useAuthUserId } from "@/contexts/auth-user-id";

type DetailsTab = "overview" | "qa" | "technical";

const ArticleDetail = () => {
  const userId = useAuthUserId();
  const qaQuestions = useQaQuestions();
  const memberNames = useReviewMemberNames();
  const { slot: myReviewerSlot, isOwner: isReviewOwner } = useMyReviewerRole();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [pdfAccessUrl, setPdfAccessUrl] = useState<string | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [detailsTab, setDetailsTab] = useState<DetailsTab>("overview");
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [qaPreviewScore, setQaPreviewScore] = useState<number | null>(null);
  const [clockTick, setClockTick] = useState(Date.now());
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  const desktopPanelOpen = !isMobile && editorOpen;
  const { leftPanePercent, setLeftPanePercent, isDraggingSplit, setIsDraggingSplit } = useSplitPaneDrag(desktopPanelOpen, splitContainerRef);

  const { data: article, isLoading } = useQuery({
    queryKey: articleKeys.detail(userId, id),
    queryFn: () => fetchArticle(id!),
    enabled: Boolean(id && userId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: articleKeys.detail(userId, id) });
    queryClient.invalidateQueries({ queryKey: articleKeys.all(userId) });
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

  useEffect(() => {
    if (!editorDirty) return;
    setLastSavedAt(null);
  }, [editorDirty]);

  useEffect(() => {
    if (!lastSavedAt) return;
    const timer = window.setInterval(() => setClockTick(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [lastSavedAt]);

  const handleUploadPdf = async (file: File) => {
    setUploadingPdf(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("research-pdfs").upload(filePath, file, { upsert: false });
      if (error) throw error;
      await updateArticle(article!.id, { pdf_url: filePath });
      invalidate();
      toast.success("PDF uploaded.");
    } catch {
      toast.error("Failed to upload PDF.");
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleExtractFromPdf = async () => {
    if (!pdfAccessUrl) return;
    setExtracting(true);
    try {
      const response = await fetch(pdfAccessUrl);
      if (!response.ok) throw new Error("Could not download the PDF file.");
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const { data, error } = await supabase.functions.invoke("extract-pdf", {
        body: { pdfBase64: base64, fileName: "article.pdf", fileType: "application/pdf" },
      });
      if (error) throw new Error(error.message);
      if (!data?.extracted) throw new Error(data?.error ?? "No data could be extracted from the PDF.");
      const sanitized = sanitizeExtractedArticle(data.extracted);
      if (Object.keys(sanitized).length === 0) throw new Error("No valid fields were extracted from the PDF.");
      await updateArticle(article!.id, sanitized);
      invalidate();
      toast.success("Fields updated from PDF. Please review.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to extract PDF data.");
    } finally {
      setExtracting(false);
    }
  };

  const handleVerificationToggle = async (key: VerificationKey) => {
    if (!article) return;
    try {
      const payload = { [key]: !article[key] } as Pick<ArticleInsert, VerificationKey>;
      await updateArticle(article.id, payload);
      invalidate();
      const stageLabel = verificationLabelFor(key);
      toast.success(`${stageLabel} ${article[key] ? "reverted" : "verified"}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(/reviewer/i.test(message) ? message : "Failed to update verification.");
    }
  };

  const handleBack = () => {
    const state = location.state as { from?: string } | null;
    if (state?.from) {
      navigate(state.from);
      return;
    }
    navigate(-1);
  };

  const openEditor = () => {
    if (editorOpen) return;
    setLeftPanePercent(58);
    setEditorOpen(true);
  };

  const requestCloseEditor = () => {
    if (!editorDirty) {
      setEditorOpen(false);
      return;
    }
    const shouldDiscard = window.confirm("You have unsaved changes in the review panel. Close and discard them?");
    if (shouldDiscard) {
      setEditorOpen(false);
    }
  };

  if (isLoading) {
    return <PageState title="Loading article..." description="Fetching article data and references." />;
  }

  if (!article) {
    return <PageState title="Article not found" description="It may have been removed or you may not have access." />;
  }

  const articleVerification = {
    verify_peer1: article.verify_peer1,
    verify_peer2: article.verify_peer2,
    verify_qa3: article.verify_qa3,
    verify_qa4: article.verify_qa4,
  } as const;
  const verificationStamps = {
    verify_peer1: { by: article.verify_peer1_by ?? null, at: article.verify_peer1_at ?? null },
    verify_peer2: { by: article.verify_peer2_by ?? null, at: article.verify_peer2_at ?? null },
    verify_qa3: { by: article.verify_qa3_by ?? null, at: article.verify_qa3_at ?? null },
    verify_qa4: { by: article.verify_qa4_by ?? null, at: article.verify_qa4_at ?? null },
  };
  // Peer 1 / QA P1 belong to reviewer 1, Peer 2 / QA P2 to reviewer 2; owners may change any step.
  const lockedSteps = new Set<VerificationKey>(
    isReviewOwner || myReviewerSlot === null
      ? []
      : myReviewerSlot === 1 ? ["verify_peer2", "verify_qa4"] : ["verify_peer1", "verify_qa3"],
  );
  const samePeerReviewer = Boolean(article.verify_peer1 && article.verify_peer2 && verificationStamps.verify_peer1.by && verificationStamps.verify_peer1.by === verificationStamps.verify_peer2.by);
  const fullyVerified = isFullyVerified(articleVerification);
  const verificationProgress = countCompletedVerifications(articleVerification);
  const qaAnswers = QA_QUESTIONS.reduce((acc, question) => {
    acc[question.key] = article[question.key];
    return acc;
  }, {} as Record<QAKey, string | null>);
  const decidedQaItems = QA_QUESTIONS.filter((question) => Boolean(qaAnswers[question.key])).length;
  const persistedQaScore = article.qa_score ?? calculateQAScore(qaAnswers);
  const qaScore = qaPreviewScore ?? persistedQaScore;
  const qaTone = qaScore >= 7 ? "text-accent" : qaScore >= 4 ? "text-warning" : "text-destructive";
  const authorLabel = formatCompactAuthors(article.author, article.first_author);
  const citationLabel = `${authorLabel}${article.year ? `, ${article.year}` : ""}`;
  const reviewSessionState = editorDirty ? "Pending changes" : lastSavedAt ? "Saved" : "No changes";
  const reviewSessionTone = editorDirty ? "text-warning-foreground" : lastSavedAt ? "text-accent" : "text-muted-foreground";
  const reviewSessionBadgeTone = editorDirty
    ? "border-warning/40 bg-warning/15 text-warning-foreground"
    : lastSavedAt
      ? "border-accent/30 bg-accent/10 text-accent"
      : "border-border/70 bg-background text-muted-foreground";
  const savedAgo = formatSavedAgo(lastSavedAt, clockTick);
  const mainGridClass = desktopPanelOpen ? "grid gap-0" : "grid gap-4";
  const splitColumnsStyle = desktopPanelOpen
    ? { gridTemplateColumns: `${leftPanePercent}fr 16px ${100 - leftPanePercent}fr` }
    : undefined;
  const articleTitle = article.title || article.first_author || article.author || "Untitled";

  const editorPanelProps = {
    article,
    onSaved: () => {
      setLastSavedAt(Date.now());
      setEditorDirty(false);
      invalidate();
    },
    onDirtyChange: setEditorDirty,
    onQaScorePreviewChange: setQaPreviewScore,
  };

  return (
    <div className="page-container">
      <Button variant="ghost" size="sm" onClick={handleBack} className="-ml-2 w-fit" aria-label="Go back">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back
      </Button>

      <div ref={splitContainerRef} className={mainGridClass} style={splitColumnsStyle}>
        <div className="space-y-4">
          <ArticleDetailHeader
            article={article}
            fullyVerified={fullyVerified}
            articleTitle={articleTitle}
            citationLabel={citationLabel}
          />

          <ArticleDetailToolbar
            editorOpen={editorOpen}
            pdfAccessUrl={pdfAccessUrl}
            hasPdfUrl={!!article.pdf_url}
            articleId={article.id}
            extracting={extracting}
            uploadingPdf={uploadingPdf}
            onToggleEditor={() => {
              if (editorOpen) requestCloseEditor();
              else openEditor();
            }}
            onViewPdf={() => setPdfModalOpen(true)}
            onUploadPdf={handleUploadPdf}
            onExtractFromPdf={handleExtractFromPdf}
          />

          <ArticleSummaryStrip
            qaScore={qaScore}
            qaTone={qaTone}
            decidedQaItems={decidedQaItems}
            totalQaItems={QA_QUESTIONS.length}
            consensusStatus={article.qa_consensus_status}
            verificationProgress={verificationProgress}
            verification={articleVerification}
            stamps={verificationStamps}
            names={memberNames}
            locked={lockedSteps}
            samePeerReviewer={samePeerReviewer}
            onToggleVerification={handleVerificationToggle}
            sessionState={reviewSessionState}
            sessionBadgeTone={reviewSessionBadgeTone}
            savedAgo={savedAgo}
          />

          <section className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <Tabs value={detailsTab} onValueChange={(value) => setDetailsTab(value as DetailsTab)} className="space-y-4">
              <TabsList className="grid h-auto w-full grid-cols-3 bg-muted/70 p-1">
                <TabsTrigger value="overview" className="py-2">Overview</TabsTrigger>
                <TabsTrigger value="qa" className="py-2">QA</TabsTrigger>
                <TabsTrigger value="technical" className="py-2">Technical &amp; Outcomes</TabsTrigger>
              </TabsList>

              <TabsContent value="overview"><ArticleOverviewTab article={article} /></TabsContent>
              <TabsContent value="qa">
                <ArticleQaTab articleId={article.id} questions={qaQuestions} finalAnswers={qaAnswers} onOpenReview={openEditor} />
              </TabsContent>
              <TabsContent value="technical"><ArticleTechnicalTab article={article} /></TabsContent>
            </Tabs>
          </section>
        </div>

        {desktopPanelOpen ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panels"
            className="group sticky top-3 z-20 h-[calc(100vh-1.5rem)] w-4 cursor-col-resize overflow-visible"
            title="Drag to resize panels"
            onPointerDown={(event) => {
              event.preventDefault();
              setIsDraggingSplit(true);
            }}
          >
            <div
              className={`pointer-events-none absolute left-1/2 top-1/2 z-10 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/80 bg-background/95 shadow-sm transition-all duration-150 ${
                isDraggingSplit
                  ? "opacity-100 scale-100 border-primary/60 bg-card"
                  : "opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 group-hover:border-primary/40 group-hover:bg-card"
              }`}
            >
              <div className="flex h-full w-full items-center justify-center">
                <GripVertical className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </div>
            </div>
            <span className={`pointer-events-none absolute left-1/2 top-[calc(50%+30px)] -translate-x-1/2 rounded-md border border-border/70 bg-popover px-2 py-1 text-[11px] text-muted-foreground shadow-sm transition-opacity duration-150 ${isDraggingSplit ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
              Drag to resize
            </span>
          </div>
        ) : null}

        {desktopPanelOpen ? (
          <aside className="sticky top-3 z-10 h-[calc(100vh-1.5rem)] overflow-hidden rounded-xl border border-border/70 bg-card shadow-[0_12px_36px_-18px_hsl(var(--foreground)/0.35)] ring-1 ring-primary/10">
            <div className="space-y-2 border-b border-border/70 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold text-foreground">Review Panel</p>
                  <p className="text-sm text-muted-foreground">Save by section while reviewing</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close editor panel"
                  className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:text-foreground"
                  onClick={requestCloseEditor}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={reviewSessionBadgeTone}>{reviewSessionState}</Badge>
                <span className={`text-sm font-semibold ${qaTone}`}>QA {qaScore}/10</span>
                {savedAgo ? <span className="text-xs text-muted-foreground">Saved {savedAgo}</span> : null}
              </div>
            </div>
            <div className="h-[calc(100%-88px)] overflow-y-auto p-3">
              <ArticleReviewEditorPanel {...editorPanelProps} />
            </div>
          </aside>
        ) : null}
      </div>

      <PdfViewerDialog
        open={pdfModalOpen}
        onOpenChange={setPdfModalOpen}
        pdfAccessUrl={pdfAccessUrl}
        articleId={article.id}
        articleTitle={articleTitle}
        hasPdfUrl={!!article.pdf_url}
      />

      {isMobile ? (
        <Sheet
          open={editorOpen}
          onOpenChange={(open) => {
            if (open) setEditorOpen(true);
            else requestCloseEditor();
          }}
        >
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>Review Panel</SheetTitle>
              <SheetDescription>Review and save by section without leaving the article page.</SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              <ArticleReviewEditorPanel {...editorPanelProps} />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
};


function formatSavedAgo(lastSavedAt: number | null, now: number) {
  if (!lastSavedAt) return null;
  const diffMs = Math.max(0, now - lastSavedAt);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default ArticleDetail;
