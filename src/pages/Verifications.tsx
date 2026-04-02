import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchVerificationSummaries, type VerificationListItem } from "@/lib/articles";
import { formatCompactAuthors } from "@/lib/article-authors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import PageState from "@/components/layout/PageState";

const FILTERS = [
  { key: "verify_peer1" as const, label: "Peer 1" },
  { key: "verify_peer2" as const, label: "Peer 2" },
  { key: "verify_qa3" as const, label: "QA 3" },
  { key: "verify_qa4" as const, label: "QA 4" },
];
type FilterKey = (typeof FILTERS)[number]["key"];
const FILTER_KEYS = new Set(FILTERS.map((f) => f.key));

function isFilterKey(value: string): value is FilterKey {
  return FILTER_KEYS.has(value as FilterKey);
}

function parseFilterParam(raw: string | null): Set<FilterKey> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter((value): value is FilterKey => isFilterKey(value)),
  );
}

function serializeFilters(selected: Set<FilterKey>): string {
  return FILTERS
    .map((filter) => filter.key)
    .filter((key) => selected.has(key))
    .join(",");
}

function areSetsEqual(a: Set<FilterKey>, b: Set<FilterKey>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

const Verifications = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<Set<FilterKey>>(() => parseFilterParam(searchParams.get("filters")));
  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["articles"],
    queryFn: fetchVerificationSummaries,
  });

  useEffect(() => {
    const next = parseFilterParam(searchParams.get("filters"));
    setSelected((prev) => (areSetsEqual(prev, next) ? prev : next));
  }, [searchParams]);

  useEffect(() => {
    const state = location.state as { scrollY?: number } | null;
    if (typeof state?.scrollY !== "number") return;

    window.scrollTo({ top: state.scrollY, behavior: "auto" });
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate]);

  const toggleFilter = (key: FilterKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);

      const nextParams = new URLSearchParams(searchParams);
      const serialized = serializeFilters(next);
      if (serialized) nextParams.set("filters", serialized);
      else nextParams.delete("filters");
      setSearchParams(nextParams, { replace: true });

      return next;
    });
  };

  const filtered = useMemo(() => {
    if (selected.size === 0) return articles;
    const keys = Array.from(selected);
    return articles.filter((article) => keys.every((key) => article[key] === true));
  }, [articles, selected]);

  return (
    <div className="page-container">
      <PageHeader
        title="Verifications Center"
        subtitle="Filter and review articles by verification status."
        titleIcon={<ShieldCheck className="h-6 w-6 text-primary" />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter by Verification</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6">
            {FILTERS.map(({ key, label }) => (
              <label key={key} className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={selected.has(key)}
                  onCheckedChange={() => toggleFilter(key)}
                  aria-label={`Filter by ${label}`}
                />
                <span className="text-sm font-medium">{label}</span>
              </label>
            ))}
          </div>
          {selected.size > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Showing articles verified by: {Array.from(selected).map((k) => FILTERS.find((f) => f.key === k)?.label).join(", ")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {isLoading ? (
        <PageState title="Loading verifications..." description="Getting verification status for all articles." />
      ) : filtered.length === 0 ? (
        <PageState title="No articles match these filters" description="Adjust filters to broaden the results." />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{filtered.length} article(s) found</p>

          <div className="space-y-2">
            {filtered.map((a: VerificationListItem) => (
              <Link
                key={a.id}
                to={`/articles/${a.id}`}
                state={{
                  from: `${location.pathname}${location.search}`,
                  scrollY: window.scrollY,
                }}
                className="block rounded-lg border p-4 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {a.title || a.author || "Untitled"} {a.year ? `(${a.year})` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[formatCompactAuthors(a.author, null), a.country].filter(Boolean).join(" - ")}
                    </p>
                  </div>
                  <div className="ml-4 flex shrink-0 flex-wrap gap-1.5">
                    {a.verify_peer1 ? <Badge variant="outline" className="border-accent/50 bg-accent/10 text-xs text-accent"><CheckCircle className="mr-1 h-3 w-3" />P1</Badge> : null}
                    {a.verify_peer2 ? <Badge variant="outline" className="border-accent/50 bg-accent/10 text-xs text-accent"><CheckCircle className="mr-1 h-3 w-3" />P2</Badge> : null}
                    {a.verify_qa3 ? <Badge variant="outline" className="border-accent/50 bg-accent/10 text-xs text-accent"><CheckCircle className="mr-1 h-3 w-3" />Q3</Badge> : null}
                    {a.verify_qa4 ? <Badge variant="outline" className="border-accent/50 bg-accent/10 text-xs text-accent"><CheckCircle className="mr-1 h-3 w-3" />Q4</Badge> : null}
                    {a.qa_score != null ? <Badge variant="secondary" className="text-xs font-mono">QA: {a.qa_score}/10</Badge> : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Verifications;
