import type { FrequencyItem } from "@/lib/analytics-utils";
import { ChartCard } from "@/components/analytics/ChartCard";
import { HorizontalRankChart } from "@/components/analytics/RechartsBlocks";

export default function ParticipantsTechSection({
  levelData,
  sensorsData,
  feedbackData,
}: {
  levelData: FrequencyItem[];
  sensorsData: FrequencyItem[];
  feedbackData: FrequencyItem[];
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <ChartCard title="Level of Limb Absence" subtitle="Participant profile ranking with grouped tail.">
        <HorizontalRankChart data={levelData} barColor="hsl(var(--chart-3))" />
      </ChartCard>

      <ChartCard title="Most Used Sensors" subtitle="Top sensor modalities in included studies.">
        <HorizontalRankChart data={sensorsData} barColor="hsl(var(--accent))" />
      </ChartCard>

      <ChartCard title="Feedback Modalities" subtitle="Distribution of feedback methods with grouped tail.">
        <HorizontalRankChart data={feedbackData} barColor="hsl(var(--chart-1))" />
      </ChartCard>
    </div>
  );
}
