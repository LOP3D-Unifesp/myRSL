import { type ReactNode, useMemo, useState } from "react";
import { type Article } from "@/lib/articles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Building2, FlaskConical, Target, ArrowLeft, Search, ArrowUpDown } from "lucide-react";
import { Link } from "react-router-dom";
import { splitAndNormalizeCountries } from "@/lib/country-normalization";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type GroupMode = "author" | "last_author" | "first_author" | "university" | "country" | "pediatric" | "primary_rq";
type GroupItem = { key: string; name: string; items: Article[] };
type GroupSort = "count_desc" | "count_asc" | "name_asc" | "name_desc";

function normalizeGroupKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .map((part) => {
      if (!part) return part;
      return part[0].toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function normalizeAndLabel(value: string): { key: string; label: string } {
  const collapsed = value.trim().replace(/\s+/g, " ");
  const key = normalizeGroupKey(collapsed);
  return { key, label: toTitleCase(collapsed) };
}

function getKeysForMode(article: Article, mode: GroupMode): string[] {
  if (mode === "author") {
    if (article.author) {
      const authors = article.author.split(";").map((a) => a.trim()).filter(Boolean);
      if (authors.length > 0) return authors;
    }
    if (article.first_author) return [article.first_author];
    return ["Unknown"];
  }
  if (mode === "last_author") return article.last_author ? [article.last_author] : ["Unknown"];
  if (mode === "first_author") return (article.first_author || article.author) ? [article.first_author || article.author!] : ["Unknown"];
  if (mode === "university") return article.universities ? article.universities.split(";").map((u) => u.trim()).filter(Boolean) : ["Unknown"];
  if (mode === "country") {
    const countries = splitAndNormalizeCountries(article.country);
    return countries.length > 0 ? countries : ["Unknown"];
  }
  if (mode === "pediatric") return [article.has_pediatric_participants || "Not reported"];
  return [article.primary_research_question || "Not assigned"];
}

export function groupArticlesForCrossAnalysis(articles: Article[], mode: GroupMode): GroupItem[] {
  const map = new Map<string, GroupItem>();
  articles.forEach((article) => {
    const keys = getKeysForMode(article, mode);
    keys.forEach((rawKey) => {
      const { key, label } = normalizeAndLabel(rawKey);
      const existing = map.get(key);
      if (existing) {
        existing.items.push(article);
      } else {
        map.set(key, { key, name: label, items: [article] });
      }
    });
  });

  return Array.from(map.values()).sort((a, b) => b.items.length - a.items.length);
}

function sortGroups(groups: GroupItem[], sort: GroupSort): GroupItem[] {
  const cloned = [...groups];
  if (sort === "count_desc") return cloned.sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
  if (sort === "count_asc") return cloned.sort((a, b) => a.items.length - b.items.length || a.name.localeCompare(b.name));
  if (sort === "name_desc") return cloned.sort((a, b) => b.name.localeCompare(a.name));
  return cloned.sort((a, b) => a.name.localeCompare(b.name));
}

const CrossAnalysis = ({ articles }: { articles: Article[] }) => {
  const [mode, setMode] = useState<GroupMode>("author");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groupSearch, setGroupSearch] = useState("");
  const [groupSort, setGroupSort] = useState<GroupSort>("count_desc");
  const [detailSearch, setDetailSearch] = useState("");

  const grouped = useMemo(() => groupArticlesForCrossAnalysis(articles, mode), [articles, mode]);

  const groups = useMemo(() => {
    const term = groupSearch.trim().toLowerCase();
    const filtered = !term
      ? grouped
      : grouped.filter((group) => group.name.toLowerCase().includes(term));
    return sortGroups(filtered, groupSort);
  }, [grouped, groupSearch, groupSort]);

  const modeLabels: Record<GroupMode, { label: string; icon: ReactNode }> = {
    author: { label: "Author", icon: <Users className="h-4 w-4" /> },
    last_author: { label: "Last Author", icon: <Users className="h-4 w-4" /> },
    first_author: { label: "First Author", icon: <Users className="h-4 w-4" /> },
    university: { label: "University / Research Center", icon: <Building2 className="h-4 w-4" /> },
    country: { label: "Country", icon: <Target className="h-4 w-4" /> },
    pediatric: { label: "Pediatric Participants", icon: <FlaskConical className="h-4 w-4" /> },
    primary_rq: { label: "Primary Research Question", icon: <Target className="h-4 w-4" /> },
  };

  const largestGroup = grouped[0];

  if (selectedGroup) {
    const group = grouped.find((g) => g.key === selectedGroup);
    if (!group) return null;

    const filteredItems = group.items.filter((item) => {
      const term = detailSearch.trim().toLowerCase();
      if (!term) return true;
      return [item.title, item.author, item.country, item.study_design].filter(Boolean).join(" ").toLowerCase().includes(term);
    });

    return (
      <Card className="border-border/80">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setSelectedGroup(null)} aria-label="Back to groups">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-lg font-serif">{group.name} ({group.items.length} articles)</CardTitle>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={detailSearch}
              onChange={(e) => setDetailSearch(e.target.value)}
              placeholder="Search inside this group..."
              className="pl-10"
              aria-label="Search inside selected group"
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-2">
          {filteredItems.map((a) => (
            <Link key={a.id} to={`/articles/${a.id}`} className="block rounded-lg border p-3 transition-colors hover:bg-muted/50">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{a.title || a.author || "Untitled"}</span>
                {a.year ? <Badge variant="secondary" className="text-xs">{a.year}</Badge> : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {[a.author, a.country, a.study_design].filter(Boolean).join(" - ")}
              </p>
            </Link>
          ))}
          {filteredItems.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No articles match this search.</p> : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/80">
      <CardHeader className="space-y-4">
        <p className="text-sm text-muted-foreground">Group and compare articles by key dimensions.</p>

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryMetric label="Total Groups" value={String(grouped.length)} />
          <SummaryMetric label="Total Articles" value={String(articles.length)} />
          <SummaryMetric label="Largest Group" value={largestGroup ? `${largestGroup.name} (${largestGroup.items.length})` : "N/A"} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(modeLabels) as GroupMode[]).map((m) => (
            <Button key={m} variant={mode === m ? "default" : "outline"} size="sm" onClick={() => setMode(m)}>
              {modeLabels[m].icon}
              <span className="ml-1">{modeLabels[m].label}</span>
            </Button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
              placeholder="Search groups..."
              className="pl-10"
              aria-label="Search group names"
            />
          </div>

          <Select value={groupSort} onValueChange={(value) => setGroupSort(value as GroupSort)}>
            <SelectTrigger aria-label="Sort groups">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="count_desc">Most articles first</SelectItem>
              <SelectItem value="count_asc">Fewest articles first</SelectItem>
              <SelectItem value="name_asc">Name A-Z</SelectItem>
              <SelectItem value="name_desc">Name Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {groups.map((g) => (
            <button
              key={g.key}
              onClick={() => setSelectedGroup(g.key)}
              className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0">
                <span className="truncate text-sm font-medium">{g.name}</span>
              </div>
              <Badge variant="secondary">{g.items.length}</Badge>
            </button>
          ))}
          {groups.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No groups found for this filter.</p> : null}
        </div>
      </CardContent>
    </Card>
  );
};

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/25 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export default CrossAnalysis;
