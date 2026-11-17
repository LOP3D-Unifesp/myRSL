import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardList, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/layout/PageHeader";
import CriteriaList from "@/components/protocol/CriteriaList";
import MembersTab from "@/components/protocol/MembersTab";
import DatabasesTab from "@/components/protocol/DatabasesTab";
import ProtocolSummary from "@/components/protocol/ProtocolSummary";
import ScopeTab, { type ScopeValues } from "@/components/protocol/ScopeTab";
import { useAuthUserId } from "@/contexts/auth-user-id";
import { protocolKeys } from "@/lib/article-query-keys";
import {
  deleteProtocolDatabase,
  fetchProtocol,
  fetchProtocolDatabases,
  saveProtocol,
  saveProtocolDatabase,
  type ProtocolDatabaseWriteInput,
} from "@/lib/protocol";

type ProtocolForm = ScopeValues & {
  inclusion_criteria: string[];
  exclusion_criteria: string[];
};

const EMPTY_FORM: ProtocolForm = {
  research_questions: [],
  period_from: "",
  period_to: "",
  languages: [],
  extraction_notes: "",
  inclusion_criteria: [],
  exclusion_criteria: [],
};

const cleanList = (items: string[]) => items.map((item) => item.trim()).filter(Boolean);
const toNumberOrNull = (value: string) => (value.trim() ? Number(value.trim()) : null);

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "issues" in error) {
    const issue = (error as { issues: Array<{ message?: string }> }).issues[0];
    if (issue?.message) return issue.message;
  }
  if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505") {
    return "A database with this name already exists.";
  }
  return error instanceof Error ? error.message : fallback;
}

function serialize(form: ProtocolForm) {
  return JSON.stringify({
    ...form,
    languages: cleanList(form.languages),
    research_questions: cleanList(form.research_questions),
    inclusion_criteria: cleanList(form.inclusion_criteria),
    exclusion_criteria: cleanList(form.exclusion_criteria),
  });
}

const Protocol = () => {
  const userId = useAuthUserId();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProtocolForm>(EMPTY_FORM);
  const [baseline, setBaseline] = useState(() => serialize(EMPTY_FORM));

  const { data: protocol } = useQuery({ queryKey: protocolKeys.protocol(userId), queryFn: fetchProtocol, enabled: Boolean(userId) });
  const { data: databases = [] } = useQuery({ queryKey: protocolKeys.databases(userId), queryFn: fetchProtocolDatabases, enabled: Boolean(userId) });

  useEffect(() => {
    if (!protocol) return;
    const loaded: ProtocolForm = {
      research_questions: protocol.research_questions ?? [],
      period_from: protocol.period_from != null ? String(protocol.period_from) : "",
      period_to: protocol.period_to != null ? String(protocol.period_to) : "",
      languages: protocol.languages ?? [],
      extraction_notes: protocol.extraction_notes ?? "",
      inclusion_criteria: protocol.inclusion_criteria ?? [],
      exclusion_criteria: protocol.exclusion_criteria ?? [],
    };
    setForm(loaded);
    setBaseline(serialize(loaded));
  }, [protocol]);

  const dirty = serialize(form) !== baseline;

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
    mutationFn: () =>
      saveProtocol({
        research_questions: cleanList(form.research_questions),
        period_from: toNumberOrNull(form.period_from),
        period_to: toNumberOrNull(form.period_to),
        languages: cleanList(form.languages),
        extraction_notes: form.extraction_notes.trim() || null,
        inclusion_criteria: cleanList(form.inclusion_criteria),
        exclusion_criteria: cleanList(form.exclusion_criteria),
      }),
    onSuccess: () => {
      setBaseline(serialize(form));
      queryClient.invalidateQueries({ queryKey: protocolKeys.protocol(userId) });
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
        subtitle="Databases, search strings, and eligibility criteria for this review."
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
        inclusion={cleanList(form.inclusion_criteria).length}
        exclusion={cleanList(form.exclusion_criteria).length}
      />

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="databases" className="space-y-6">
            <TabsList>
              <TabsTrigger value="databases">Databases</TabsTrigger>
              <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
              <TabsTrigger value="scope">Scope</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
            </TabsList>

            <TabsContent value="databases">
              <DatabasesTab databases={databases} onSave={handleSaveDatabase} onDelete={handleDeleteDatabase} />
            </TabsContent>

            <TabsContent value="eligibility" className="grid gap-8 md:grid-cols-2">
              <CriteriaList
                title="Inclusion criteria"
                description="A study must meet all of these to be included."
                items={form.inclusion_criteria}
                onChange={(items) => setForm((f) => ({ ...f, inclusion_criteria: items }))}
              />
              <CriteriaList
                title="Exclusion criteria"
                description="A study meeting any of these is excluded."
                items={form.exclusion_criteria}
                onChange={(items) => setForm((f) => ({ ...f, exclusion_criteria: items }))}
              />
            </TabsContent>

            <TabsContent value="scope">
              <ScopeTab values={form} periodError={periodError} onChange={(values) => setForm((f) => ({ ...f, ...values }))} />
            </TabsContent>

            <TabsContent value="team">
              <MembersTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Protocol;
