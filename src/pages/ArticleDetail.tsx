import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchArticle, updateArticle, type ArticleInsert } from "@/lib/articles";
import { formatCompactAuthors } from "@/lib/article-authors";
import { QA_QUESTIONS, calculateQAScore, type QAKey } from "@/lib/qa-questions";
import { countCompletedVerifications, isFullyVerified, verificationLabelFor, type VerificationKey } from "@/lib/article-verification";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft, Clock3, Download, ExternalLink, FileText, GripVertical, MessageCircle, PanelRightClose, PanelRightOpen, Pencil, X } from "lucide-react";
import VerificationToggles from "@/components/article/VerificationToggles";
import PdfChatPanel from "@/components/PdfChatPanel";
import PageState from "@/components/layout/PageState";
import { getPdfAccessUrl } from "@/lib/pdf-storage";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import ArticleReviewEditorPanel from "@/components/article/ArticleReviewEditorPanel";

const ArticleDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [showChat, setShowChat] = useState(false);
  const [pdfAccessUrl, setPdfAccessUrl] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [detailsTab, setDetailsTab] = useState<"overview" | "qa">("overview");
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfChatWidth, setPdfChatWidth] = useState(360);
  const [isDraggingPdfSplit, setIsDraggingPdfSplit] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [qaPreviewScore, setQaPreviewScore] = useState<number | null>(null);
  const [leftPanePercent, setLeftPanePercent] = useState(58);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [clockTick, setClockTick] = useState(Date.now());
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const pdfSplitContainerRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!editorDirty) return;
    setLastSavedAt(null);
  }, [editorDirty]);

  useEffect(() => {
    if (!lastSavedAt) return;
    const timer = window.setInterval(() => setClockTick(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [lastSavedAt]);

  const handleVerificationToggle = async (key: VerificationKey) => {
    if (!article) return;
    try {
      const payload = { [key]: !article[key] } as Pick<ArticleInsert, VerificationKey>;
      await updateArticle(article.id, payload);
      invalidate();
      const stageLabel = verificationLabelFor(key);
      toast.success(`${stageLabel} ${article[key] ? "reverted" : "verified"}.`);
    } catch {
      toast.error("Failed to update verification.");
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

  const desktopPanelOpen = !isMobile && editorOpen;

  useEffect(() => {
    if (!desktopPanelOpen || !isDraggingSplit) return;

    const onPointerMove = (event: PointerEvent) => {
      const container = splitContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const splitterWidth = 16;
      const availableWidth = rect.width - splitterWidth;
      if (availableWidth <= 0) return;
      const minPanePx = 320;
      const minPercent = (minPanePx / availableWidth) * 100;
      const maxPercent = 100 - minPercent;
      const rawPercent = ((event.clientX - rect.left) / availableWidth) * 100;
      const clamped = Math.max(minPercent, Math.min(maxPercent, rawPercent));
      setLeftPanePercent(clamped);
    };

    const onPointerUp = () => {
      setIsDraggingSplit(false);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [desktopPanelOpen, isDraggingSplit]);

  useEffect(() => {
    if (!pdfModalOpen || !showChat || !isDraggingPdfSplit) return;

    const onPointerMove = (event: PointerEvent) => {
      const container = pdfSplitContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const splitterWidth = 12;
      const minChatPx = 320;
      const minPdfPx = 480;
      const maxChatByWidth = rect.width - splitterWidth - minPdfPx;
      const maxChatPx = Math.max(minChatPx, Math.min(560, maxChatByWidth));
      const nextChatWidth = rect.right - event.clientX;
      const clamped = Math.max(minChatPx, Math.min(maxChatPx, nextChatWidth));
      setPdfChatWidth(clamped);
    };

    const onPointerUp = () => {
      setIsDraggingPdfSplit(false);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [pdfModalOpen, showChat, isDraggingPdfSplit]);

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
  const fullyVerified = isFullyVerified(articleVerification);
  const verificationProgress = countCompletedVerifications(articleVerification);
  const qaAnswers = QA_QUESTIONS.reduce((acc, question) => {
    acc[question.key] = article[question.key];
    return acc;
  }, {} as Record<QAKey, string | null>);
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
  const primaryQuestion = article.primary_research_question?.trim() || null;
  const researchQuestions = article.research_questions ?? [];

  return (
    <div className="page-container">
      <Button variant="ghost" size="sm" onClick={handleBack} className="-ml-2 w-fit" aria-label="Go back">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back
      </Button>

      <div ref={splitContainerRef} className={mainGridClass} style={splitColumnsStyle}>
        <div className="space-y-4">
          <section className="rounded-xl border border-border/70 bg-card p-5 shadow-sm md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{article.study_id || "No Study ID"}</Badge>
                  {fullyVerified ? <Badge className="bg-accent text-accent-foreground">Verified</Badge> : <Badge className="bg-warning text-warning-foreground">Pending Review</Badge>}
                  {article.year ? <Badge variant="secondary">{article.year}</Badge> : null}
                  {article.country ? <Badge variant="secondary">{article.country}</Badge> : null}
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-foreground md:text-3xl">{articleTitle}</h1>
                  <p className="text-base text-muted-foreground">{citationLabel}</p>
                  <div className="mt-4 space-y-3">
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Primary question</p>
                      {primaryQuestion ? (
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="max-w-full whitespace-normal break-words">
                            {primaryQuestion}
                          </Badge>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Not set</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Research Questions</p>
                      {researchQuestions.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {researchQuestions.map((question) => (
                            <Badge key={question} variant="outline" className="max-w-full whitespace-normal break-words">
                              {question}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Not set</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky top-2 z-20 mt-5 -mx-1 rounded-lg border border-border/60 bg-background/90 px-2 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={editorOpen ? "outline" : "default"}
                  size="sm"
                  className={editorOpen ? "border-primary/40 text-primary hover:bg-primary/10 hover:text-primary focus-visible:text-primary" : ""}
                  onClick={() => {
                    if (editorOpen) requestCloseEditor();
                    else {
                      setLeftPanePercent(58);
                      setEditorOpen(true);
                    }
                  }}
                >
                  {editorOpen ? <PanelRightClose className="mr-1 h-4 w-4" /> : <PanelRightOpen className="mr-1 h-4 w-4" />}
                  {editorOpen ? "Close review panel" : "Open review panel"}
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/articles/${article.id}/edit`}>
                    <Pencil className="mr-1 h-4 w-4" /> Edit Full Form
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPdfModalOpen(true)}
                  disabled={!pdfAccessUrl}
                >
                  <FileText className="mr-1 h-4 w-4" /> View PDF
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-12">
              <Card className="border-border/70 bg-background/70 lg:col-span-8">
                <CardContent className="space-y-3 py-4">
                  <div className="flex items-center justify-between">
                    <p className="text-base font-medium">Review Verification</p>
                    <Badge variant="outline">{verificationProgress}/4 complete</Badge>
                  </div>
                  <VerificationToggles
                    values={articleVerification}
                    onToggle={handleVerificationToggle}
                  />
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-background/70 lg:col-span-4">
                <CardContent className="space-y-3 py-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Review Session</p>
                    <Badge variant="outline" className={reviewSessionBadgeTone}>{reviewSessionState}</Badge>
                  </div>
                  <div className="rounded-md border border-border/70 bg-card px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">QA Score</p>
                    <p className={`text-2xl font-semibold ${qaTone}`}>{qaScore} / 10</p>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Verification progress</span>
                    <span className="font-medium text-foreground">{verificationProgress}/4</span>
                  </div>
                  {savedAgo ? (
                    <div className={`inline-flex items-center gap-1 text-xs ${reviewSessionTone}`}>
                      <Clock3 className="h-3 w-3" />
                      Saved {savedAgo}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <Tabs value={detailsTab} onValueChange={(value) => setDetailsTab(value as "overview" | "qa")} className="space-y-3">
              <TabsList className="grid h-auto w-full grid-cols-2 bg-muted/70 p-1">
                <TabsTrigger value="overview" className="py-2">Overview</TabsTrigger>
                <TabsTrigger value="qa" className="py-2">QA</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-3">
                <DetailRow label="DOI" value={article.doi} link={article.doi ? `https://doi.org/${article.doi}` : undefined} />
                <DetailRow label="Authors" value={article.author} />
                <DetailRow label="First Author" value={article.first_author} />
                <DetailRow label="Last Author" value={article.last_author} />
                <DetailRow label="Universities" value={article.universities} />
                <DetailRow label="Publication Type" value={article.publication_type} />
                <DetailRow label="Study Design" value={article.study_design} />
                <DetailRow label="Publication Place" value={article.publication_place} />
                <ExpandableRow label="Abstract" value={article.abstract} />
              </TabsContent>

              <TabsContent value="qa" className="space-y-2">
                {QA_QUESTIONS.map((question) => (
                  <div key={question.key} className="rounded-md border border-border/60 bg-background/60 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">{question.label}</span>
                      <Badge variant="outline">{formatQaAnswer(qaAnswers[question.key])}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{question.description}</p>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </section>

          <Accordion type="multiple" value={openSections} onValueChange={setOpenSections} className="rounded-xl border border-border/70 bg-card px-4 shadow-sm">
            <AccordionItem value="technical">
              <AccordionTrigger className="text-base font-semibold">Technical</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <DetailRow label="Prosthesis" value={article.prosthesis_name} />
                  <DetailRow label="Level" value={article.prosthesis_level} />
                  <DetailRow label="DOF" value={article.dof} />
                  <TagRow label="Control Strategy" values={article.control_strategy} />
                  <TagRow label="Sensors" values={article.sensors} />
                  <TagRow label="Feedback" values={article.feedback_modalities} />
                  <DetailRow label="Manufacturing" value={article.manufacturing_method} />
                  <DetailRow label="Growth Accommodation" value={article.growth_accommodation} />
                  <ExpandableRow label="Technical Innovation" value={article.technical_innovation} />
                  <ExpandableRow label="Challenges & Solutions" value={article.technical_challenges} />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="outcomes">
              <AccordionTrigger className="text-base font-semibold">Outcomes</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <DetailRow label="Pediatric Participants" value={article.has_pediatric_participants} />
                  <DetailRow label="Sample Size" value={article.sample_size?.toString()} />
                  <DetailRow label="Age Range" value={article.age_range} />
                  <TagRow label="Amputation Cause" values={article.amputation_cause} />
                  <TagRow label="Amputation Level" values={article.amputation_level} />
                  <TagRow label="Setting" values={article.setting || []} />
                  <TagRow label="Functional Tests" values={article.functional_tests} />
                  <DetailRow label="Inferential Tests" value={article.statistical_tests_performed} />
                  <ExpandableRow label="Statistical Tests Specified" value={article.statistical_tests_specified} />
                  <ExpandableRow label="Quantitative Results" value={article.quantitative_results} />
                  <ExpandableRow label="Usage Outcomes" value={article.usage_outcomes} />
                  <ExpandableRow label="Main Gaps" value={article.gaps} />
                  <DetailRow label="Primary Research Question" value={article.primary_research_question} />
                  <TagRow label="All Research Questions" values={article.research_questions} />
                </div>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
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
              <ArticleReviewEditorPanel
                article={article}
                onSaved={() => {
                  setLastSavedAt(Date.now());
                  setEditorDirty(false);
                  invalidate();
                }}
                onDirtyChange={setEditorDirty}
                onQaScorePreviewChange={setQaPreviewScore}
              />
            </div>
          </aside>
        ) : null}
      </div>

      <Dialog
        open={pdfModalOpen}
        onOpenChange={(open) => {
          setPdfModalOpen(open);
          if (open) {
            setShowChat(false);
            setPdfChatWidth(360);
          } else {
            setIsDraggingPdfSplit(false);
          }
        }}
      >
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
              ref={pdfSplitContainerRef}
              className="grid gap-3 bg-muted/25 p-3 sm:p-4"
              style={showChat ? { gridTemplateColumns: `minmax(0,1fr) 12px ${pdfChatWidth}px` } : { gridTemplateColumns: "minmax(0,1fr)" }}
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
                      {article.pdf_url ? (
                        <div className="min-h-0 flex-1 overflow-y-auto p-2">
                          <PdfChatPanel articleId={article.id} articleTitle={articleTitle} />
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
              <ArticleReviewEditorPanel
                article={article}
                onSaved={() => {
                  setLastSavedAt(Date.now());
                  setEditorDirty(false);
                  invalidate();
                }}
                onDirtyChange={setEditorDirty}
                onQaScorePreviewChange={setQaPreviewScore}
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
};

function DetailRow({ label, value, link }: { label: string; value?: string | null; link?: string }) {
  if (!value) return null;
  return (
    <div className="grid gap-1 text-sm md:grid-cols-[240px_minmax(0,1fr)] md:gap-3">
      <span className="pt-0.5 font-medium text-muted-foreground">{label}</span>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-primary underline hover:text-primary/80">
          {value}
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <span className="whitespace-pre-wrap text-foreground">{value}</span>
      )}
    </div>
  );
}

function ExpandableRow({ label, value }: { label: string; value?: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!value) return null;
  const shortValue = value.length > 280 ? `${value.slice(0, 280)}...` : value;
  const shouldCollapse = value.length > 280;
  return (
    <div className="grid gap-1 text-sm md:grid-cols-[240px_minmax(0,1fr)] md:gap-3">
      <span className="pt-0.5 font-medium text-muted-foreground">{label}</span>
      <div>
        <p className="whitespace-pre-wrap text-foreground">{expanded || !shouldCollapse ? value : shortValue}</p>
        {shouldCollapse ? (
          <Button variant="link" size="sm" className="h-auto px-0 text-sm" onClick={() => setExpanded((prev) => !prev)}>
            {expanded ? "Show less" : "Show more"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function TagRow({ label, values }: { label: string; values?: string[] | null }) {
  if (!values || values.length === 0) return null;
  return (
    <div className="grid gap-1 text-sm md:grid-cols-[240px_minmax(0,1fr)] md:gap-3">
      <span className="pt-0.5 font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1">
        {values.map((item) => (
          <Badge key={`${label}-${item}`} variant="secondary" className="text-[11px]">{item}</Badge>
        ))}
      </div>
    </div>
  );
}

function formatQaAnswer(answer: string | null | undefined) {
  if (answer === "Yes") return "Yes (1)";
  if (answer === "Partial") return "Partial (0.5)";
  if (answer === "No") return "No (0)";
  return "Not set";
}

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
