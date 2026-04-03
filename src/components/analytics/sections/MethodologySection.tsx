import type { FrequencyItem } from "@/lib/analytics-utils";
import { ChartCard } from "@/components/analytics/ChartCard";
import { HorizontalRankChart } from "@/components/analytics/RechartsBlocks";

export default function MethodologySection({
  designData,
  controlData,
  primaryRqData,
  statsData,
}: {
  designData: FrequencyItem[];
  controlData: FrequencyItem[];
  primaryRqData: FrequencyItem[];
  statsData: FrequencyItem[];
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <ChartCard title="Study Design" subtitle="Most common designs with long tail grouped as Others.">
        <HorizontalRankChart data={designData} barColor="hsl(var(--chart-2))" />
      </ChartCard>

      <ChartCard title="Control Strategy" subtitle="Dominant strategies ranked by frequency.">
        <HorizontalRankChart data={controlData} barColor="hsl(var(--chart-3))" />
      </ChartCard>

      <ChartCard title="Primary Research Question" subtitle="Most frequent questions addressed across included studies.">
        <HorizontalRankChart data={primaryRqData} barColor="hsl(var(--primary))" />
      </ChartCard>

      <ChartCard title="Inferential Statistical Tests" subtitle="How often inferential testing is reported.">
        <HorizontalRankChart data={statsData} barColor="hsl(var(--accent))" />
      </ChartCard>
    </div>
  );
}
