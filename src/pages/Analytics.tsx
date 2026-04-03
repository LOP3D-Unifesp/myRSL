import { Component, Suspense, lazy, type ErrorInfo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchArticles } from "@/lib/articles";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, BarChart3, Files, Globe2, CalendarRange, Baby, ArrowRight } from "lucide-react";
import { WorldMap, regions } from "react-svg-worldmap";
import CrossAnalysis from "@/components/CrossAnalysis";
import { buildCountryFrequencyMap, normalizeCountryName } from "@/lib/country-normalization";
import PageHeader from "@/components/layout/PageHeader";
import PageState from "@/components/layout/PageState";
import DashboardSection from "@/components/layout/DashboardSection";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { buildFrequency, buildFrequencyFromNested, topNWithOthers } from "@/lib/analytics-utils";
import { cn } from "@/lib/utils";
import { ChartCard } from "@/components/analytics/ChartCard";

const OverviewSection = lazy(() => import("@/components/analytics/sections/OverviewSection"));
const PediatricSection = lazy(() => import("@/components/analytics/sections/PediatricSection"));
const MethodologySection = lazy(() => import("@/components/analytics/sections/MethodologySection"));
const ParticipantsTechSection = lazy(() => import("@/components/analytics/sections/ParticipantsTechSection"));

const HIGHLIGHT_DURATION_MS = 1800;

const ANALYTICS_SECTIONS = {
  cross: "cross",
  overview: "overview",
  geography: "geography",
  pediatric: "pediatric",
  methodology: "methodology",
  participantsTech: "participants-tech",
} as const;

const ANALYTICS_TARGETS = {
  cross: "analytics-target-cross",
  year: "analytics-target-year",
  geography: "analytics-target-geography",
  pediatric: "analytics-target-pediatric",
} as const;

const COUNTRY_NAME_ALIASES_TO_ISO2: Record<string, string> = {
  "United States": "US",
  "South Korea": "KR",
  "Czech Republic": "CZ",
  "Russia": "RU",
  "Ivory Coast": "CI",
};

const COUNTRY_TO_ISO2_LOOKUP = (() => {
  const lookup = new Map<string, string>();
  regions.forEach(({ name, code }) => {
    lookup.set(normalizeCountryName(name), code.toUpperCase());
  });
  Object.entries(COUNTRY_NAME_ALIASES_TO_ISO2).forEach(([name, code]) => {
    lookup.set(normalizeCountryName(name), code.toUpperCase());
  });
  return lookup;
})();

function SectionLoader() {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-md border border-dashed border-border/70 bg-background/50 px-4 text-center text-sm text-muted-foreground">
      Loading charts...
    </div>
  );
}

const Analytics = () => {
  const [search, setSearch] = useState("");
  const [openSections, setOpenSections] = useState<string[]>([ANALYTICS_SECTIONS.cross, ANALYTICS_SECTIONS.overview]);
  const [highlightedTarget, setHighlightedTarget] = useState<string | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
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
        a.country?.toLowerCase().includes(term) ||
        a.title?.toLowerCase().includes(term),
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

  const countryFrequencyData = useMemo(() => {
    const all = Object.entries(buildCountryFrequencyMap(filtered))
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    return { all, top10: all.slice(0, 10), count: all.length };
  }, [filtered]);
  const countryData = countryFrequencyData.top10;
  const allCountryData = countryFrequencyData.all;
  const allCountriesCount = countryFrequencyData.count;

  const pediatricQuestionData = useMemo(() => {
    const pediatricArticles = filtered.filter((a) => a.has_pediatric_participants === "Yes");
    return topNWithOthers(buildFrequency(pediatricArticles.map((a) => a.primary_research_question)), 6);
  }, [filtered]);

  const geographyMapData = useMemo(() => {
    const mapped: Array<{ country: string; value: number }> = [];
    const unmapped: Array<{ name: string; value: number }> = [];

    allCountryData.forEach(({ name, value }) => {
      const code = COUNTRY_TO_ISO2_LOOKUP.get(normalizeCountryName(name));
      if (code) mapped.push({ country: code, value });
      else unmapped.push({ name, value });
    });

    return { mapped, unmapped };
  }, [allCountryData]);

  const unmappedCountryNames = useMemo(() => new Set(geographyMapData.unmapped.map((item) => item.name)), [geographyMapData.unmapped]);

  const totalStudies = filtered.length;
  const years = filtered.map((a) => a.year).filter((value): value is number => value != null);
  const yearRange = years.length > 0 ? `${Math.min(...years)} - ${Math.max(...years)}` : "N/A";
  const countriesCount = allCountriesCount;
  const pediatricYes = filtered.filter((a) => a.has_pediatric_participants === "Yes").length;
  const pediatricNo = filtered.filter((a) => a.has_pediatric_participants === "No").length;
  const pediatricRate = totalStudies > 0 ? Math.round((pediatricYes / totalStudies) * 100) : 0;
  const countrySpread = allCountryData.length > 0
    ? `${allCountryData[0]?.name} leads with ${allCountryData[0]?.value} ${allCountryData[0]?.value === 1 ? "study" : "studies"}`
    : "No country distribution available";
  const pediatricSummary = `Yes: ${pediatricYes} | No: ${pediatricNo}`;

  const setTransientHighlight = useCallback((targetId: string) => {
    if (highlightTimerRef.current != null) {
      window.clearTimeout(highlightTimerRef.current);
    }
    setHighlightedTarget(targetId);
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightedTarget((current) => (current === targetId ? null : current));
      highlightTimerRef.current = null;
    }, HIGHLIGHT_DURATION_MS);
  }, []);

  const activateTarget = useCallback((targetId: string, accordionSection: string) => {
    setOpenSections((previous) => (previous.includes(accordionSection) ? previous : [...previous, accordionSection]));
    window.setTimeout(() => {
      const element = document.getElementById(targetId);
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setTransientHighlight(targetId);
    }, 60);
  }, [setTransientHighlight]);

  const onActivateCross = useCallback(() => activateTarget(ANALYTICS_TARGETS.cross, ANALYTICS_SECTIONS.cross), [activateTarget]);
  const onActivateYear = useCallback(() => activateTarget(ANALYTICS_TARGETS.year, ANALYTICS_SECTIONS.overview), [activateTarget]);
  const onActivateGeography = useCallback(() => activateTarget(ANALYTICS_TARGETS.geography, ANALYTICS_SECTIONS.geography), [activateTarget]);
  const onActivatePediatric = useCallback(() => activateTarget(ANALYTICS_TARGETS.pediatric, ANALYTICS_SECTIONS.pediatric), [activateTarget]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current != null) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="page-container">
      <PageHeader
        title="Analytics"
        subtitle="Executive view of outcomes, methods, and participant profiles."
        titleIcon={<BarChart3 className="h-6 w-6 text-primary" />}
        variant="emphasis"
      />

      {isLoading ? (
        <PageState title="Loading analytics..." description="Preparing charts and grouped insights." />
      ) : articles.length === 0 ? (
        <PageState title="No data available yet" description="Add articles first to unlock analytics charts." />
      ) : (
        <>
          <DashboardSection title="Global Snapshot" subtitle="Fast indicators to orient your analysis.">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                icon={<Files className="h-4 w-4 text-primary" />}
                label="Studies"
                value={String(totalStudies)}
                helper="Jump to Cross-Analysis"
                targetId={ANALYTICS_TARGETS.cross}
                onActivate={onActivateCross}
              />
              <KpiCard
                icon={<CalendarRange className="h-4 w-4 text-primary" />}
                label="Year Range"
                value={yearRange}
                helper="Jump to Publications by Year"
                targetId={ANALYTICS_TARGETS.year}
                onActivate={onActivateYear}
              />
              <KpiCard
                icon={<Globe2 className="h-4 w-4 text-primary" />}
                label="Countries"
                value={String(countriesCount)}
                helper="Jump to Geography section"
                targetId={ANALYTICS_TARGETS.geography}
                onActivate={onActivateGeography}
              />
              <KpiCard
                icon={<Baby className="h-4 w-4 text-primary" />}
                label="Pediatric Studies"
                value={`${pediatricRate}%`}
                helper="Jump to Pediatric section"
                targetId={ANALYTICS_TARGETS.pediatric}
                onActivate={onActivatePediatric}
              />
            </div>
          </DashboardSection>

          <DashboardSection title="Explore the Dataset" subtitle="Narrow charts by author, year, or country." variant="subtle" compact>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter by author, year, or country..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-md border-border/80 bg-background pl-10"
                aria-label="Filter analytics"
              />
            </div>
          </DashboardSection>

          <Accordion type="multiple" value={openSections} onValueChange={setOpenSections} className="rounded-xl border border-border/80 bg-card px-4 shadow-sm">
            <AccordionItem value={ANALYTICS_SECTIONS.cross}>
              <AccordionTrigger className="text-base font-semibold">Cross-Analysis</AccordionTrigger>
              <AccordionContent>
                <div
                  id={ANALYTICS_TARGETS.cross}
                  data-highlighted={highlightedTarget === ANALYTICS_TARGETS.cross ? "true" : "false"}
                  className={cn(
                    "rounded-lg border border-transparent p-1 transition-colors",
                    highlightedTarget === ANALYTICS_TARGETS.cross && "border-primary/40 bg-primary/5",
                  )}
                >
                  <CrossAnalysis articles={filtered} />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value={ANALYTICS_SECTIONS.overview}>
              <AccordionTrigger className="text-base font-semibold">Overview</AccordionTrigger>
              <AccordionContent className="space-y-6">
                {openSections.includes(ANALYTICS_SECTIONS.overview) ? (
                  <Suspense fallback={<SectionLoader />}>
                    <OverviewSection
                      yearTargetId={ANALYTICS_TARGETS.year}
                      yearHighlighted={highlightedTarget === ANALYTICS_TARGETS.year}
                      yearData={yearData}
                      countryData={countryData}
                      pediatricData={pediatricData}
                      countriesCount={countriesCount}
                      pediatricSummary={pediatricSummary}
                    />
                  </Suspense>
                ) : null}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value={ANALYTICS_SECTIONS.geography}>
              <AccordionTrigger className="text-base font-semibold">Geography</AccordionTrigger>
              <AccordionContent>
                <ChartCard
                  id={ANALYTICS_TARGETS.geography}
                  highlighted={highlightedTarget === ANALYTICS_TARGETS.geography}
                  title="Country Distribution"
                  subtitle={`${countrySpread}. Complete list at right; map highlights ISO-mapped countries.`}
                >
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
                    <div className="space-y-3 rounded-md border border-border/70 bg-background/50 p-3">
                      <div className="min-h-[420px]">
                        <WorldMapErrorBoundary>
                          <WorldMap
                            title="Studies by Country"
                            size="xxl"
                            data={geographyMapData.mapped}
                            color="hsl(var(--chart-5))"
                            backgroundColor="hsl(var(--muted))"
                            tooltipBgColor="hsl(var(--popover))"
                            tooltipTextColor="hsl(var(--popover-foreground))"
                            strokeOpacity={0.2}
                          />
                        </WorldMapErrorBoundary>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-medium text-foreground">All Countries</p>
                      <div className="max-h-[420px] overflow-auto rounded-md border border-border/70 bg-background/60 p-3">
                        <ul className="space-y-2">
                          {allCountryData.map((country) => (
                            <li key={country.name} className="flex items-center justify-between gap-2 text-sm">
                              <span className={cn("truncate text-foreground", unmappedCountryNames.has(country.name) && "text-warning-foreground")}>
                                {country.name}
                              </span>
                              <span className="font-medium text-muted-foreground">{country.value}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {geographyMapData.unmapped.length > 0 ? (
                        <div className="rounded-md border border-border/70 bg-muted/30 p-3">
                          <p className="text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground">
                            Not mapped on map ({geographyMapData.unmapped.length} countries)
                          </p>
                          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {geographyMapData.unmapped.map((item) => (
                              <li key={item.name}>
                                {item.name} ({item.value})
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </ChartCard>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value={ANALYTICS_SECTIONS.pediatric}>
              <AccordionTrigger className="text-base font-semibold">Pediatric</AccordionTrigger>
              <AccordionContent>
                {openSections.includes(ANALYTICS_SECTIONS.pediatric) ? (
                  <Suspense fallback={<SectionLoader />}>
                    <PediatricSection
                      targetId={ANALYTICS_TARGETS.pediatric}
                      highlighted={highlightedTarget === ANALYTICS_TARGETS.pediatric}
                      pediatricSummary={pediatricSummary}
                      pediatricData={pediatricData}
                      pediatricQuestionData={pediatricQuestionData}
                    />
                  </Suspense>
                ) : null}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value={ANALYTICS_SECTIONS.methodology}>
              <AccordionTrigger className="text-base font-semibold">Methodology</AccordionTrigger>
              <AccordionContent className="space-y-6">
                {openSections.includes(ANALYTICS_SECTIONS.methodology) ? (
                  <Suspense fallback={<SectionLoader />}>
                    <MethodologySection
                      designData={designData}
                      controlData={controlData}
                      primaryRqData={primaryRqData}
                      statsData={statsData}
                    />
                  </Suspense>
                ) : null}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value={ANALYTICS_SECTIONS.participantsTech}>
              <AccordionTrigger className="text-base font-semibold">Participants and Technology</AccordionTrigger>
              <AccordionContent className="space-y-6">
                {openSections.includes(ANALYTICS_SECTIONS.participantsTech) ? (
                  <Suspense fallback={<SectionLoader />}>
                    <ParticipantsTechSection levelData={levelData} sensorsData={sensorsData} feedbackData={feedbackData} />
                  </Suspense>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}
    </div>
  );
};

function KpiCard({
  icon,
  label,
  value,
  helper,
  targetId,
  onActivate,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
  targetId: string;
  onActivate: () => void;
}) {
  return (
    <Card className="h-full border-border/80 transition-colors hover:border-primary/35 hover:bg-primary/5">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={onActivate}
          aria-label={`Jump to ${label}`}
          data-target-id={targetId}
          className="flex w-full items-center gap-3 px-4 py-4 text-left"
        >
          <div className="rounded-md bg-primary/10 p-2">{icon}</div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              {helper}
              <ArrowRight className="h-3 w-3" />
            </p>
          </div>
        </button>
      </CardContent>
    </Card>
  );
}

export default Analytics;

type WorldMapErrorBoundaryProps = {
  children: ReactNode;
};

type WorldMapErrorBoundaryState = {
  hasError: boolean;
};

class WorldMapErrorBoundary extends Component<WorldMapErrorBoundaryProps, WorldMapErrorBoundaryState> {
  constructor(props: WorldMapErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("WorldMap rendering failed", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-[420px] items-center justify-center rounded-md border border-dashed border-border/70 bg-background/50 px-4 text-center text-sm text-muted-foreground">
          Map unavailable on this browser. Country counts are still listed on the right.
        </div>
      );
    }

    return this.props.children;
  }
}
