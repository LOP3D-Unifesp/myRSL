import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchArticle, updateArticle, type ArticleInsert } from "@/lib/articles";
import { formatCompactAuthors } from "@/lib/article-authors";
import { QA_QUESTIONS, calculateQAScore, type QAKey } from "@/lib/qa-questions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft, Download, ExternalLink, FileText, MessageCircle, Pencil, Save } from "lucide-react";
import VerificationToggles from "@/components/article/VerificationToggles";
import PdfChatPanel from "@/components/PdfChatPanel";
import PageState from "@/components/layout/PageState";
import { getPdfAccessUrl } from "@/lib/pdf-storage";
import { toast } from "sonner";

type VerificationKey = "verify_peer1" | "verify_peer2" | "verify_qa3" | "verify_qa4";

type QuickEditForm = {
  doi: string;
  study_id: string;
  title: string;
  country: string;
  year: string;
  author: string;
};

const ArticleDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [showChat, setShowChat] = useState(false);
  const [pdfAccessUrl, setPdfAccessUrl] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);
  const [qaSaving, setQaSaving] = useState(false);
  const [quickForm, setQuickForm] = useState<QuickEditForm>({ doi: "", study_id: "", title: "", country: "", year: "", author: "" });
  const [qaAnswers, setQaAnswers] = useState<Record<QAKey, string | null>>({} as Record<QAKey, string | null>);

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
    if (!article) return;
    setQuickForm({
      doi: article.doi ?? "",
      study_id: article.study_id ?? "",
      title: article.title ?? "",
      country: article.country ?? "",
      year: article.year != null ? String(article.year) : "",
      author: article.author ?? "",
    });

    const initial = {} as Record<QAKey, string | null>;
    for (const question of QA_QUESTIONS) {
      initial[question.key] = article[question.key];
    }
    setQaAnswers(initial);
  }, [article]);

  const handleVerificationToggle = async (key: VerificationKey) => {
    if (!article) return;
    try {
      const payload = { [key]: !article[key] } as Pick<ArticleInsert, VerificationKey>;
      await updateArticle(article.id, payload);
      invalidate();
      toast.success(`${key.replace("verify_", "").replace("_", " ").toUpperCase()} ${article[key] ? "reverted" : "verified"}.`);
    } catch {
      toast.error("Failed to update verification.");
    }
  };

  const handleQuickSave = async () => {
    if (!article) return;
    setQuickSaving(true);
    try {
      const parsedYear = quickForm.year.trim() ? Number(quickForm.year) : null;
      await updateArticle(article.id, {
        doi: quickForm.doi.trim() || null,
        study_id: quickForm.study_id.trim() || null,
        title: quickForm.title.trim() || null,
        country: quickForm.country.trim() || null,
        author: quickForm.author.trim() || null,
        first_author: quickForm.author.trim() ? quickForm.author.split(";").map((item) => item.trim()).find(Boolean) ?? null : null,
        year: Number.isFinite(parsedYear) ? parsedYear : null,
      });
      invalidate();
      setQuickEditOpen(false);
      toast.success("Article updated.");
    } catch {
      toast.error("Failed to save quick edit.");
    } finally {
      setQuickSaving(false);
    }
  };

  const handleSaveQA = async () => {
    if (!article) return;
    setQaSaving(true);
    try {
      const score = calculateQAScore(qaAnswers);
      await updateArticle(article.id, { ...qaAnswers, qa_score: score });
      invalidate();
      toast.success("QA saved.");
    } catch {
      toast.error("Failed to save QA.");
    } finally {
      setQaSaving(false);
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

  if (isLoading) {
    return <PageState title="Loading article..." description="Fetching article data and references." />;
  }

  if (!article) {
    return <PageState title="Article not found" description="It may have been removed or you may not have access." />;
  }

  const isFullyVerified = Boolean(article.verify_peer1 && article.verify_peer2 && article.verify_qa3 && article.verify_qa4);
  const verificationProgress = [article.verify_peer1, article.verify_peer2, article.verify_qa3, article.verify_qa4].filter(Boolean).length;
  const qaScore = calculateQAScore(qaAnswers);
  const qaTone = qaScore >= 7 ? "text-accent" : qaScore >= 4 ? "text-warning" : "text-destructive";
  const authorLabel = formatCompactAuthors(article.author, article.first_author);

  return (
    <div className="page-container max-w-6xl">
      <Button variant="ghost" size="sm" onClick={handleBack} className="-ml-2" aria-label="Go back">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back
      </Button>

      <div className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{article.study_id || "No Study ID"}</Badge>
              {article.year ? <Badge variant="secondary">{article.year}</Badge> : null}
              {article.is_draft ? <Badge variant="outline">Draft</Badge> : null}
              {isFullyVerified ? <Badge className="bg-accent text-accent-foreground">Verified</Badge> : <Badge className="bg-warning text-warning-foreground">Pending Review</Badge>}
              {article.country ? <Badge variant="secondary">{article.country}</Badge> : null}
            </div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">{article.title || "Untitled article"}</h1>
            <p className="text-base text-muted-foreground">{authorLabel}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="default" size="sm" onClick={() => setQuickEditOpen(true)}>
              <Pencil className="mr-1 h-4 w-4" /> Quick Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOpenSections((prev) => (prev.includes("pdf-chat") ? prev : [...prev, "pdf-chat"]));
              }}
              disabled={!pdfAccessUrl}
            >
              <FileText className="mr-1 h-4 w-4" /> View PDF
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/articles/${article.id}/edit`}>Edit Full Form</Link>
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <Card className="border-border/70 bg-background/70">
            <CardContent className="space-y-3 py-4">
              <div className="flex items-center justify-between">
                <p className="text-base font-medium">Review Verification</p>
                <Badge variant="outline">{verificationProgress}/4 complete</Badge>
              </div>
              <VerificationToggles
                values={{
                  verify_peer1: article.verify_peer1,
                  verify_peer2: article.verify_peer2,
                  verify_qa3: article.verify_qa3,
                  verify_qa4: article.verify_qa4,
                }}
                onToggle={handleVerificationToggle}
              />
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/70">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-medium">Quality Assessment</p>
                <p className={`text-xl font-semibold ${qaTone}`}>{qaScore} / 10</p>
              </div>
              <Button size="sm" onClick={handleSaveQA} disabled={qaSaving}>
                <Save className="mr-1 h-4 w-4" /> {qaSaving ? "Saving..." : "Save QA"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <section className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
        <h2 className="text-base font-semibold">Overview</h2>
        <div className="mt-3 space-y-3">
          <DetailRow label="DOI" value={article.doi} link={article.doi ? `https://doi.org/${article.doi}` : undefined} />
          <DetailRow label="Authors" value={article.author} />
          <DetailRow label="First Author" value={article.first_author} />
          <DetailRow label="Last Author" value={article.last_author} />
          <DetailRow label="Universities" value={article.universities} />
          <DetailRow label="Publication Type" value={article.publication_type} />
          <DetailRow label="Study Design" value={article.study_design} />
          <DetailRow label="Publication Place" value={article.publication_place} />
          <ExpandableRow label="Abstract" value={article.abstract} />
        </div>
      </section>

      <Accordion type="multiple" value={openSections} onValueChange={setOpenSections} className="rounded-xl border border-border/70 bg-card/80 px-4 shadow-sm">

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

        <AccordionItem value="qa">
          <AccordionTrigger className="text-base font-semibold">QA</AccordionTrigger>
          <AccordionContent className="space-y-3">
            {QA_QUESTIONS.map((question) => (
              <Card key={question.key} className="border-border/70 bg-background/60">
                <CardContent className="space-y-2 py-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{question.label}</p>
                    <p className="text-sm text-muted-foreground">{question.description}</p>
                  </div>
                  <RadioGroup
                    value={qaAnswers[question.key] ?? ""}
                    onValueChange={(value) => setQaAnswers((prev) => ({ ...prev, [question.key]: value }))}
                    className="flex flex-wrap gap-5"
                  >
                    {["Yes", "Partial", "No"].map((option) => (
                      <label key={option} className="flex cursor-pointer items-center gap-2 text-sm">
                        <RadioGroupItem value={option} id={`${question.key}-${option}`} />
                        <span>{option} {option === "Yes" ? "(1)" : option === "Partial" ? "(0.5)" : "(0)"}</span>
                      </label>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>
            ))}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="pdf-chat">
          <AccordionTrigger className="text-base font-semibold">PDF & Chat</AccordionTrigger>
          <AccordionContent>
            {!pdfAccessUrl ? (
              <p className="text-sm text-muted-foreground">No PDF available for this article yet.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
                    <Download className="mr-1 h-4 w-4" /> Download PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowChat((prev) => !prev)}>
                    <MessageCircle className="mr-1 h-4 w-4" /> {showChat ? "Hide Chat" : "Open Chat"}
                  </Button>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <iframe src={pdfAccessUrl} className="h-[420px] w-full rounded-lg border" title="PDF Viewer" />
                  <div className="min-h-[420px] rounded-lg border bg-background/50 p-2">
                    {showChat && article.pdf_url ? (
                      <PdfChatPanel articleId={article.id} articleTitle={article.title || article.author || "this paper"} />
                    ) : (
                      <p className="text-sm text-muted-foreground">Open chat to discuss this PDF.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Sheet open={quickEditOpen} onOpenChange={setQuickEditOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Quick Edit</SheetTitle>
            <SheetDescription>Update key metadata without opening the full form.</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <Field label="DOI" value={quickForm.doi} onChange={(value) => setQuickForm((prev) => ({ ...prev, doi: value }))} placeholder="10.xxxx/xxxxx" />
            <Field label="Study ID" value={quickForm.study_id} onChange={(value) => setQuickForm((prev) => ({ ...prev, study_id: value }))} />
            <Field label="Title" value={quickForm.title} onChange={(value) => setQuickForm((prev) => ({ ...prev, title: value }))} />
            <Field label="Country" value={quickForm.country} onChange={(value) => setQuickForm((prev) => ({ ...prev, country: value }))} />
            <Field label="Year" value={quickForm.year} onChange={(value) => setQuickForm((prev) => ({ ...prev, year: value }))} />
            <div className="space-y-2">
              <Label>Authors (separated by ;)</Label>
              <Textarea
                value={quickForm.author}
                onChange={(event) => setQuickForm((prev) => ({ ...prev, author: event.target.value }))}
                rows={4}
                placeholder="Author A; Author B; Author C"
              />
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setQuickEditOpen(false)} disabled={quickSaving}>Cancel</Button>
            <Button onClick={handleQuickSave} disabled={quickSaving}>{quickSaving ? "Saving..." : "Save Changes"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
};

function DetailRow({ label, value, link }: { label: string; value?: string | null; link?: string }) {
  if (!value) return null;
  return (
    <div className="grid gap-1 text-base md:grid-cols-[220px_minmax(0,1fr)] md:gap-3">
      <span className="font-medium text-muted-foreground">{label}</span>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline hover:text-primary/80">
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
    <div className="grid gap-1 text-base md:grid-cols-[220px_minmax(0,1fr)] md:gap-3">
      <span className="font-medium text-muted-foreground">{label}</span>
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
    <div className="grid gap-1 text-base md:grid-cols-[220px_minmax(0,1fr)] md:gap-3">
      <span className="font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1">
        {values.map((item) => (
          <Badge key={`${label}-${item}`} variant="secondary" className="text-[11px]">{item}</Badge>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  );
}

export default ArticleDetail;
