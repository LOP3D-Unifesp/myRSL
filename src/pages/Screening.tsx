import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FilePlus2, ListChecks, Search, SlidersHorizontal, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

type ArticleFilter = "all" | "linked" | "unlinked";
type ScreeningSort = "title_asc" | "year_desc" | "year_asc" | "database" | "decided_desc";

function parseArticleFilter(value: string | null): ArticleFilter {
  return value === "linked" || value === "unlinked" ? value : "all";
}

function parseSort(value: string | null): ScreeningSort {
  return value === "year_desc" || value === "year_asc" || value === "database" || value === "decided_desc" ? value : "title_asc";
}

const Screening = () => {
  const userId = useAuthUserId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialStatus = searchParams.get("status") ?? "all";
  const [status, setStatus] = useState<ScreeningStatus | "all">(isScreeningStatus(initialStatus) ? initialStatus : "all");
  const [source, setSource] = useState(searchParams.get("database") ?? "all");
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [yearFrom, setYearFrom] = useState(searchParams.get("year_from") ?? "all");
  const [yearTo, setYearTo] = useState(searchParams.get("year_to") ?? "all");
  const [criterionFilter, setCriterionFilter] = useState(searchParams.get("criterion") ?? "all");
  const [articleFilter, setArticleFilter] = useState<ArticleFilter>(parseArticleFilter(searchParams.get("article")));
  const [sort, setSort] = useState<ScreeningSort>(parseSort(searchParams.get("sort")));
  const [page, setPage] = useState(Math.max(1, Number(searchParams.get("page")) || 1));
  const [showAdvanced, setShowAdvanced] = useState(
    ["database", "year_from", "year_to", "criterion", "article"].some((key) => searchParams.has(key)),
  );
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

  const years = useMemo(
    () => Array.from(new Set(records.map((record) => record.year).filter((year): year is number => year != null))).sort((x, y) => y - x),
    [records],
  );

  const criterionCodes = useMemo(
    () => Array.from(new Set(records.map((record) => record.criterion_code).filter(Boolean) as string[])).sort((x, y) => x.localeCompare(y, undefined, { numeric: true })),
    [records],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const from = yearFrom === "all" ? null : Number(yearFrom);
    const to = yearTo === "all" ? null : Number(yearTo);
    const rows = records.filter((record) => {
      if (status !== "all" && record.status !== status) return false;
      if (source !== "all" && record.source_database !== source) return false;
      if (from != null && (record.year == null || record.year < from)) return false;
      if (to != null && (record.year == null || record.year > to)) return false;
      if (criterionFilter === "none" && record.criterion_code) return false;
      if (criterionFilter !== "all" && criterionFilter !== "none" && record.criterion_code !== criterionFilter) return false;
      if (articleFilter === "linked" && !record.article_id) return false;
      if (articleFilter === "unlinked" && record.article_id) return false;
      if (!term) return true;
      return [record.title, record.authors, record.doi, record.journal, record.comments].filter(Boolean).join(" ").toLowerCase().includes(term);
    });

    const byTitle = (x: ScreeningRecord, y: ScreeningRecord) => (x.title ?? "").localeCompare(y.title ?? "");
    return [...rows].sort((x, y) => {
      if (sort === "year_desc") return (y.year ?? 0) - (x.year ?? 0) || byTitle(x, y);
      if (sort === "year_asc") return (x.year ?? 9999) - (y.year ?? 9999) || byTitle(x, y);
      if (sort === "database") return (x.source_database ?? "").localeCompare(y.source_database ?? "") || byTitle(x, y);
      if (sort === "decided_desc") return (y.screened_at ?? "").localeCompare(x.screened_at ?? "") || byTitle(x, y);
      return byTitle(x, y);
    });
  }, [records, status, source, search, yearFrom, yearTo, criterionFilter, articleFilter, sort]);

  const advancedFiltersCount =
    (source !== "all" ? 1 : 0)
    + (yearFrom !== "all" ? 1 : 0)
    + (yearTo !== "all" ? 1 : 0)
    + (criterionFilter !== "all" ? 1 : 0)
    + (articleFilter !== "all" ? 1 : 0);

  const clearFilters = () => {
    setStatus("all");
    setSource("all");
    setSearch("");
    setYearFrom("all");
    setYearTo("all");
    setCriterionFilter("all");
    setArticleFilter("all");
    setSort("title_asc");
    setPage(1);
  };

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (status !== "all") params.set("status", status);
    if (source !== "all") params.set("database", source);
    if (yearFrom !== "all") params.set("year_from", yearFrom);
    if (yearTo !== "all") params.set("year_to", yearTo);
    if (criterionFilter !== "all") params.set("criterion", criterionFilter);
    if (articleFilter !== "all") params.set("article", articleFilter);
    if (sort !== "title_asc") params.set("sort", sort);
    if (currentPage > 1) params.set("page", String(currentPage));
    if (params.toString() !== searchParams.toString()) setSearchParams(params, { replace: true });
  }, [search, status, source, yearFrom, yearTo, criterionFilter, articleFilter, sort, currentPage, searchParams, setSearchParams]);

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
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced} className="space-y-3">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-10"
                  placeholder="Search title, authors, journal, DOI, or comments..."
                  aria-label="Search records"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <Select value={sort} onValueChange={(value) => { setSort(parseSort(value)); setPage(1); }}>
                <SelectTrigger aria-label="Sort"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="title_asc">Sort: Title (A-Z)</SelectItem>
                  <SelectItem value="year_desc">Sort: Year (Newest)</SelectItem>
                  <SelectItem value="year_asc">Sort: Year (Oldest)</SelectItem>
                  <SelectItem value="database">Sort: Database</SelectItem>
                  <SelectItem value="decided_desc">Sort: Recently decided</SelectItem>
                </SelectContent>
              </Select>
              <CollapsibleTrigger asChild>
                <Button variant="outline" aria-label="Toggle advanced filters">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />Filters
                  {advancedFiltersCount > 0 ? <Badge variant="secondary" className="ml-2 text-[11px]">{advancedFiltersCount}</Badge> : null}
                </Button>
              </CollapsibleTrigger>
            </div>

            <CollapsibleContent>
              <div className="rounded-lg border border-border/60 bg-background/60 p-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Select value={source} onValueChange={(value) => { setSource(value); setPage(1); }}>
                    <SelectTrigger aria-label="Database"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All databases</SelectItem>
                      {sources.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select
                    value={yearFrom}
                    onValueChange={(value) => {
                      setYearFrom(value);
                      if (yearTo !== "all" && value !== "all" && Number(value) > Number(yearTo)) setYearTo(value);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger aria-label="Year from"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Year from: Any</SelectItem>
                      {years.map((year) => <SelectItem key={`from-${year}`} value={String(year)}>From {year}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select
                    value={yearTo}
                    onValueChange={(value) => {
                      setYearTo(value);
                      if (yearFrom !== "all" && value !== "all" && Number(value) < Number(yearFrom)) setYearFrom(value);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger aria-label="Year to"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Year to: Any</SelectItem>
                      {years.map((year) => <SelectItem key={`to-${year}`} value={String(year)}>To {year}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select value={criterionFilter} onValueChange={(value) => { setCriterionFilter(value); setPage(1); }}>
                    <SelectTrigger aria-label="Criterion"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All criteria</SelectItem>
                      <SelectItem value="none">No criterion</SelectItem>
                      {criterionCodes.map((code) => {
                        const text = criteria.find((item) => item.code === code)?.text;
                        return <SelectItem key={code} value={code}>{text ? `${code} - ${text.slice(0, 40)}` : code}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>

                  <Select value={articleFilter} onValueChange={(value) => { setArticleFilter(parseArticleFilter(value)); setPage(1); }}>
                    <SelectTrigger aria-label="Article"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Article: Any</SelectItem>
                      <SelectItem value="linked">With article</SelectItem>
                      <SelectItem value="unlinked">Without article</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={clearFilters}>
                    Clear filters
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {records.length > 0 ? (
            <p className="text-sm text-muted-foreground">{filtered.length} of {records.length} records</p>
          ) : null}

          {records.length === 0 && !isLoading ? (
            <div className="rounded-md border border-dashed px-4 py-10 text-center">
              <p className="font-medium">No records yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Import the articles export from Parsifal to bring in your screening.</p>
            </div>
          ) : filtered.length === 0 && !isLoading ? (
            <div className="rounded-md border border-dashed px-4 py-10 text-center">
              <p className="font-medium">No records match these filters</p>
              <Button variant="link" onClick={clearFilters}>Clear filters</Button>
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
              <span className="text-muted-foreground">Page {currentPage} of {pageCount}</span>
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
