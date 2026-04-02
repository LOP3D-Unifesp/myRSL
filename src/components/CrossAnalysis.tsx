import { useMemo, useState } from "react";
import { type Article } from "@/lib/articles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Building2, FlaskConical, Target, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { splitAndNormalizeCountries } from "@/lib/country-normalization";

type GroupMode = "last_author" | "first_author" | "university" | "country" | "pediatric" | "primary_rq";

const CrossAnalysis = ({ articles }: { articles: Article[] }) => {
  const [mode, setMode] = useState<GroupMode>("last_author");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map: Record<string, Article[]> = {};
    articles.forEach((a) => {
      let keys: string[] = [];
      if (mode === "last_author") {
        keys = a.last_author ? [a.last_author] : ["Unknown"];
      } else if (mode === "first_author") {
        keys = (a.first_author || a.author) ? [a.first_author || a.author!] : ["Unknown"];
      } else if (mode === "university") {
        keys = a.universities ? a.universities.split(";").map((u) => u.trim()).filter(Boolean) : ["Unknown"];
      } else if (mode === "country") {
        const countries = splitAndNormalizeCountries(a.country);
        keys = countries.length > 0 ? countries : ["Unknown"];
      } else if (mode === "pediatric") {
        keys = [a.has_pediatric_participants || "Not reported"];
      } else if (mode === "primary_rq") {
        keys = [a.primary_research_question || "Not assigned"];
      }
      keys.forEach((k) => { (map[k] = map[k] || []).push(a); });
    });
    return Object.entries(map)
      .map(([name, items]) => ({ name, items }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [articles, mode]);

  const modeLabels: Record<GroupMode, { label: string; icon: React.ReactNode }> = {
    last_author: { label: "Last Author", icon: <Users className="h-4 w-4" /> },
    first_author: { label: "First Author", icon: <Users className="h-4 w-4" /> },
    university: { label: "University / Research Center", icon: <Building2 className="h-4 w-4" /> },
    country: { label: "Country", icon: <Target className="h-4 w-4" /> },
    pediatric: { label: "Pediatric Participants", icon: <FlaskConical className="h-4 w-4" /> },
    primary_rq: { label: "Primary Research Question", icon: <Target className="h-4 w-4" /> },
  };

  if (selectedGroup) {
    const group = groups.find((g) => g.name === selectedGroup);
    if (!group) return null;
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setSelectedGroup(null)}><ArrowLeft className="h-4 w-4" /></Button>
            <CardTitle className="text-lg font-serif">{selectedGroup} ({group.items.length} articles)</CardTitle>
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
              key={g.name}
              onClick={() => setSelectedGroup(g.name)}
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
