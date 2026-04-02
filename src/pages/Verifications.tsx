import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchVerificationSummaries, type VerificationListItem } from "@/lib/articles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, ShieldCheck } from "lucide-react";

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
  const { data: articles = [] } = useQuery({
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
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-serif text-foreground flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" /> Verifications Center
        </h1>
        <p className="text-sm text-muted-foreground">Filter articles by verification status</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Filter by Verification</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6">
            {FILTERS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={selected.has(key)}
                  onCheckedChange={() => toggleFilter(key)}
                />
                <span className="text-sm font-medium">{label}</span>
              </label>
            ))}
          </div>
          {selected.size > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Showing articles verified by: {Array.from(selected).map((k) => FILTERS.find((f) => f.key === k)?.label).join(", ")}
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground mb-3">{filtered.length} article(s) found</p>

      <div className="space-y-2">
        {filtered.map((a: VerificationListItem) => (
          <Link
            key={a.id}
            to={`/articles/${a.id}`}
            state={{
              from: `${location.pathname}${location.search}`,
              scrollY: window.scrollY,
            }}
            className="block p-4 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm text-foreground truncate">
                  {a.title || a.author || "Untitled"} {a.year ? `(${a.year})` : ""}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {[a.author, a.country].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0 ml-4">
                {a.verify_peer1 && <Badge variant="outline" className="text-xs border-green-500 text-green-600"><CheckCircle className="h-3 w-3 mr-1" />P1</Badge>}
                {a.verify_peer2 && <Badge variant="outline" className="text-xs border-green-500 text-green-600"><CheckCircle className="h-3 w-3 mr-1" />P2</Badge>}
                {a.verify_qa3 && <Badge variant="outline" className="text-xs border-green-500 text-green-600"><CheckCircle className="h-3 w-3 mr-1" />Q3</Badge>}
                {a.verify_qa4 && <Badge variant="outline" className="text-xs border-green-500 text-green-600"><CheckCircle className="h-3 w-3 mr-1" />Q4</Badge>}
                {a.qa_score != null && <Badge variant="secondary" className="text-xs font-mono">QA: {a.qa_score}/10</Badge>}
              </div>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No articles match the selected filters.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Verifications;
