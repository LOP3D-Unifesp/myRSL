import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createArticle, updateArticle, fetchArticle, type ArticleInsert } from "@/lib/articles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Save, ArrowLeft, ChevronLeft, ChevronRight, Upload, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadPdfBlob } from "@/lib/pdf-storage";
import { sanitizeExtractedArticle } from "@/lib/article-schemas";
import {
  STUDY_DESIGNS, PUBLICATION_TYPES, AMPUTATION_CAUSES,
  AMPUTATION_LEVELS, CONTROL_STRATEGIES, SENSORS,
  FUNCTIONAL_TESTS, SETTINGS, PROSTHESIS_LEVELS,
  FEEDBACK_MODALITIES, GROWTH_ACCOMMODATIONS, RESEARCH_QUESTIONS,
  ALL_RESEARCH_QUESTIONS, STATISTICAL_TESTS_PERFORMED, HAS_PEDIATRIC_PARTICIPANTS,
} from "@/lib/constants";

type FormData = Partial<ArticleInsert>;
type ExtractFunctionError = { message?: string; context?: Response };

const STEPS = [
  "1. General Information",
  "2. Publication & Study",
  "3. Pediatric Implementation",
  "4. Technical Specifications",
  "5. Testing, Outcomes & Stats",
  "6. Research Scope",
];

const ArticleForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [reExtracting, setReExtracting] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [form, setForm] = useState<FormData>({
    is_draft: true,
    amputation_cause: [],
    amputation_level: [],
    control_strategy: [],
    sensors: [],
    functional_tests: [],
    feedback_modalities: [],
    research_questions: [],
    setting: [],
  });

  const { data: existing } = useQuery({
    queryKey: ["article", id],
    queryFn: () => fetchArticle(id!),
    enabled: isEditing,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        ...existing,
        first_author: existing.first_author ?? existing.author,
      });
    }
  }, [existing]);

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => setForm((f) => ({ ...f, [key]: value }));

  const toggleArray = (key: keyof FormData, value: string) => {
    const arr = (form[key] as string[]) || [];
    set(key, arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  const uploadPdfToStorage = async (file: File): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const filePath = `${user.id}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("research-pdfs").upload(filePath, file, { upsert: false });
    if (error) { console.error("Upload error:", error); return null; }
    return filePath;
  };

  const getExtractPdfErrorMessage = async (error: unknown) => {
    const extractError = error as ExtractFunctionError;
    const fallback = extractError?.message || "Error extracting PDF";
    const response = extractError?.context;
    if (!(response instanceof Response)) return fallback;
    const status = response.status;
    let payload: { error?: string } | null = null;
    try { payload = await response.clone().json(); } catch { payload = null; }
    if (status === 402) return payload?.error || "AI credits exhausted. Please add credits in Settings and try again.";
    return payload?.error || fallback;
  };

  const handleSubmit = async (draft: boolean) => {
    setSaving(true);
    try {
      let pdfUrl = form.pdf_url;
      if (pdfFile) {
        const url = await uploadPdfToStorage(pdfFile);
        if (url) pdfUrl = url;
      }
      const payload: Partial<ArticleInsert> = {
        ...form,
        is_draft: draft,
        pdf_url: pdfUrl,
        first_author: form.first_author ?? form.author ?? null,
        author: form.first_author ?? form.author ?? null,
      };
      if (isEditing) {
        await updateArticle(id!, payload);
        toast.success("Article updated!");
      } else {
        await createArticle(payload);
        toast.success("Article saved!");
      }
      navigate("/articles");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error saving article";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file");
      return;
    }
    setPdfFile(file);
    setExtracting(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(",")[1];
        const { data, error } = await supabase.functions.invoke("extract-pdf", {
          body: { pdfBase64: base64, fileName: file.name, fileType: file.type },
        });
        if (error) {
          const message = await getExtractPdfErrorMessage(error);
          throw new Error(message);
        }
        if (data?.extracted) {
          const sanitizedExtracted = sanitizeExtractedArticle(data.extracted);
          setForm((prev) => ({
            ...prev,
            ...sanitizedExtracted,
            first_author: sanitizedExtracted.first_author ?? sanitizedExtracted.author ?? prev.first_author ?? prev.author,
            author: sanitizedExtracted.first_author ?? sanitizedExtracted.author ?? prev.author ?? prev.first_author,
          }));
          toast.success("PDF data extracted! Please review and edit before saving.");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error extracting PDF";
        toast.error(message);
      } finally {
        setExtracting(false);
      }
    };
    reader.onerror = () => { toast.error("Could not read the PDF file"); setExtracting(false); };
    reader.readAsDataURL(file);
  };

  const handleSelectiveReExtraction = async () => {
    if (!form.pdf_url && !pdfFile) {
      toast.error("No PDF available for re-extraction. Upload a PDF first.");
      return;
    }
    setReExtracting(true);
    try {
      let base64: string;
      if (pdfFile) {
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(pdfFile);
        });
      } else {
        const blob = await downloadPdfBlob(form.pdf_url!);
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      const { data, error } = await supabase.functions.invoke("extract-pdf", {
        body: { pdfBase64: base64, fileName: form.title || "article.pdf", fileType: "application/pdf", mode: "stats_q6_only" },
      });
      if (error) {
        const message = await getExtractPdfErrorMessage(error);
        throw new Error(message);
      }
      if (data?.extracted) {
        // Only update Stats & Q6 fields, preserve everything else
        const selective = sanitizeExtractedArticle(data.extracted);
        setForm((prev) => ({
          ...prev,
          ...(selective.statistical_tests_performed !== undefined && { statistical_tests_performed: selective.statistical_tests_performed }),
          ...(selective.statistical_tests_specified !== undefined && { statistical_tests_specified: selective.statistical_tests_specified }),
          ...(selective.quantitative_results !== undefined && { quantitative_results: selective.quantitative_results }),
          ...(selective.primary_research_question !== undefined && { primary_research_question: selective.primary_research_question }),
          ...(selective.research_questions !== undefined && { research_questions: selective.research_questions }),
          ...(selective.technical_challenges !== undefined && { technical_challenges: selective.technical_challenges }),
        }));
        toast.success("Stats & Q6 fields updated from PDF! Review and save.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Re-extraction failed";
      toast.error(message);
    } finally {
      setReExtracting(false);
    }
  };

  const hasParticipants = form.has_pediatric_participants === "Yes";
  const noParticipants = form.has_pediatric_participants === "No";

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold font-serif text-foreground">
            {isEditing ? "Edit Article" : "New Article"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </p>
        </div>
        <div className="flex gap-2">
          {isEditing && (form.pdf_url || pdfFile) && (
            <Button variant="outline" onClick={handleSelectiveReExtraction} disabled={reExtracting}>
              {reExtracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {reExtracting ? "Re-extracting…" : "Update Stats & Q6 only"}
            </Button>
          )}
          <label className="cursor-pointer">
            <input type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} disabled={extracting} />
            <Button variant="outline" asChild disabled={extracting}>
              <span>
                {extracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {extracting ? "Extracting…" : "Upload PDF"}
              </span>
            </Button>
          </label>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1 mb-6">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(i)}
            className={`flex-1 h-2 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>

      <div className="space-y-6">
        {step === 0 && (
          <Card>
            <CardHeader><CardTitle className="text-lg font-serif">Section 1: General Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Article Title" value={form.title} onChange={(v) => set("title", v)} placeholder="Full title of the research paper" />
              <div className="space-y-2">
                <Label>Abstract</Label>
                <Textarea value={form.abstract ?? ""} onChange={(e) => set("abstract", e.target.value)} rows={6} placeholder="Full abstract of the paper" />
              </div>
              {pdfFile && <p className="text-sm text-muted-foreground">📎 PDF attached: {pdfFile.name}</p>}
              {!pdfFile && form.pdf_url && <p className="text-sm text-muted-foreground">📎 PDF already uploaded</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Study ID / Reference" value={form.study_id} onChange={(v) => set("study_id", v)} />
                <Field
                  label="First Author"
                  value={form.first_author ?? form.author}
                  onChange={(v) => {
                    set("first_author", v);
                    set("author", v);
                  }}
                />
                <Field label="Last Author" value={form.last_author} onChange={(v) => set("last_author", v)} />
                <Field label="Universities or Research Centers" value={form.universities} onChange={(v) => set("universities", v)} />
                <Field label="Country" value={form.country} onChange={(v) => set("country", v)} />
                <div className="space-y-2">
                  <Label>Year of Publication</Label>
                  <Input type="number" value={form.year ?? ""} onChange={(e) => set("year", e.target.value ? Number(e.target.value) : null)} />
                </div>
                <Field label="Place of Publication (journal or conference)" value={form.publication_place} onChange={(v) => set("publication_place", v)} />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardHeader><CardTitle className="text-lg font-serif">Section 2: Publication & Study Characteristics</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <RadioField label="Publication Type" value={form.publication_type} options={PUBLICATION_TYPES} onChange={(v) => set("publication_type", v)} />
              <RadioField label="Study Design" value={form.study_design} options={STUDY_DESIGNS} onChange={(v) => set("study_design", v)} />
              {form.study_design === "Other" && (
                <Field label="Specify Study Design" value={form.q1} onChange={(v) => set("q1", v)} placeholder="Specify…" />
              )}
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader><CardTitle className="text-lg font-serif">Section 3: Pediatric Implementation</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <RadioField
                label="Did the study involve human pediatric participants?"
                value={form.has_pediatric_participants}
                options={HAS_PEDIATRIC_PARTICIPANTS}
                onChange={(v) => set("has_pediatric_participants", v)}
              />
              {hasParticipants && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Number of Pediatric Participants</Label>
                      <Input type="number" value={form.sample_size ?? ""} onChange={(e) => set("sample_size", e.target.value ? Number(e.target.value) : null)} />
                    </div>
                    <Field label="Age Range (years)" value={form.age_range} onChange={(v) => set("age_range", v)} placeholder='e.g., "5–12"' />
                  </div>
                  <MultiCheck label="Cause of Limb Absence" options={AMPUTATION_CAUSES} selected={form.amputation_cause || []} onToggle={(v) => toggleArray("amputation_cause", v)} />
                  <MultiCheck label="Level of Limb Absence" options={AMPUTATION_LEVELS} selected={form.amputation_level || []} onToggle={(v) => toggleArray("amputation_level", v)} />
                </>
              )}
              {(hasParticipants || noParticipants) && (
                <div className="space-y-2">
                  <Label>Specific Pediatric Approach</Label>
                  <Textarea
                    placeholder="Describe how weak EMG signals, reduced weight, growth, or aesthetics were addressed for children."
                    value={form.pediatric_approach ?? ""}
                    onChange={(e) => set("pediatric_approach", e.target.value)}
                    rows={5}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-serif">Section 4: Technical Specifications</CardTitle>
              <p className="text-sm text-muted-foreground">Use "Not Reported" if omitted, "Not Applicable" if the feature doesn't apply.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Prosthesis Name / Model" value={form.prosthesis_name} onChange={(v) => set("prosthesis_name", v)} placeholder='Write "Not Reported" if unnamed' />
                <RadioField label="Prosthesis Level" value={form.prosthesis_level} options={PROSTHESIS_LEVELS} onChange={(v) => set("prosthesis_level", v)} />
              </div>
              <Field label="Degrees of Freedom / Main Functions" value={form.dof} onChange={(v) => set("dof", v)} placeholder='e.g., "1 DOF – open/close; 3 grasp patterns"' />
              <MultiCheck label="Control Strategy" options={CONTROL_STRATEGIES} selected={form.control_strategy || []} onToggle={(v) => toggleArray("control_strategy", v)} />
              <MultiCheck label="Sensors Used" options={SENSORS} selected={form.sensors || []} onToggle={(v) => toggleArray("sensors", v)} />
              <MultiCheck label="Feedback Modalities" options={FEEDBACK_MODALITIES} selected={form.feedback_modalities || []} onToggle={(v) => toggleArray("feedback_modalities", v)} />
              <Field label="Manufacturing Method" value={form.manufacturing_method} onChange={(v) => set("manufacturing_method", v)} placeholder='Write "Not Reported" if omitted' />
              <RadioField label="Growth Accommodation / Adjustability" value={form.growth_accommodation} options={GROWTH_ACCOMMODATIONS} onChange={(v) => set("growth_accommodation", v)} />
              <div className="space-y-2">
                <Label>Technical Innovation Identified</Label>
                <Textarea value={form.technical_innovation ?? ""} onChange={(e) => set("technical_innovation", e.target.value)} rows={3} placeholder='What is the "differentiating factor" of this solution?' />
              </div>
              <div className="space-y-2">
                <Label>Technical Challenges & Solutions</Label>
                <Textarea value={form.technical_challenges ?? ""} onChange={(e) => set("technical_challenges", e.target.value)} rows={3} placeholder='E.g., Challenge: High impedance -> Solution: Used variable resistors to balance electrode impedances' />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader><CardTitle className="text-lg font-serif">Section 5: Testing, Outcomes & Statistical Analysis</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <MultiCheck label="Setting of Use / Testing" options={SETTINGS} selected={form.setting as string[] || []} onToggle={(v) => toggleArray("setting", v)} />
              <MultiCheck label="Standardized Functional Tests Used" options={FUNCTIONAL_TESTS} selected={form.functional_tests || []} onToggle={(v) => toggleArray("functional_tests", v)} />
              <RadioField label="Were INFERENTIAL Statistical Tests Performed?" value={form.statistical_tests_performed} options={STATISTICAL_TESTS_PERFORMED} onChange={(v) => set("statistical_tests_performed", v)} />
              <Field label="Specify INFERENTIAL Statistical Tests Used" value={form.statistical_tests_specified} onChange={(v) => set("statistical_tests_specified", v)} placeholder='e.g., "ANOVA, Paired t-test". Write "N/A" if none' />
              <div className="space-y-2">
                <Label>Quantitative Results (Technical & Functional)</Label>
                <Textarea value={form.quantitative_results ?? ""} onChange={(e) => set("quantitative_results", e.target.value)} rows={3} placeholder='E.g., "BBT improved from 5 to 12 blocks/min"' />
              </div>
              <div className="space-y-2">
                <Label>Usage Outcomes</Label>
                <Textarea value={form.usage_outcomes ?? ""} onChange={(e) => set("usage_outcomes", e.target.value)} rows={3} placeholder="Describe user acceptance, dropout rate, caregiver comfort or feedback." />
              </div>
              <Field label="Main Gaps Identified by Authors" value={form.gaps} onChange={(v) => set("gaps", v)} />
            </CardContent>
          </Card>
        )}

        {step === 5 && (
          <Card>
            <CardHeader><CardTitle className="text-lg font-serif">Section 6: Research Scope</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <RadioField label="A. PRIMARY Research Question Addressed (Select ONE)" value={form.primary_research_question} options={RESEARCH_QUESTIONS} onChange={(v) => set("primary_research_question", v)} />
              <MultiCheck label="B. ALL Applicable Research Questions (Select MANY)" options={ALL_RESEARCH_QUESTIONS} selected={form.research_questions || []} onToggle={(v) => toggleArray("research_questions", v)} />
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pb-8">
          <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          <div className="flex gap-3">
            {step === STEPS.length - 1 ? (
              <>
                <Button onClick={() => handleSubmit(true)} variant="outline" disabled={saving}>
                  <Save className="mr-2 h-4 w-4" /> Save as Draft
                </Button>
                <Button onClick={() => handleSubmit(false)} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" /> Save Final
                </Button>
              </>
            ) : (
              <Button onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))}>
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper components
function Field({ label, value, onChange, placeholder }: { label: string; value?: string | null; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function RadioField({ label, value, options, onChange }: { label: string; value?: string | null; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      <RadioGroup value={value ?? ""} onValueChange={onChange}>
        {options.map((o) => (
          <div key={o} className="flex items-center gap-2">
            <RadioGroupItem value={o} id={`radio-${label}-${o}`} />
            <Label htmlFor={`radio-${label}-${o}`} className="font-normal cursor-pointer">{o}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

function MultiCheck({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-3">
        {options.map((o) => (
          <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={selected.includes(o)} onCheckedChange={() => onToggle(o)} />
            {o}
          </label>
        ))}
      </div>
    </div>
  );
}

export default ArticleForm;
