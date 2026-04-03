import { useEffect, useMemo, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { calculateQAScore, QA_QUESTIONS, type QAKey } from "@/lib/qa-questions";
import { updateArticle, type Article, type ArticleInsert } from "@/lib/articles";
import {
  ALL_RESEARCH_QUESTIONS,
  AMPUTATION_CAUSES,
  AMPUTATION_LEVELS,
  CONTROL_STRATEGIES,
  FEEDBACK_MODALITIES,
  FUNCTIONAL_TESTS,
  GROWTH_ACCOMMODATIONS,
  HAS_PEDIATRIC_PARTICIPANTS,
  PROSTHESIS_LEVELS,
  PUBLICATION_TYPES,
  RESEARCH_QUESTIONS,
  SETTINGS,
  SENSORS,
  STATISTICAL_TESTS_PERFORMED,
  STUDY_DESIGNS,
} from "@/lib/constants";
import { toast } from "sonner";

type SectionKey = "general" | "publication" | "pediatric" | "technical" | "testing" | "research" | "qa";
type Props = {
  article: Article;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onQaScorePreviewChange: (score: number) => void;
};

type FormState = {
  doi: string; title: string; abstract: string; study_id: string; author: string; first_author: string; last_author: string; universities: string; country: string; year: string; publication_place: string;
  publication_type: string; study_design: string; q1: string;
  has_pediatric_participants: string; sample_size: string; age_range: string; amputation_cause: string[]; amputation_level: string[]; pediatric_approach: string;
  prosthesis_name: string; prosthesis_level: string; dof: string; control_strategy: string[]; sensors: string[]; feedback_modalities: string[]; manufacturing_method: string; growth_accommodation: string; technical_innovation: string; technical_challenges: string;
  setting: string[]; functional_tests: string[]; statistical_tests_performed: string; statistical_tests_specified: string; quantitative_results: string; usage_outcomes: string; gaps: string;
  primary_research_question: string; research_questions: string[];
};

function deriveFirstAuthor(authors: string) {
  return authors.split(";").map((x) => x.trim()).find(Boolean) ?? null;
}
function sameArray(a: string[], b: string[]) {
  return [...a].sort().join("||") === [...b].sort().join("||");
}
function buildState(a: Article): FormState {
  return {
    doi: a.doi ?? "", title: a.title ?? "", abstract: a.abstract ?? "", study_id: a.study_id ?? "", author: a.author ?? "", first_author: a.first_author ?? "", last_author: a.last_author ?? "", universities: a.universities ?? "", country: a.country ?? "", year: a.year != null ? String(a.year) : "", publication_place: a.publication_place ?? "",
    publication_type: a.publication_type ?? "", study_design: a.study_design ?? "", q1: a.q1 ?? "",
    has_pediatric_participants: a.has_pediatric_participants ?? "", sample_size: a.sample_size != null ? String(a.sample_size) : "", age_range: a.age_range ?? "", amputation_cause: a.amputation_cause ?? [], amputation_level: a.amputation_level ?? [], pediatric_approach: a.pediatric_approach ?? "",
    prosthesis_name: a.prosthesis_name ?? "", prosthesis_level: a.prosthesis_level ?? "", dof: a.dof ?? "", control_strategy: a.control_strategy ?? [], sensors: a.sensors ?? [], feedback_modalities: a.feedback_modalities ?? [], manufacturing_method: a.manufacturing_method ?? "", growth_accommodation: a.growth_accommodation ?? "", technical_innovation: a.technical_innovation ?? "", technical_challenges: a.technical_challenges ?? "",
    setting: a.setting ?? [], functional_tests: a.functional_tests ?? [], statistical_tests_performed: a.statistical_tests_performed ?? "", statistical_tests_specified: a.statistical_tests_specified ?? "", quantitative_results: a.quantitative_results ?? "", usage_outcomes: a.usage_outcomes ?? "", gaps: a.gaps ?? "",
    primary_research_question: a.primary_research_question ?? "", research_questions: a.research_questions ?? [],
  };
}

const SECTION_FIELDS: Record<Exclude<SectionKey, "qa">, Array<keyof FormState>> = {
  general: ["doi", "title", "abstract", "study_id", "author", "first_author", "last_author", "universities", "country", "year", "publication_place"],
  publication: ["publication_type", "study_design", "q1"],
  pediatric: ["has_pediatric_participants", "sample_size", "age_range", "amputation_cause", "amputation_level", "pediatric_approach"],
  technical: ["prosthesis_name", "prosthesis_level", "dof", "control_strategy", "sensors", "feedback_modalities", "manufacturing_method", "growth_accommodation", "technical_innovation", "technical_challenges"],
  testing: ["setting", "functional_tests", "statistical_tests_performed", "statistical_tests_specified", "quantitative_results", "usage_outcomes", "gaps"],
  research: ["primary_research_question", "research_questions"],
};

const ArticleReviewEditorPanel = ({ article, onSaved, onDirtyChange, onQaScorePreviewChange }: Props) => {
  const [saving, setSaving] = useState<SectionKey | null>(null);
  const [form, setForm] = useState<FormState>(buildState(article));
  const [base, setBase] = useState<FormState>(buildState(article));
  const [qa, setQa] = useState<Record<QAKey, string | null>>({} as Record<QAKey, string | null>);
  const [qaBase, setQaBase] = useState<Record<QAKey, string | null>>({} as Record<QAKey, string | null>);

  useEffect(() => {
    const nextForm = buildState(article);
    const nextQa = {} as Record<QAKey, string | null>;
    for (const q of QA_QUESTIONS) nextQa[q.key] = article[q.key];
    setForm(nextForm); setBase(nextForm); setQa(nextQa); setQaBase(nextQa);
  }, [article]);

  const qaScore = useMemo(() => calculateQAScore(qa), [qa]);
  useEffect(() => onQaScorePreviewChange(qaScore), [qaScore, onQaScorePreviewChange]);

  const isFieldDirty = (k: keyof FormState) => Array.isArray(form[k]) ? !sameArray(form[k] as string[], base[k] as string[]) : String(form[k]).trim() !== String(base[k]).trim();
  const sectionDirty = (section: Exclude<SectionKey, "qa">) => SECTION_FIELDS[section].some(isFieldDirty);
  const qaDirty = QA_QUESTIONS.some((q) => (qa[q.key] ?? null) !== (qaBase[q.key] ?? null));
  const anyDirty = sectionDirty("general") || sectionDirty("publication") || sectionDirty("pediatric") || sectionDirty("technical") || sectionDirty("testing") || sectionDirty("research") || qaDirty;
  useEffect(() => onDirtyChange(anyDirty), [anyDirty, onDirtyChange]);

  const discard = (section: SectionKey) => {
    if (section === "qa") return setQa(qaBase);
    const keys = SECTION_FIELDS[section];
    setForm((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = base[k] as never;
      return next;
    });
  };

  const saveSection = async (section: SectionKey) => {
    if (section === "qa") {
      const payload: Partial<ArticleInsert> = {};
      for (const q of QA_QUESTIONS) if ((qa[q.key] ?? null) !== (qaBase[q.key] ?? null)) payload[q.key] = qa[q.key];
      if (Object.keys(payload).length === 0) return;
      payload.qa_score = calculateQAScore(qa);
      setSaving("qa");
      try { await updateArticle(article.id, payload); setQaBase(qa); onSaved(); toast.success("QA saved."); } catch { toast.error("Failed to save QA."); } finally { setSaving(null); }
      return;
    }

    const payload: Partial<ArticleInsert> = {};
    for (const k of SECTION_FIELDS[section]) {
      if (!isFieldDirty(k)) continue;
      if (k === "year" || k === "sample_size") {
        const n = String(form[k]).trim() ? Number(String(form[k]).trim()) : null;
        payload[k] = Number.isFinite(n) ? n : null;
      } else if (Array.isArray(form[k])) {
        payload[k] = form[k] as never;
      } else {
        payload[k] = String(form[k]).trim() || null;
      }
    }
    if (section === "general" && isFieldDirty("author") && !isFieldDirty("first_author")) payload.first_author = form.author.trim() ? deriveFirstAuthor(form.author) : null;
    if (Object.keys(payload).length === 0) return;
    setSaving(section);
    try { await updateArticle(article.id, payload); setBase(form); onSaved(); toast.success("Section saved."); } catch { toast.error("Failed to save section."); } finally { setSaving(null); }
  };

  return (
    <Accordion type="multiple" defaultValue={["qa"]} className="space-y-2">
      <Section
        title="QA Review"
        dirty={qaDirty}
        value="qa"
      >
        {QA_QUESTIONS.map((q) => (
          <div key={q.key} className="rounded-md border border-border/60 bg-background/40 p-3">
            <p className="text-sm font-medium">{q.label}</p>
            <p className="mb-2 text-sm text-muted-foreground">{q.description}</p>
            <RadioGroup value={qa[q.key] ?? ""} onValueChange={(v) => setQa((p) => ({ ...p, [q.key]: v }))} className="flex flex-wrap gap-3">
              {["Yes", "Partial", "No"].map((o) => (
                <label key={o} className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value={o} id={`${q.key}-${o}`} />
                  <span>{o}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
        ))}
        <Actions dirty={qaDirty} saving={saving === "qa"} onDiscard={() => discard("qa")} onSave={() => saveSection("qa")} />
      </Section>

      <Section title="Section 1: General Information" dirty={sectionDirty("general")} value="general">
        <Field label="Article Title" value={form.title} onChange={(v) => setForm((p) => ({ ...p, title: v }))} />
        <TextField label="Abstract" value={form.abstract} onChange={(v) => setForm((p) => ({ ...p, abstract: v }))} rows={4} />
        <Field label="DOI" value={form.doi} onChange={(v) => setForm((p) => ({ ...p, doi: v }))} />
        <Field label="Study ID / Reference" value={form.study_id} onChange={(v) => setForm((p) => ({ ...p, study_id: v }))} />
        <TextField label="Authors (all, separated by ;)" value={form.author} onChange={(v) => setForm((p) => ({ ...p, author: v }))} rows={3} />
        <Field label="First Author" value={form.first_author} onChange={(v) => setForm((p) => ({ ...p, first_author: v }))} />
        <Field label="Last Author" value={form.last_author} onChange={(v) => setForm((p) => ({ ...p, last_author: v }))} />
        <Field label="Universities or Research Centers" value={form.universities} onChange={(v) => setForm((p) => ({ ...p, universities: v }))} />
        <Field label="Country" value={form.country} onChange={(v) => setForm((p) => ({ ...p, country: v }))} />
        <Field label="Year of Publication" value={form.year} onChange={(v) => setForm((p) => ({ ...p, year: v }))} />
        <Field label="Place of Publication (journal or conference)" value={form.publication_place} onChange={(v) => setForm((p) => ({ ...p, publication_place: v }))} />
        <Actions dirty={sectionDirty("general")} saving={saving === "general"} onDiscard={() => discard("general")} onSave={() => saveSection("general")} />
      </Section>

      <Section title="Section 2: Publication and Study Characteristics" dirty={sectionDirty("publication")} value="publication">
        <Radio label="Publication Type" value={form.publication_type} options={PUBLICATION_TYPES} onChange={(v) => setForm((p) => ({ ...p, publication_type: v }))} />
        <Radio label="Study Design" value={form.study_design} options={STUDY_DESIGNS} onChange={(v) => setForm((p) => ({ ...p, study_design: v }))} />
        {form.study_design === "Other" ? <Field label="Specify Study Design" value={form.q1} onChange={(v) => setForm((p) => ({ ...p, q1: v }))} /> : null}
        <Actions dirty={sectionDirty("publication")} saving={saving === "publication"} onDiscard={() => discard("publication")} onSave={() => saveSection("publication")} />
      </Section>

      <Section title="Section 3: Pediatric Implementation" dirty={sectionDirty("pediatric")} value="pediatric">
        <Radio label="Did the study involve human pediatric participants?" value={form.has_pediatric_participants} options={HAS_PEDIATRIC_PARTICIPANTS} onChange={(v) => setForm((p) => ({ ...p, has_pediatric_participants: v }))} />
        <Field label="Number of Pediatric Participants" value={form.sample_size} onChange={(v) => setForm((p) => ({ ...p, sample_size: v }))} />
        <Field label="Age Range (years)" value={form.age_range} onChange={(v) => setForm((p) => ({ ...p, age_range: v }))} />
        <Multi label="Cause of Limb Absence" options={AMPUTATION_CAUSES} selected={form.amputation_cause} onToggle={(v) => setForm((p) => ({ ...p, amputation_cause: toggleArrayValue(p.amputation_cause, v) }))} />
        <Multi label="Level of Limb Absence" options={AMPUTATION_LEVELS} selected={form.amputation_level} onToggle={(v) => setForm((p) => ({ ...p, amputation_level: toggleArrayValue(p.amputation_level, v) }))} />
        <TextField label="Specific Pediatric Approach" value={form.pediatric_approach} rows={3} onChange={(v) => setForm((p) => ({ ...p, pediatric_approach: v }))} />
        <Actions dirty={sectionDirty("pediatric")} saving={saving === "pediatric"} onDiscard={() => discard("pediatric")} onSave={() => saveSection("pediatric")} />
      </Section>

      <Section title="Section 4: Technical Specifications" dirty={sectionDirty("technical")} value="technical">
        <Field label="Prosthesis Name / Model" value={form.prosthesis_name} onChange={(v) => setForm((p) => ({ ...p, prosthesis_name: v }))} />
        <Radio label="Prosthesis Level" value={form.prosthesis_level} options={PROSTHESIS_LEVELS} onChange={(v) => setForm((p) => ({ ...p, prosthesis_level: v }))} />
        <Field label="Degrees of Freedom / Main Functions" value={form.dof} onChange={(v) => setForm((p) => ({ ...p, dof: v }))} />
        <Multi label="Control Strategy" options={CONTROL_STRATEGIES} selected={form.control_strategy} onToggle={(v) => setForm((p) => ({ ...p, control_strategy: toggleArrayValue(p.control_strategy, v) }))} />
        <Multi label="Sensors Used" options={SENSORS} selected={form.sensors} onToggle={(v) => setForm((p) => ({ ...p, sensors: toggleArrayValue(p.sensors, v) }))} />
        <Multi label="Feedback Modalities" options={FEEDBACK_MODALITIES} selected={form.feedback_modalities} onToggle={(v) => setForm((p) => ({ ...p, feedback_modalities: toggleArrayValue(p.feedback_modalities, v) }))} />
        <Field label="Manufacturing Method" value={form.manufacturing_method} onChange={(v) => setForm((p) => ({ ...p, manufacturing_method: v }))} />
        <Radio label="Growth Accommodation / Adjustability" value={form.growth_accommodation} options={GROWTH_ACCOMMODATIONS} onChange={(v) => setForm((p) => ({ ...p, growth_accommodation: v }))} />
        <TextField label="Technical Innovation Identified" value={form.technical_innovation} rows={3} onChange={(v) => setForm((p) => ({ ...p, technical_innovation: v }))} />
        <TextField label="Technical Challenges and Solutions" value={form.technical_challenges} rows={3} onChange={(v) => setForm((p) => ({ ...p, technical_challenges: v }))} />
        <Actions dirty={sectionDirty("technical")} saving={saving === "technical"} onDiscard={() => discard("technical")} onSave={() => saveSection("technical")} />
      </Section>

      <Section title="Section 5: Testing, Outcomes, and Statistical Analysis" dirty={sectionDirty("testing")} value="testing">
        <Multi label="Setting of Use / Testing" options={SETTINGS} selected={form.setting} onToggle={(v) => setForm((p) => ({ ...p, setting: toggleArrayValue(p.setting, v) }))} />
        <Multi label="Standardized Functional Tests Used" options={FUNCTIONAL_TESTS} selected={form.functional_tests} onToggle={(v) => setForm((p) => ({ ...p, functional_tests: toggleArrayValue(p.functional_tests, v) }))} />
        <Radio label="Were inferential statistical tests performed?" value={form.statistical_tests_performed} options={STATISTICAL_TESTS_PERFORMED} onChange={(v) => setForm((p) => ({ ...p, statistical_tests_performed: v }))} />
        <Field label="Specify inferential tests used" value={form.statistical_tests_specified} onChange={(v) => setForm((p) => ({ ...p, statistical_tests_specified: v }))} />
        <TextField label="Quantitative Results (Technical and Functional)" value={form.quantitative_results} rows={3} onChange={(v) => setForm((p) => ({ ...p, quantitative_results: v }))} />
        <TextField label="Usage Outcomes" value={form.usage_outcomes} rows={3} onChange={(v) => setForm((p) => ({ ...p, usage_outcomes: v }))} />
        <Field label="Main Gaps Identified by Authors" value={form.gaps} onChange={(v) => setForm((p) => ({ ...p, gaps: v }))} />
        <Actions dirty={sectionDirty("testing")} saving={saving === "testing"} onDiscard={() => discard("testing")} onSave={() => saveSection("testing")} />
      </Section>

      <Section title="Section 6: Research Scope" dirty={sectionDirty("research")} value="research">
        <Radio label="A. Primary research question addressed (select one)" value={form.primary_research_question} options={RESEARCH_QUESTIONS} onChange={(v) => setForm((p) => ({ ...p, primary_research_question: v }))} />
        <Multi label="B. All applicable research questions (select many)" options={ALL_RESEARCH_QUESTIONS} selected={form.research_questions} onToggle={(v) => setForm((p) => ({ ...p, research_questions: toggleArrayValue(p.research_questions, v) }))} />
        <Actions dirty={sectionDirty("research")} saving={saving === "research"} onDiscard={() => discard("research")} onSave={() => saveSection("research")} />
      </Section>

    </Accordion>
  );
};

function Section({ title, value, dirty, children, right }: { title: string; value: string; dirty: boolean; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <AccordionItem value={value} className="rounded-lg border border-border/60 px-2">
      <AccordionTrigger className="py-4 text-base font-semibold leading-snug">
        <span className="inline-flex items-center gap-2">{title}{dirty ? <Badge variant="outline" className="text-[11px]">Dirty</Badge> : null}</span>
        {right}
      </AccordionTrigger>
      <AccordionContent>
        <Card className="border-border/60">
          <CardContent className="space-y-4 pt-4">{children}</CardContent>
        </Card>
      </AccordionContent>
    </AccordionItem>
  );
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <div className="space-y-2"><Label className="text-sm">{label}</Label><Input value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}
function TextField({ label, value, onChange, rows }: { label: string; value: string; onChange: (v: string) => void; rows: number }) {
  return <div className="space-y-2"><Label className="text-sm">{label}</Label><Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}
function Radio({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return <div className="space-y-2"><Label className="text-sm">{label}</Label><RadioGroup value={value} onValueChange={onChange} className="space-y-2">{options.map((o) => <label key={o} className="flex items-center gap-2 text-sm"><RadioGroupItem value={o} id={`${label}-${o}`} /><span>{o}</span></label>)}</RadioGroup></div>;
}
function Multi({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return <div className="space-y-2"><Label className="text-sm">{label}</Label><div className="space-y-2">{options.map((o) => <label key={o} className="flex items-center gap-2 text-sm"><Checkbox checked={selected.includes(o)} onCheckedChange={() => onToggle(o)} /><span>{o}</span></label>)}</div></div>;
}
function Actions({ dirty, saving, onDiscard, onSave }: { dirty: boolean; saving: boolean; onDiscard: () => void; onSave: () => void }) {
  return <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-4"><Button variant="outline" size="sm" disabled={!dirty || saving} onClick={onDiscard}>Discard</Button><Button size="sm" disabled={!dirty || saving} onClick={onSave}>{saving ? "Saving..." : "Save section"}</Button></div>;
}

export default ArticleReviewEditorPanel;
