import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FilePlus2, ListChecks, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PageHeader from "@/components/layout/PageHeader";
import DecisionDialog from "@/components/screening/DecisionDialog";
import ImportDialog from "@/components/screening/ImportDialog";
import { useAuthUserId } from "@/contexts/auth-user-id";
import { articleKeys, protocolKeys } from "@/lib/article-query-keys";
import { createArticle, fetchArticleSummaries } from "@/lib/articles";
import { fetchProtocolCriteria } from "@/lib/protocol";
import {
  SCREENING_STATUSES,
  SCREENING_STATUS_LABELS,
  fetchScreeningRecords,
  isScreeningStatus,
  linkRecordToArticle,
  saveScreeningDecision,
  suggestStudyId,
  type ScreeningDecision,
  type ScreeningRecord,
  type ScreeningStatus,
} from "@/lib/screening";
import type { ParsifalImportResult } from "@/lib/screening-import";

const PAGE_SIZE = 25;

export const screeningKeys = {
  records: (userId: string | null | undefined) => ["screening-records", userId ?? "no-user"] as const,
};

const STATUS_VARIANT: Record<ScreeningStatus, "default" | "secondary" | "outline" | "destructive"> = {
  accepted: "default",
  rejected: "destructive",
  duplicate: "secondary",
  unclassified: "outline",
};

const Screening = () => {
  const userId = useAuthUserId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ScreeningStatus | "all">("all");
  const [source, setSource] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deciding, setDeciding] = useState<ScreeningRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data: records = [], isLoading } = useQuery({ queryKey: screeningKeys.records(userId), queryFn: fetchScreeningRecords, enabled: Boolean(userId) });
  const { data: criteria = [] } = useQuery({
    queryKey: [...protocolKeys.protocol(userId), "criteria"],
    queryFn: fetchProtocolCriteria,
    enabled: Boolean(userId),
  });

  const counts = useMemo(() => {
    const result: Record<ScreeningStatus, number> = { accepted: 0, rejected: 0, duplicate: 0, unclassified: 0 };
    for (const record of records) if (isScreeningStatus(record.status)) result[record.status] += 1;
    return result;
  }, [records]);

  const sources = useMemo(
    () => Array.from(new Set(records.map((record) => record.source_database).filter(Boolean) as string[])).sort(),
    [records],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) => {
      if (status !== "all" && record.status !== status) return false;
      if (source !== "all" && record.source_database !== source) return false;
      if (!term) return true;
      return [record.title, record.authors, record.doi, record.journal].filter(Boolean).join(" ").toLowerCase().includes(term);
    });
  }, [records, status, source, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const refresh = () => queryClient.invalidateQueries({ queryKey: screeningKeys.records(userId) });

  const handleSave = async (id: string, decision: ScreeningDecision) => {
    try {
      await saveScreeningDecision(id, decision);
      await refresh();
      toast.success("Decision saved.");
    } catch {
      toast.error("Failed to save the decision.");
      throw new Error("save failed");
    }
  };

  const handleImported = (result: ParsifalImportResult) => {
    refresh();
    toast.success(`Import complete: ${result.inserted} new, ${result.updated} updated, ${result.linked} linked to articles${result.failed ? `, ${result.failed} failed` : ""}.`);
  };

  const handleCreateArticle = async (record: ScreeningRecord) => {
    try {
      const summaries = await queryClient.fetchQuery({ queryKey: articleKeys.all(userId), queryFn: fetchArticleSummaries });
      const article = await createArticle({
        is_draft: true,
        title: record.title,
        abstract: record.abstract?.slice(0, 10000) ?? null,
        doi: record.doi,
        author: record.authors?.slice(0, 2000) ?? null,
        year: record.year,
        publication_place: record.journal?.slice(0, 2000) ?? null,
        source_database: record.source_database,
        study_id: suggestStudyId(record.source_database, summaries.map((item) => item.study_id)),
      });
      await linkRecordToArticle(record.id, article.id);
      await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: articleKeys.all(userId) })]);
      toast.success("Article created from the record.");
      navigate(`/articles/${article.id}/edit`);
    } catch {
      toast.error("Could not create the article.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Screening"
        subtitle="Records identified in the searches and the decision taken on each one."
        titleIcon={<ListChecks className="h-6 w-6" />}
        actions={<Button onClick={() => setImportOpen(true)}><Upload className="mr-2 h-4 w-4" />Import from Parsifal</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => { setStatus("all"); setPage(1); }}
          className={`rounded-lg border px-4 py-3 text-left ${status === "all" ? "bg-muted/60" : "bg-muted/25"}`}
        >
          <p className="text-xs text-muted-foreground">All records</p>
          <p className="text-2xl font-semibold">{records.length}</p>
        </button>
        {SCREENING_STATUSES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => { setStatus(item); setPage(1); }}
            className={`rounded-lg border px-4 py-3 text-left ${status === item ? "bg-muted/60" : "bg-muted/25"}`}
          >
            <p className="text-xs text-muted-foreground">{SCREENING_STATUS_LABELS[item]}</p>
            <p className="text-2xl font-semibold">{counts[item]}</p>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="Search title, authors, journal, or DOI..."
              aria-label="Search records"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            <Select value={source} onValueChange={(value) => { setSource(value); setPage(1); }}>
              <SelectTrigger className="sm:w-52" aria-label="Database"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All databases</SelectItem>
                {sources.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {records.length === 0 && !isLoading ? (
            <div className="rounded-md border border-dashed px-4 py-10 text-center">
              <p className="font-medium">No records yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Import the articles export from Parsifal to bring in your screening.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Database</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criterion</TableHead>
                  <TableHead className="w-40" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((record) => {
                  const recordStatus = isScreeningStatus(record.status) ? record.status : "unclassified";
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="max-w-md">
                        <p className="line-clamp-2 font-medium">{record.title ?? "(no title)"}</p>
                        <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{record.authors ?? ""}</span>
                          {record.url ? (
                            <a href={record.url} target="_blank" rel="noreferrer" aria-label="Open record" className="shrink-0">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null}
                        </p>
                      </TableCell>
                      <TableCell>{record.source_database ?? "-"}</TableCell>
                      <TableCell>{record.year ?? "-"}</TableCell>
                      <TableCell><Badge variant={STATUS_VARIANT[recordStatus]}>{SCREENING_STATUS_LABELS[recordStatus]}</Badge></TableCell>
                      <TableCell>{record.criterion_code ?? "-"}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => setDeciding(record)}>Decide</Button>
                          {record.article_id ? (
                            <Button size="sm" variant="ghost" asChild>
                              <Link to={`/articles/${record.article_id}`}>Article</Link>
                            </Button>
                          ) : recordStatus === "accepted" ? (
                            <Button size="sm" variant="ghost" onClick={() => handleCreateArticle(record)} aria-label={`Create article from ${record.title}`}>
                              <FilePlus2 className="mr-1 h-4 w-4" />Create
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {filtered.length > PAGE_SIZE ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{filtered.length} records, page {currentPage} of {pageCount}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
                <Button size="sm" variant="outline" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <DecisionDialog record={deciding} criteria={criteria} onClose={() => setDeciding(null)} onSave={handleSave} />
      <ImportDialog open={importOpen} criteria={criteria} onOpenChange={setImportOpen} onImported={handleImported} />
    </div>
  );
};

export default Screening;
