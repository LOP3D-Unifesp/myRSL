import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardList, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/layout/PageHeader";
import CriteriaList from "@/components/protocol/CriteriaList";
import DatabasesTab from "@/components/protocol/DatabasesTab";
import MembersTab from "@/components/protocol/MembersTab";
import OverviewTab, { type OverviewValues } from "@/components/protocol/OverviewTab";
import ProtocolSummary from "@/components/protocol/ProtocolSummary";
import QaEditor, { type QaForm } from "@/components/protocol/QaEditor";
import QuestionsEditor, { type QuestionForm } from "@/components/protocol/QuestionsEditor";
import { useAuthUserId } from "@/contexts/auth-user-id";
import { protocolKeys } from "@/lib/article-query-keys";
import { RESEARCH_QUESTIONS } from "@/lib/constants";
import { QA_QUESTIONS } from "@/lib/qa-questions";
import {
  deleteProtocolDatabase,
  EMPTY_PICOC,
  fetchProtocol,
  fetchProtocolCriteria,
  fetchProtocolDatabases,
  fetchProtocolQaItems,
  fetchProtocolQuestions,
  saveProtocol,
  saveProtocolDatabase,
  saveProtocolLists,
  type Picoc,
  type ProtocolDatabaseWriteInput,
  type ProtocolKeyword,
} from "@/lib/protocol";

type ProtocolForm = OverviewValues & {
  inclusion: string[];
  exclusion: string[];
  questions: QuestionForm[];
  qa: QaForm[];
};

// Used until the review saves its own: the questions and QA wording the app has always used.
const DEFAULT_QUESTIONS: QuestionForm[] = RESEARCH_QUESTIONS.map((value, index) => {
  const [code, ...rest] = value.split(" – ");
  return { code, label: rest.join(" – "), text: "", is_main: index === 0 };
});

const DEFAULT_QA: QaForm[] = QA_QUESTIONS.map((item) => ({ slot: item.key, label: item.label, description: item.description }));

const EMPTY_FORM: ProtocolForm = {
  title: "",
  objective: "",
  picoc: EMPTY_PICOC,
  keywords: [],
  search_string: "",
  period_from: "",
  period_to: "",
  languages: [],
  extraction_notes: "",
  inclusion: [],
  exclusion: [],
  questions: DEFAULT_QUESTIONS,
  qa: DEFAULT_QA,
};

const cleanList = (items: string[]) => items.map((item) => item.trim()).filter(Boolean);
const toNumberOrNull = (value: string) => (value.trim() ? Number(value.trim()) : null);
const splitCommas = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

function toPicoc(value: unknown): Picoc {
  const source = (value && typeof value === "object" ? value : {}) as Partial<Picoc>;
  return {
    population: source.population ?? "",
    intervention: source.intervention ?? "",
    comparison: source.comparison ?? "",
    outcome: source.outcome ?? "",
    context: source.context ?? "",
  };
}

function toKeywords(value: unknown): ProtocolForm["keywords"] {
  if (!Array.isArray(value)) return [];
  return (value as ProtocolKeyword[]).map((item) => ({ term: item.term ?? "", synonyms: (item.synonyms ?? []).join(", ") }));
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "issues" in error) {
    const issue = (error as { issues: Array<{ message?: string }> }).issues[0];
    if (issue?.message) return issue.message;
  }
  if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505") {
    return "A database or code with this name already exists.";
  }
  return error instanceof Error ? error.message : fallback;
}

function normalize(form: ProtocolForm) {
  return {
    ...form,
    languages: cleanList(form.languages),
    inclusion: cleanList(form.inclusion),
    exclusion: cleanList(form.exclusion),
    keywords: form.keywords.filter((item) => item.term.trim() || item.synonyms.trim()),
  };
}

const serialize = (form: ProtocolForm) => JSON.stringify(normalize(form));

const Protocol = () => {
  const userId = useAuthUserId();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState<ProtocolForm>(EMPTY_FORM);
  const [baseline, setBaseline] = useState(() => serialize(EMPTY_FORM));

  const protocolKey = protocolKeys.protocol(userId);
  const { data: protocol, isSuccess: protocolLoaded } = useQuery({ queryKey: protocolKey, queryFn: fetchProtocol, enabled: Boolean(userId) });
  const { data: criteria, isSuccess: criteriaLoaded } = useQuery({ queryKey: [...protocolKey, "criteria"], queryFn: fetchProtocolCriteria, enabled: Boolean(userId) });
  const { data: questions, isSuccess: questionsLoaded } = useQuery({ queryKey: [...protocolKey, "questions"], queryFn: fetchProtocolQuestions, enabled: Boolean(userId) });
  const { data: qaItems, isSuccess: qaLoaded } = useQuery({ queryKey: [...protocolKey, "qa-items"], queryFn: fetchProtocolQaItems, enabled: Boolean(userId) });
  const { data: databases = [] } = useQuery({ queryKey: protocolKeys.databases(userId), queryFn: fetchProtocolDatabases, enabled: Boolean(userId) });

  const ready = protocolLoaded && criteriaLoaded && questionsLoaded && qaLoaded;

  useEffect(() => {
    if (!ready) return;
    const loaded: ProtocolForm = {
      title: protocol?.title ?? "",
      objective: protocol?.objective ?? "",
      picoc: toPicoc(protocol?.picoc),
      keywords: toKeywords(protocol?.keywords),
      search_string: protocol?.search_string ?? "",
      period_from: protocol?.period_from != null ? String(protocol.period_from) : "",
      period_to: protocol?.period_to != null ? String(protocol.period_to) : "",
      languages: protocol?.languages ?? [],
      extraction_notes: protocol?.extraction_notes ?? "",
      inclusion: (criteria ?? []).filter((item) => item.kind === "inclusion").map((item) => item.text),
      exclusion: (criteria ?? []).filter((item) => item.kind === "exclusion").map((item) => item.text),
      questions: questions && questions.length > 0
        ? questions.map((item) => ({ code: item.code, label: item.label, text: item.text ?? "", is_main: item.is_main }))
        : DEFAULT_QUESTIONS,
      qa: DEFAULT_QA.map((item) => {
        const saved = qaItems?.find((row) => row.slot === item.slot);
        return saved ? { slot: item.slot, label: saved.label, description: saved.description ?? "" } : item;
      }),
    };
    setForm(loaded);
    setBaseline(serialize(loaded));
  }, [ready, protocol, criteria, questions, qaItems]);

  const dirty = ready && serialize(form) !== baseline;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const periodError = useMemo(() => {
    const from = toNumberOrNull(form.period_from);
    const to = toNumberOrNull(form.period_to);
    return from != null && to != null && from > to ? "Period start must not be after the end." : null;
  }, [form.period_from, form.period_to]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const current = normalize(form);
      await saveProtocol({
        title: current.title.trim() || null,
        objective: current.objective.trim() || null,
        picoc: current.picoc,
        keywords: current.keywords.map((item) => ({ term: item.term, synonyms: splitCommas(item.synonyms) })),
        search_string: current.search_string.trim() || null,
        period_from: toNumberOrNull(current.period_from),
        period_to: toNumberOrNull(current.period_to),
        languages: current.languages,
        extraction_notes: current.extraction_notes.trim() || null,
      });
      await saveProtocolLists({
        criteria: [
          ...current.inclusion.map((text, index) => ({ kind: "inclusion" as const, code: `IC${index + 1}`, text })),
          ...current.exclusion.map((text, index) => ({ kind: "exclusion" as const, code: `EC${index + 1}`, text })),
        ],
        questions: current.questions.map((item) => ({ code: item.code, label: item.label, text: item.text.trim() || null, is_main: item.is_main })),
        qa: current.qa.map((item) => ({ slot: item.slot, label: item.label, description: item.description.trim() || null })),
      });
    },
    onSuccess: () => {
      setBaseline(serialize(form));
      queryClient.invalidateQueries({ queryKey: protocolKey });
      toast.success("Protocol saved.");
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to save protocol.")),
  });

  const refreshDatabases = () => queryClient.invalidateQueries({ queryKey: protocolKeys.databases(userId) });

  const handleSaveDatabase = async (input: ProtocolDatabaseWriteInput, id?: string) => {
    try {
      await saveProtocolDatabase(input, id);
      await refreshDatabases();
      toast.success("Database saved.");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save database."));
      throw error;
    }
  };

  const handleDeleteDatabase = async (id: string) => {
    try {
      await deleteProtocolDatabase(id);
      await refreshDatabases();
      toast.success("Database removed.");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to remove database."));
    }
  };

  const totalResults = databases.reduce((sum, database) => sum + (database.results_count ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Protocol"
        subtitle="Overview, databases, eligibility criteria, research questions, and quality checklist for this review."
        titleIcon={<ClipboardList className="h-6 w-6" />}
        actions={
          <div className="flex items-center gap-3">
            {dirty ? <Badge variant="secondary">Unsaved changes</Badge> : null}
            <Button onClick={() => saveMutation.mutate()} disabled={!dirty || Boolean(periodError) || saveMutation.isPending}>
              {dirty || saveMutation.isPending ? <Save className="mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
              {saveMutation.isPending ? "Saving..." : dirty ? "Save changes" : "Saved"}
            </Button>
          </div>
        }
      />

      <ProtocolSummary
        databases={databases.length}
        totalResults={totalResults}
        inclusion={cleanList(form.inclusion).length}
        exclusion={cleanList(form.exclusion).length}
      />

      {!ready ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading protocol...</p>
      ) : (
      <Card>
        <CardContent className="pt-6">
          <Tabs value={searchParams.get("tab") ?? "overview"} onValueChange={(tab) => setSearchParams({ tab }, { replace: true })} className="space-y-6">
            <TabsList className="flex h-auto flex-wrap justify-start">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="databases">Databases</TabsTrigger>
              <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
              <TabsTrigger value="questions">Questions</TabsTrigger>
              <TabsTrigger value="quality">Quality</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <OverviewTab values={form} periodError={periodError} onChange={(values) => setForm((f) => ({ ...f, ...values }))} />
            </TabsContent>

            <TabsContent value="databases">
              <DatabasesTab databases={databases} onSave={handleSaveDatabase} onDelete={handleDeleteDatabase} />
            </TabsContent>

            <TabsContent value="eligibility" className="grid gap-8 md:grid-cols-2">
              <CriteriaList
                title="Inclusion criteria"
                description="A study must meet these to be included."
                codePrefix="IC"
                items={form.inclusion}
                onChange={(items) => setForm((f) => ({ ...f, inclusion: items }))}
              />
              <CriteriaList
                title="Exclusion criteria"
                description="A study meeting any of these is excluded."
                codePrefix="EC"
                items={form.exclusion}
                onChange={(items) => setForm((f) => ({ ...f, exclusion: items }))}
              />
            </TabsContent>

            <TabsContent value="questions">
              <QuestionsEditor items={form.questions} onChange={(items) => setForm((f) => ({ ...f, questions: items }))} />
            </TabsContent>

            <TabsContent value="quality">
              <QaEditor items={form.qa} onChange={(items) => setForm((f) => ({ ...f, qa: items }))} />
            </TabsContent>

            <TabsContent value="team">
              <MembersTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      )}
    </div>
  );
};

export default Protocol;
