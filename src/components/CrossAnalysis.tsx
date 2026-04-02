import { useMemo, useState } from "react";
import { type Article } from "@/lib/articles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Building2, FlaskConical, Target, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { splitAndNormalizeCountries } from "@/lib/country-normalization";

type GroupMode = "author" | "last_author" | "first_author" | "university" | "country" | "pediatric" | "primary_rq";
type GroupItem = { key: string; name: string; items: Article[] };

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

const CrossAnalysis = ({ articles }: { articles: Article[] }) => {
  const [mode, setMode] = useState<GroupMode>("last_author");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const groups = useMemo(() => groupArticlesForCrossAnalysis(articles, mode), [articles, mode]);

  const modeLabels: Record<GroupMode, { label: string; icon: React.ReactNode }> = {
    author: { label: "Author", icon: <Users className="h-4 w-4" /> },
    last_author: { label: "Last Author", icon: <Users className="h-4 w-4" /> },
    first_author: { label: "First Author", icon: <Users className="h-4 w-4" /> },
    university: { label: "University / Research Center", icon: <Building2 className="h-4 w-4" /> },
    country: { label: "Country", icon: <Target className="h-4 w-4" /> },
    pediatric: { label: "Pediatric Participants", icon: <FlaskConical className="h-4 w-4" /> },
    primary_rq: { label: "Primary Research Question", icon: <Target className="h-4 w-4" /> },
  };

  if (selectedGroup) {
    const group = groups.find((g) => g.key === selectedGroup);
    if (!group) return null;
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setSelectedGroup(null)}><ArrowLeft className="h-4 w-4" /></Button>
            <CardTitle className="text-lg font-serif">{group.name} ({group.items.length} articles)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {group.items.map((a) => (
            <Link key={a.id} to={`/articles/${a.id}`} className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{a.title || a.author || "Untitled"}</span>
                {a.year && <Badge variant="secondary" className="text-xs">{a.year}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {[a.author, a.country, a.study_design].filter(Boolean).join(" · ")}
              </p>
            </Link>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-serif">Cross-Analysis</CardTitle>
        <p className="text-sm text-muted-foreground">Group and compare articles by different dimensions</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(modeLabels) as GroupMode[]).map((m) => (
            <Button key={m} variant={mode === m ? "default" : "outline"} size="sm" onClick={() => setMode(m)}>
              {modeLabels[m].icon}
              <span className="ml-1">{modeLabels[m].label}</span>
            </Button>
          ))}
        </div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {groups.map((g) => (
            <button
              key={g.key}
              onClick={() => setSelectedGroup(g.key)}
              className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-2 min-w-0">
                {modeLabels[mode].icon}
                <span className="text-sm font-medium truncate">{g.name}</span>
              </div>
              <Badge variant="secondary">{g.items.length}</Badge>
            </button>
          ))}
          {groups.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No data available</p>}
        </div>
      </CardContent>
    </Card>
  );
};

export default CrossAnalysis;
