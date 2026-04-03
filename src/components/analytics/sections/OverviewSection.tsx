import type { FrequencyItem } from "@/lib/analytics-utils";
import { ChartCard } from "@/components/analytics/ChartCard";
import { HorizontalRankChart, VerticalBarChart } from "@/components/analytics/RechartsBlocks";

export default function OverviewSection({
  yearTargetId,
  yearHighlighted,
  yearData,
  countryData,
  pediatricData,
  countriesCount,
  pediatricSummary,
}: {
  yearTargetId: string;
  yearHighlighted: boolean;
  yearData: FrequencyItem[];
  countryData: FrequencyItem[];
  pediatricData: FrequencyItem[];
  countriesCount: number;
  pediatricSummary: string;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <ChartCard
        id={yearTargetId}
        highlighted={yearHighlighted}
        title="Publications by Year"
        subtitle="How study volume changes over time."
        className="xl:col-span-2"
      >
        <VerticalBarChart data={yearData} dataKey="value" xKey="name" color="hsl(var(--chart-1))" />
      </ChartCard>

      <ChartCard title="Top Countries" subtitle={`Executive snapshot: top 10 countries (out of ${countriesCount}).`}>
        <HorizontalRankChart data={countryData} barColor="hsl(var(--chart-5))" />
      </ChartCard>

      <ChartCard title="Pediatric Participation" subtitle={`${pediatricSummary}. Executive view of coverage.`}>
        <VerticalBarChart data={pediatricData} dataKey="value" xKey="name" color="hsl(var(--chart-4))" />
      </ChartCard>
    </div>
  );
}
