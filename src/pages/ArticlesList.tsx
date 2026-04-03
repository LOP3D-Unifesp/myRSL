import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchArticlesPage,
  fetchArticleSummaries,
  deleteArticle,
  exportCurrentUserArticlesToExcel,
  type ArticleListItem,
  type ArticleListSort,
  type ArticleListStatus,
  type ArticleListVerificationFilter,
} from "@/lib/articles";
import { formatCompactAuthors } from "@/lib/article-authors";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Search, Pencil, Trash2, FileText, ChevronLeft, ChevronRight, Download, CheckCircle, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";
import PageState from "@/components/layout/PageState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const PAGE_SIZE = 20;
const VERIFICATION_FILTERS = [
  { key: "verify_peer1" as const, label: "Peer 1" },
  { key: "verify_peer2" as const, label: "Peer 2" },
  { key: "verify_qa3" as const, label: "QA 3" },
  { key: "verify_qa4" as const, label: "QA 4" },
];
const STATUS_FILTERS: Array<{ key: ArticleListStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "verified", label: "Verified" },
  { key: "pending", label: "Pending" },
  { key: "draft", label: "Draft" },
];
const qaOptions = ["all", "0", "0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5", "5.5", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10"];

type VerificationFilterKey = (typeof VERIFICATION_FILTERS)[number]["key"];

function parsePositiveInt(value: string | null, fallback = 1): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseSort(value: string | null): ArticleListSort {
  if (value === "year_desc" || value === "year_asc" || value === "qa_desc" || value === "qa_asc") return value;
  return "recent_desc";
}

function parseStatus(value: string | null): ArticleListStatus {
  if (value === "verified" || value === "pending" || value === "draft") return value;
  return "all";
}

function parseQaParam(value: string | null): string {
  if (!value || value === "all") return "all";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : "all";
}

function parseYearParam(value: string | null): string {
  if (!value || value === "all") return "all";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(Math.trunc(parsed)) : "all";
}

function parseVerificationFilters(raw: string | null): Set<VerificationFilterKey> {
  if (!raw) return new Set();
  const allowed = new Set(VERIFICATION_FILTERS.map((filter) => filter.key));
  return new Set(
    raw
      .split(",")
      .map((item) => item.trim())
      .filter((item): item is VerificationFilterKey => allowed.has(item as VerificationFilterKey)),
  );
}

function serializeVerificationFilters(filters: Set<VerificationFilterKey>): string {
  return VERIFICATION_FILTERS
    .map((filter) => filter.key)
    .filter((key) => filters.has(key))
    .join(",");
}

function isFullyVerified(article: ArticleListItem): boolean {
  return Boolean(article.verify_peer1 && article.verify_peer2 && article.verify_qa3 && article.verify_qa4);
}

const ArticlesList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const initialQ = searchParams.get("q") ?? "";
  const initialPage = parsePositiveInt(searchParams.get("page"), 1);
  const initialCountry = searchParams.get("country") ?? "all";
  const initialYearFrom = parseYearParam(searchParams.get("year_from"));
  const initialYearTo = parseYearParam(searchParams.get("year_to"));
  const initialQaMin = parseQaParam(searchParams.get("qa_min"));
  const initialSort = parseSort(searchParams.get("sort"));
  const initialStatus = parseStatus(searchParams.get("status") ?? (searchParams.get("tab") === "review" ? "pending" : "all"));
  const initialVerificationFilters = parseVerificationFilters(searchParams.get("filters"));

  const [searchInput, setSearchInput] = useState(initialQ);
  const [search, setSearch] = useState(initialQ);
  const [page, setPage] = useState(initialPage);
  const [exporting, setExporting] = useState(false);
  const [country, setCountry] = useState(initialCountry);
  const [yearFrom, setYearFrom] = useState(initialYearFrom);
  const [yearTo, setYearTo] = useState(initialYearTo);
  const [qaMin, setQaMin] = useState(initialQaMin);
  const [sort, setSort] = useState<ArticleListSort>(initialSort);
  const [status, setStatus] = useState<ArticleListStatus>(initialStatus);
  const [verificationFilters, setVerificationFilters] = useState<Set<VerificationFilterKey>>(initialVerificationFilters);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(
    initialCountry !== "all" || initialYearFrom !== "all" || initialYearTo !== "all" || initialQaMin !== "all" || initialVerificationFilters.size > 0,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    params.set("page", String(page));
    if (country !== "all") params.set("country", country);
    if (yearFrom !== "all") params.set("year_from", yearFrom);
    if (yearTo !== "all") params.set("year_to", yearTo);
    if (qaMin !== "all") params.set("qa_min", qaMin);
    if (status !== "all") params.set("status", status);

    const serializedFilters = serializeVerificationFilters(verificationFilters);
    if (serializedFilters) params.set("filters", serializedFilters);
    if (sort !== "recent_desc") params.set("sort", sort);

    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [country, page, qaMin, search, searchParams, setSearchParams, sort, status, verificationFilters, yearFrom, yearTo]);

  const queryParams = useMemo(() => {
    const yearFromNumber = yearFrom === "all" ? null : Number(yearFrom);
    const yearToNumber = yearTo === "all" ? null : Number(yearTo);
    const qaMinNumber = qaMin === "all" ? null : Number(qaMin);

    return {
      page,
      pageSize: PAGE_SIZE,
      search,
      country,
      yearFrom: Number.isFinite(yearFromNumber) ? yearFromNumber : null,
      yearTo: Number.isFinite(yearToNumber) ? yearToNumber : null,
      qaMin: Number.isFinite(qaMinNumber) ? qaMinNumber : null,
      status,
      verificationFilters: Array.from(verificationFilters) as ArticleListVerificationFilter[],
      sort,
    };
  }, [country, page, qaMin, search, sort, status, verificationFilters, yearFrom, yearTo]);

  const { data, isLoading } = useQuery({
    queryKey: ["articles", "page", queryParams],
    queryFn: () => fetchArticlesPage(queryParams),
  });

  const { data: allArticles = [] } = useQuery({
    queryKey: ["articles", "filters-options"],
    queryFn: fetchArticleSummaries,
  });

  const articles = data?.data ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const countryOptions = useMemo(() => {
    return Array.from(new Set(allArticles.map((article) => article.country).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b));
  }, [allArticles]);

  const yearOptions = useMemo(() => {
    return Array.from(new Set(allArticles.map((article) => article.year).filter((year): year is number => year != null))).sort((a, b) => b - a);
  }, [allArticles]);

  const hasAnyArticles = allArticles.length > 0;
  const advancedFiltersCount = (country !== "all" ? 1 : 0)
    + (yearFrom !== "all" ? 1 : 0)
    + (yearTo !== "all" ? 1 : 0)
    + (qaMin !== "all" ? 1 : 0);

  const handleDelete = async (id: string) => {
    try {
      await deleteArticle(id);
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast.success("Article deleted successfully");
    } catch {
      toast.error("Error deleting article");
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const { count } = await exportCurrentUserArticlesToExcel();
      toast.success(`Excel export completed (${count} article${count === 1 ? "" : "s"})`);
    } catch {
      toast.error("Failed to export articles to Excel");
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setCountry("all");
    setYearFrom("all");
    setYearTo("all");
    setQaMin("all");
    setStatus("all");
    setVerificationFilters(new Set());
    setSort("recent_desc");
    setPage(1);
  };

  const toggleVerificationFilter = (key: VerificationFilterKey) => {
    setPage(1);
    setVerificationFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Articles"
        subtitle="Curated catalog for triage, review, and daily operations."
        actions={
          <>
            <Button variant="outline" onClick={handleExportExcel} disabled={exporting}>
              <Download className="mr-2 h-4 w-4" />
              {exporting ? "Exporting..." : "Export Excel"}
            </Button>
            <Button asChild>
              <Link to="/articles/new">
                <PlusCircle className="mr-2 h-4 w-4" /> New Article
              </Link>
            </Button>
          </>
        }
      />

      <div className="rounded-xl border border-border/70 bg-card/70 p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by Study ID, title, author, country, or year..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-10 border-border/70 pl-10"
              aria-label="Search articles"
            />
          </div>

          <Select value={sort} onValueChange={(value) => { setSort(value as ArticleListSort); setPage(1); }}>
            <SelectTrigger className="h-10 border-border/70"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent_desc">Sort: Most Recent</SelectItem>
              <SelectItem value="year_desc">Sort: Year (Newest)</SelectItem>
              <SelectItem value="year_asc">Sort: Year (Oldest)</SelectItem>
              <SelectItem value="qa_desc">Sort: QA (Highest)</SelectItem>
              <SelectItem value="qa_asc">Sort: QA (Lowest)</SelectItem>
            </SelectContent>
          </Select>

          <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters} className="contents">
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                className="h-10 w-full border-border/70 lg:w-auto"
                aria-label="Toggle advanced filters"
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Filters
                {advancedFiltersCount > 0 ? (
                  <Badge variant="secondary" className="ml-2 text-[11px]">{advancedFiltersCount}</Badge>
                ) : null}
              </Button>
            </CollapsibleTrigger>
            <div className="lg:col-span-3">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/50 p-2">
                <span className="px-1 text-sm font-medium text-muted-foreground">Status</span>
                {STATUS_FILTERS.map((item) => (
                  <Button
                    key={item.key}
                    type="button"
                    size="sm"
                    variant={status === item.key ? "default" : "outline"}
                    className={status === item.key ? "h-8" : "h-8 border-border/70"}
                    aria-pressed={status === item.key}
                    onClick={() => {
                      setStatus(item.key);
                      setPage(1);
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/50 p-2">
                <span className="px-1 text-sm font-medium text-muted-foreground">Verification</span>
                {VERIFICATION_FILTERS.map(({ key, label }) => (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant={verificationFilters.has(key) ? "default" : "outline"}
                    className={verificationFilters.has(key) ? "h-8" : "h-8 border-border/70"}
                    aria-pressed={verificationFilters.has(key)}
                    onClick={() => toggleVerificationFilter(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <CollapsibleContent className="lg:col-span-3">
              <div className="mt-3 rounded-lg border border-border/60 bg-background/60 p-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Select value={country} onValueChange={(value) => { setCountry(value); setPage(1); }}>
                    <SelectTrigger className="h-10 border-border/70"><SelectValue placeholder="Country" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Countries</SelectItem>
                      {countryOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select value={yearFrom} onValueChange={(value) => { setYearFrom(value); setPage(1); }}>
                    <SelectTrigger className="h-10 border-border/70"><SelectValue placeholder="Year From" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Year From</SelectItem>
                      {yearOptions.map((option) => <SelectItem key={`from-${option}`} value={String(option)}>{option}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select value={yearTo} onValueChange={(value) => { setYearTo(value); setPage(1); }}>
                    <SelectTrigger className="h-10 border-border/70"><SelectValue placeholder="Year To" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Year To</SelectItem>
                      {yearOptions.map((option) => <SelectItem key={`to-${option}`} value={String(option)}>{option}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select value={qaMin} onValueChange={(value) => { setQaMin(value); setPage(1); }}>
                    <SelectTrigger className="h-10 border-border/70"><SelectValue placeholder="QA Min" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">QA Min: Any</SelectItem>
                      {qaOptions.filter((value) => value !== "all").map((value) => <SelectItem key={`qa-min-${value}`} value={value}>QA Min: {value}</SelectItem>)}
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
        </div>
      </div>

      {isLoading ? (
        <PageState title="Loading articles..." description="Please wait while we fetch your records." />
      ) : totalCount === 0 ? (
        <PageState
          icon={<FileText className="h-12 w-12" />}
          title={hasAnyArticles ? "No articles match these filters" : "No articles found"}
          description={hasAnyArticles ? "Adjust your filters to broaden the results." : "Add your first article to get started."}
          actions={
            !hasAnyArticles ? (
              <Button asChild variant="outline">
                <Link to="/articles/new">Add First Article</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground/90">
              {totalCount} result{totalCount === 1 ? "" : "s"}
            </p>
            <p className="text-sm text-muted-foreground/90">Page {page} of {totalPages}</p>
          </div>

          <div className="space-y-3">
            {articles.map((article) => (
              <ArticleRow
                key={article.id}
                article={article}
                onDelete={handleDelete}
                fromPath={`${location.pathname}${location.search}`}
                navigate={navigate}
              />
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing up to {PAGE_SIZE} items per page
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                aria-label="Go to previous page"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                aria-label="Go to next page"
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

function ArticleRow({
  article,
  onDelete,
  fromPath,
  navigate,
}: {
  article: ArticleListItem;
  onDelete: (id: string) => void;
  fromPath: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const verified = isFullyVerified(article);
  const studyId = article.study_id || "No Study ID";
  const authorLabel = formatCompactAuthors(article.author, article.first_author);
  const metaLine = [authorLabel, article.country].filter(Boolean).join(" - ");

  const openArticle = () => {
    navigate(`/articles/${article.id}`, {
      state: {
        from: fromPath,
        scrollY: window.scrollY,
      },
    });
  };

  const onCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openArticle();
    }
  };

  return (
    <Card className="border-border/70 bg-card/80 shadow-sm transition-shadow hover:shadow-md">
      <CardContent
        className="cursor-pointer py-4"
        role="link"
        tabIndex={0}
        onClick={openArticle}
        onKeyDown={onCardKeyDown}
        aria-label={`Open article ${studyId}`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="max-w-full truncate text-base font-semibold text-foreground" title={studyId}>{studyId}</span>
              {article.year ? <Badge variant="secondary" className="text-[11px]">{article.year}</Badge> : null}
              {article.is_draft ? <StatusBadge tone="draft">Draft</StatusBadge> : null}
              {!article.is_draft ? (
                verified ? <StatusBadge tone="verified">Verified</StatusBadge> : <StatusBadge tone="pending">Pending</StatusBadge>
              ) : null}
            </div>

            <p className="line-clamp-1 text-sm text-foreground/90" title={article.title || "Untitled"}>
              {article.title || "Untitled"}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">{metaLine || "No metadata"}</span>
              {article.qa_score != null ? <Badge variant="secondary" className="text-[11px] font-mono">QA: {article.qa_score}/10</Badge> : null}
              {article.verify_peer1 ? <Badge variant="outline" className="border-accent/40 bg-accent/5 text-[11px] text-accent"><CheckCircle className="mr-1 h-3 w-3" />P1</Badge> : null}
              {article.verify_peer2 ? <Badge variant="outline" className="border-accent/40 bg-accent/5 text-[11px] text-accent"><CheckCircle className="mr-1 h-3 w-3" />P2</Badge> : null}
              {article.verify_qa3 ? <Badge variant="outline" className="border-accent/40 bg-accent/5 text-[11px] text-accent"><CheckCircle className="mr-1 h-3 w-3" />Q3</Badge> : null}
              {article.verify_qa4 ? <Badge variant="outline" className="border-accent/40 bg-accent/5 text-[11px] text-accent"><CheckCircle className="mr-1 h-3 w-3" />Q4</Badge> : null}
            </div>
          </div>

          <div className="flex items-center gap-1 self-end sm:self-auto" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
            <Button variant="ghost" size="icon" asChild aria-label={`Edit article ${studyId}`}>
              <Link to={`/articles/${article.id}/edit`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Delete article ${studyId}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete article</AlertDialogTitle>
                  <AlertDialogDescription>This action cannot be undone. The article will be permanently removed.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(article.id)}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ tone, children }: { tone: "draft" | "pending" | "verified"; children: string }) {
  if (tone === "verified") {
    return <Badge variant="outline" className="border-accent/40 bg-accent/5 text-[11px] text-accent">{children}</Badge>;
  }
  if (tone === "pending") {
    return <Badge variant="outline" className="border-warning/35 bg-warning/15 text-[11px] text-warning-foreground">{children}</Badge>;
  }
  return <Badge variant="outline" className="text-[11px]">{children}</Badge>;
}

export default ArticlesList;
