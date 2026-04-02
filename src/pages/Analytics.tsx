import { type ReactNode, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchArticles } from "@/lib/articles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, BarChart3, Files, Globe2, CalendarRange, Baby } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import CrossAnalysis from "@/components/CrossAnalysis";
import { buildCountryFrequencyMap } from "@/lib/country-normalization";
import PageHeader from "@/components/layout/PageHeader";
import PageState from "@/components/layout/PageState";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { buildFrequency, buildFrequencyFromNested, topNWithOthers, type FrequencyItem } from "@/lib/analytics-utils";

const truncateLabel = (value: string, max = 24) => (value.length > max ? `${value.slice(0, max - 1)}...` : value);

const Analytics = () => {
  const [search, setSearch] = useState("");
  const { data: articles = [], isLoading } = useQuery({
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
        a.country?.toLowerCase().includes(term),
    );
  }, [articles, search]);

  const yearData = useMemo(() => {
    const map: Record<number, number> = {};
    filtered.forEach((a) => {
      if (a.year) map[a.year] = (map[a.year] || 0) + 1;
    });
    return Object.entries(map)
      .map(([year, count]) => ({ name: String(year), value: count }))
      .sort((a, b) => Number(a.name) - Number(b.name));
  }, [filtered]);

  const controlData = useMemo(() => topNWithOthers(buildFrequencyFromNested(filtered.map((a) => a.control_strategy)), 8), [filtered]);
  const designData = useMemo(() => topNWithOthers(buildFrequency(filtered.map((a) => a.study_design)), 8), [filtered]);
  const levelData = useMemo(() => topNWithOthers(buildFrequencyFromNested(filtered.map((a) => a.amputation_level)), 8), [filtered]);
  const primaryRqData = useMemo(() => topNWithOthers(buildFrequency(filtered.map((a) => a.primary_research_question)), 8), [filtered]);
  const statsData = useMemo(() => topNWithOthers(buildFrequency(filtered.map((a) => a.statistical_tests_performed)), 8), [filtered]);
  const pediatricData = useMemo(() => buildFrequency(filtered.map((a) => a.has_pediatric_participants)), [filtered]);
  const sensorsData = useMemo(() => topNWithOthers(buildFrequencyFromNested(filtered.map((a) => a.sensors)), 8), [filtered]);
  const feedbackData = useMemo(() => topNWithOthers(buildFrequencyFromNested(filtered.map((a) => a.feedback_modalities)), 8), [filtered]);

  const countryData = useMemo(() => {
    const map = buildCountryFrequencyMap(filtered);
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filtered]);

  const totalStudies = filtered.length;
  const years = filtered.map((a) => a.year).filter((value): value is number => value != null);
  const yearRange = years.length > 0 ? `${Math.min(...years)} - ${Math.max(...years)}` : "N/A";
  const countriesCount = countryData.length;
  const pediatricYes = filtered.filter((a) => a.has_pediatric_participants === "Yes").length;
  const pediatricRate = totalStudies > 0 ? Math.round((pediatricYes / totalStudies) * 100) : 0;

  return (
    <div className="page-container">
      <PageHeader
        title="Analytics"
        subtitle="Executive view for presenting your systematic review results."
        titleIcon={<BarChart3 className="h-6 w-6 text-primary" />}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filter by author, year, or country..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md pl-10"
          aria-label="Filter analytics"
        />
      </div>

      {isLoading ? (
        <PageState title="Loading analytics..." description="Preparing charts and grouped insights." />
      ) : articles.length === 0 ? (
        <PageState title="No data available yet" description="Add articles first to unlock analytics charts." />
      ) : (
        <Accordion type="multiple" defaultValue={["overview", "cross"]} className="rounded-lg border bg-card px-4">
          <AccordionItem value="overview">
            <AccordionTrigger className="text-base font-semibold">Overview</AccordionTrigger>
            <AccordionContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard icon={<Files className="h-4 w-4 text-primary" />} label="Studies" value={String(totalStudies)} />
                <KpiCard icon={<CalendarRange className="h-4 w-4 text-primary" />} label="Year Range" value={yearRange} />
                <KpiCard icon={<Globe2 className="h-4 w-4 text-primary" />} label="Countries (Top list)" value={String(countriesCount)} />
                <KpiCard icon={<Baby className="h-4 w-4 text-primary" />} label="Pediatric Studies" value={`${pediatricRate}%`} />
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <ChartCard title="Publications by Year" subtitle="Temporal distribution of included studies." className="xl:col-span-2">
                  <VerticalBarChart data={yearData} dataKey="value" xKey="name" color="hsl(var(--chart-1))" />
                </ChartCard>

                <ChartCard title="Top Countries" subtitle="Top 10 countries by number of studies.">
                  <HorizontalRankChart data={countryData} barColor="hsl(var(--chart-5))" />
                </ChartCard>

                <ChartCard title="Pediatric Participants" subtitle="Distribution of studies with and without pediatric participants.">
                  <VerticalBarChart data={pediatricData} dataKey="value" xKey="name" color="hsl(var(--chart-4))" />
                </ChartCard>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="methodology">
            <AccordionTrigger className="text-base font-semibold">Methodology</AccordionTrigger>
            <AccordionContent className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-2">
                <ChartCard title="Study Design" subtitle="Top categories with tail grouped as Others.">
                  <HorizontalRankChart data={designData} barColor="hsl(var(--chart-2))" />
                </ChartCard>

                <ChartCard title="Control Strategy" subtitle="Top strategies; long tail grouped for cleaner comparison.">
                  <HorizontalRankChart data={controlData} barColor="hsl(var(--chart-3))" />
                </ChartCard>

                <ChartCard title="Primary Research Question" subtitle="Most frequent research questions in the dataset.">
                  <HorizontalRankChart data={primaryRqData} barColor="hsl(var(--primary))" />
                </ChartCard>

                <ChartCard title="Inferential Statistical Tests" subtitle="Prevalence of inferential test reporting across studies.">
                  <HorizontalRankChart data={statsData} barColor="hsl(var(--accent))" />
                </ChartCard>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="participants-tech">
            <AccordionTrigger className="text-base font-semibold">Participants and Technology</AccordionTrigger>
            <AccordionContent className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-2">
                <ChartCard title="Level of Limb Absence" subtitle="Top participant profiles with grouped tail.">
                  <HorizontalRankChart data={levelData} barColor="hsl(var(--chart-3))" />
                </ChartCard>

                <ChartCard title="Most Used Sensors" subtitle="Top sensor modalities reported in included studies.">
                  <HorizontalRankChart data={sensorsData} barColor="hsl(var(--accent))" />
                </ChartCard>

                <ChartCard title="Feedback Modalities" subtitle="Distribution of feedback methods with grouped tail.">
                  <HorizontalRankChart data={feedbackData} barColor="hsl(var(--chart-1))" />
                </ChartCard>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="cross">
            <AccordionTrigger className="text-base font-semibold">Cross-Analysis</AccordionTrigger>
            <AccordionContent>
              <CrossAnalysis articles={filtered} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
};

function KpiCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Card className="border-border/80">
      <CardContent className="flex items-center gap-3 py-4">
        <div className="rounded-md bg-primary/10 p-2">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, subtitle, children, className }: { title: string; subtitle: string; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-serif">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function VerticalBarChart({ data, dataKey, xKey, color }: { data: FrequencyItem[]; dataKey: string; xKey: string; color: string }) {
  return (
    <ChartContainer
      config={{
        value: {
          label: "Studies",
          color,
        },
      }}
      className="h-[280px] w-full"
    >
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey={xKey} fontSize={11} />
        <YAxis allowDecimals={false} fontSize={11} width={28} />
        <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey={dataKey} fill="var(--color-value)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function HorizontalRankChart({ data, barColor }: { data: FrequencyItem[]; barColor: string }) {
  return (
    <ChartContainer
      config={{
        value: {
          label: "Studies",
          color: barColor,
        },
      }}
      className="h-[320px] w-full"
    >
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis type="number" allowDecimals={false} fontSize={11} />
        <YAxis dataKey="name" type="category" width={170} fontSize={11} tickFormatter={(value) => truncateLabel(String(value))} />
        <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey="value" fill="var(--color-value)" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

export default Analytics;
