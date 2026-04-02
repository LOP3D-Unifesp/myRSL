import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchArticles } from "@/lib/articles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import CrossAnalysis from "@/components/CrossAnalysis";
import { buildCountryFrequencyMap } from "@/lib/country-normalization";

const COLORS = [
  "hsl(213, 56%, 33%)",
  "hsl(168, 50%, 42%)",
  "hsl(34, 80%, 55%)",
  "hsl(280, 45%, 55%)",
  "hsl(0, 72%, 51%)",
  "hsl(200, 60%, 50%)",
  "hsl(140, 50%, 40%)",
  "hsl(320, 50%, 50%)",
];

const Analytics = () => {
  const [search, setSearch] = useState("");
  const { data: articles = [] } = useQuery({
    queryKey: ["articles"],
    queryFn: fetchArticles,
  });

  const filtered = useMemo(() => {
    if (!search) return articles;
    const term = search.toLowerCase();
    return articles.filter(
      (a) =>
        a.author?.toLowerCase().includes(term) ||
        String(a.year).includes(term) ||
        a.country?.toLowerCase().includes(term)
    );
  }, [articles, search]);

  const yearData = useMemo(() => {
    const map: Record<number, number> = {};
    filtered.forEach((a) => { if (a.year) map[a.year] = (map[a.year] || 0) + 1; });
    return Object.entries(map).map(([year, count]) => ({ year: Number(year), count })).sort((a, b) => a.year - b.year);
  }, [filtered]);

  const controlData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((a) => { a.control_strategy?.forEach((s) => { map[s] = (map[s] || 0) + 1; }); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const designData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((a) => { if (a.study_design) map[a.study_design] = (map[a.study_design] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const levelData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((a) => { a.amputation_level?.forEach((l) => { map[l] = (map[l] || 0) + 1; }); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const primaryRqData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((a) => { if (a.primary_research_question) map[a.primary_research_question] = (map[a.primary_research_question] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const statsData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((a) => { if (a.statistical_tests_performed) map[a.statistical_tests_performed] = (map[a.statistical_tests_performed] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const pediatricData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((a) => { if (a.has_pediatric_participants) map[a.has_pediatric_participants] = (map[a.has_pediatric_participants] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const countryData = useMemo(() => {
    const map = buildCountryFrequencyMap(filtered);
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const sensorsData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((a) => { a.sensors?.forEach((s) => { map[s] = (map[s] || 0) + 1; }); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const feedbackData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((a) => { a.feedback_modalities?.forEach((f) => { map[f] = (map[f] || 0) + 1; }); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-serif text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">Visual analysis of the systematic review</p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Filter by author, year, or country…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 max-w-md" />
      </div>

      {articles.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Add articles to view analytics charts.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-lg font-serif">Publications by Year</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={yearData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 88%)" />
                  <XAxis dataKey="year" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(213, 56%, 33%)" radius={[4, 4, 0, 0]} name="Articles" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg font-serif">Control Strategy Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={controlData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${value}`} fontSize={11}>
                    {controlData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg font-serif">Study Design Breakdown</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={designData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 88%)" />
                  <XAxis type="number" allowDecimals={false} fontSize={12} />
                  <YAxis dataKey="name" type="category" width={200} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(168, 50%, 42%)" radius={[0, 4, 4, 0]} name="Studies" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-lg font-serif">Level of Limb Absence</CardTitle></CardHeader>
            <CardContent>
              {levelData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={levelData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 88%)" />
                    <XAxis dataKey="name" fontSize={11} angle={-30} textAnchor="end" height={80} />
                    <YAxis allowDecimals={false} fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(280, 45%, 55%)" radius={[4, 4, 0, 0]} name="Studies" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">No limb absence level data yet</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg font-serif">Primary Research Question</CardTitle></CardHeader>
            <CardContent>
              {primaryRqData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={primaryRqData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name.replace(/^Q\d – /, "")}: ${value}`} fontSize={10}>
                      {primaryRqData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">No primary research question data yet</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg font-serif">Inferential Statistical Tests Performed</CardTitle></CardHeader>
            <CardContent>
              {statsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={statsData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${value}`} fontSize={11}>
                      {statsData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">No statistical test data yet</p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-lg font-serif">Pediatric Participants</CardTitle></CardHeader>
            <CardContent>
              {pediatricData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={pediatricData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 88%)" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis allowDecimals={false} fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(34, 80%, 55%)" radius={[4, 4, 0, 0]} name="Studies" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">No pediatric participant data yet</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg font-serif">Articles by Country</CardTitle></CardHeader>
            <CardContent>
              {countryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={countryData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 88%)" />
                    <XAxis type="number" allowDecimals={false} fontSize={12} />
                    <YAxis dataKey="name" type="category" width={150} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(200, 60%, 50%)" radius={[0, 4, 4, 0]} name="Articles" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">No country data yet</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg font-serif">Most Used Sensors</CardTitle></CardHeader>
            <CardContent>
              {sensorsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={sensorsData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 88%)" />
                    <XAxis type="number" allowDecimals={false} fontSize={12} />
                    <YAxis dataKey="name" type="category" width={180} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(140, 50%, 40%)" radius={[0, 4, 4, 0]} name="Studies" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">No sensor data yet</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg font-serif">Feedback Modalities</CardTitle></CardHeader>
            <CardContent>
              {feedbackData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={feedbackData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${value}`} fontSize={11}>
                      {feedbackData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">No feedback modality data yet</p>
              )}
            </CardContent>
          </Card>

          <div className="lg:col-span-2">
            <CrossAnalysis articles={filtered} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
