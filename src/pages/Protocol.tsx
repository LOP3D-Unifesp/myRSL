import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/layout/PageHeader";
import { useAuthUserId } from "@/contexts/auth-user-id";
import { protocolKeys } from "@/lib/article-query-keys";
import {
  deleteProtocolDatabase,
  fetchProtocol,
  fetchProtocolDatabases,
  saveProtocol,
  saveProtocolDatabase,
  type ProtocolDatabase,
} from "@/lib/protocol";

type ProtocolForm = {
  research_questions: string;
  period_from: string;
  period_to: string;
  languages: string;
  extraction_notes: string;
  inclusion_criteria: string;
  exclusion_criteria: string;
};

type DatabaseForm = {
  name: string;
  search_string: string;
  searched_at: string;
  results_count: string;
};

const EMPTY_PROTOCOL_FORM: ProtocolForm = {
  research_questions: "",
  period_from: "",
  period_to: "",
  languages: "",
  extraction_notes: "",
  inclusion_criteria: "",
  exclusion_criteria: "",
};

const EMPTY_DATABASE_FORM: DatabaseForm = { name: "", search_string: "", searched_at: "", results_count: "" };

const splitLines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
const splitCommas = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
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

function DatabaseCard({ database, onSave, onDelete }: {
  database: ProtocolDatabase;
  onSave: (id: string, form: DatabaseForm) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [form, setForm] = useState<DatabaseForm>({
    name: database.name,
    search_string: database.search_string ?? "",
    searched_at: database.searched_at ?? "",
    results_count: database.results_count != null ? String(database.results_count) : "",
  });
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-border/60 p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Database</Label>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Search date</Label>
          <Input type="date" value={form.searched_at} onChange={(e) => setForm((f) => ({ ...f, searched_at: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Results</Label>
          <Input type="number" min={0} value={form.results_count} onChange={(e) => setForm((f) => ({ ...f, results_count: e.target.value }))} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Search string</Label>
        <Textarea rows={3} value={form.search_string} onChange={(e) => setForm((f) => ({ ...f, search_string: e.target.value }))} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => onDelete(database.id))}>
          <Trash2 className="mr-1 h-4 w-4" />Remove
        </Button>
        <Button size="sm" disabled={busy} onClick={() => run(() => onSave(database.id, form))}>
          <Save className="mr-1 h-4 w-4" />Save
        </Button>
      </div>
    </div>
  );
}

const Protocol = () => {
  const userId = useAuthUserId();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProtocolForm>(EMPTY_PROTOCOL_FORM);
  const [newDatabase, setNewDatabase] = useState<DatabaseForm>(EMPTY_DATABASE_FORM);

  const { data: protocol } = useQuery({ queryKey: protocolKeys.protocol(userId), queryFn: fetchProtocol, enabled: Boolean(userId) });
  const { data: databases = [] } = useQuery({ queryKey: protocolKeys.databases(userId), queryFn: fetchProtocolDatabases, enabled: Boolean(userId) });

  useEffect(() => {
    if (!protocol) return;
    setForm({
      research_questions: protocol.research_questions ?? "",
      period_from: protocol.period_from != null ? String(protocol.period_from) : "",
      period_to: protocol.period_to != null ? String(protocol.period_to) : "",
      languages: (protocol.languages ?? []).join(", "),
      extraction_notes: protocol.extraction_notes ?? "",
      inclusion_criteria: (protocol.inclusion_criteria ?? []).join("\n"),
      exclusion_criteria: (protocol.exclusion_criteria ?? []).join("\n"),
    });
  }, [protocol]);

  const refreshDatabases = () => queryClient.invalidateQueries({ queryKey: protocolKeys.databases(userId) });

  const saveProtocolMutation = useMutation({
    mutationFn: () =>
      saveProtocol({
        research_questions: form.research_questions.trim() || null,
        period_from: toNumberOrNull(form.period_from),
        period_to: toNumberOrNull(form.period_to),
        languages: splitCommas(form.languages),
        extraction_notes: form.extraction_notes.trim() || null,
        inclusion_criteria: splitLines(form.inclusion_criteria),
        exclusion_criteria: splitLines(form.exclusion_criteria),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: protocolKeys.protocol(userId) });
      toast.success("Protocol saved.");
    },
    onError: (error) => toast.error(errorMessage(error, "Failed to save protocol.")),
  });

  const toDatabaseInput = (value: DatabaseForm) => ({
    name: value.name,
    search_string: value.search_string.trim() || null,
    searched_at: value.searched_at || null,
    results_count: toNumberOrNull(value.results_count),
  });

  const handleSaveDatabase = async (id: string, value: DatabaseForm) => {
    try {
      await saveProtocolDatabase(toDatabaseInput(value), id);
      await refreshDatabases();
      toast.success("Database saved.");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save database."));
    }
  };

  const handleDeleteDatabase = async (id: string) => {
    try {
      await deleteProtocolDatabase(id);
      await refreshDatabases();
      toast.success("Database removed. Articles keep their saved database name.");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to remove database."));
    }
  };

  const handleAddDatabase = async () => {
    try {
      await saveProtocolDatabase(toDatabaseInput(newDatabase));
      setNewDatabase(EMPTY_DATABASE_FORM);
      await refreshDatabases();
      toast.success("Database added.");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to add database."));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Protocol"
        subtitle="Databases, search strings, and eligibility criteria for this review."
        titleIcon={<ClipboardList className="h-6 w-6" />}
        actions={
          <Button onClick={() => saveProtocolMutation.mutate()} disabled={saveProtocolMutation.isPending}>
            <Save className="mr-2 h-4 w-4" />{saveProtocolMutation.isPending ? "Saving..." : "Save Protocol"}
          </Button>
        }
      />

      <Card>
        <CardHeader><CardTitle className="text-lg">Databases and search strings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {databases.map((database) => (
            <DatabaseCard key={`${database.id}-${database.updated_at}`} database={database} onSave={handleSaveDatabase} onDelete={handleDeleteDatabase} />
          ))}
          <div className="space-y-3 rounded-md border border-dashed border-border/70 p-3">
            <p className="text-sm font-medium">Add database</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input placeholder="e.g. Scopus" value={newDatabase.name} onChange={(e) => setNewDatabase((f) => ({ ...f, name: e.target.value }))} />
              <Input type="date" value={newDatabase.searched_at} onChange={(e) => setNewDatabase((f) => ({ ...f, searched_at: e.target.value }))} />
              <Input type="number" min={0} placeholder="Results" value={newDatabase.results_count} onChange={(e) => setNewDatabase((f) => ({ ...f, results_count: e.target.value }))} />
            </div>
            <Textarea rows={3} placeholder="Search string" value={newDatabase.search_string} onChange={(e) => setNewDatabase((f) => ({ ...f, search_string: e.target.value }))} />
            <div className="flex justify-end">
              <Button size="sm" onClick={handleAddDatabase} disabled={!newDatabase.name.trim()}>
                <Plus className="mr-1 h-4 w-4" />Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Eligibility criteria</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Inclusion criteria (one per line)</Label>
            <Textarea rows={8} value={form.inclusion_criteria} onChange={(e) => setForm((f) => ({ ...f, inclusion_criteria: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Exclusion criteria (one per line)</Label>
            <Textarea rows={8} value={form.exclusion_criteria} onChange={(e) => setForm((f) => ({ ...f, exclusion_criteria: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Scope</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Research questions</Label>
            <Textarea rows={4} value={form.research_questions} onChange={(e) => setForm((f) => ({ ...f, research_questions: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Period from (year)</Label>
              <Input type="number" value={form.period_from} onChange={(e) => setForm((f) => ({ ...f, period_from: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Period to (year)</Label>
              <Input type="number" value={form.period_to} onChange={(e) => setForm((f) => ({ ...f, period_to: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Languages (comma separated)</Label>
              <Input value={form.languages} onChange={(e) => setForm((f) => ({ ...f, languages: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Data extraction notes</Label>
            <Textarea rows={4} value={form.extraction_notes} onChange={(e) => setForm((f) => ({ ...f, extraction_notes: e.target.value }))} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Protocol;
