import type { FrequencyItem } from "@/lib/analytics-utils";
import { ChartCard } from "@/components/analytics/ChartCard";
import { HorizontalRankChart, VerticalBarChart } from "@/components/analytics/RechartsBlocks";

export default function PediatricSection({
  targetId,
  highlighted,
  pediatricSummary,
  pediatricData,
  pediatricQuestionData,
}: {
  targetId: string;
  highlighted: boolean;
  pediatricSummary: string;
  pediatricData: FrequencyItem[];
  pediatricQuestionData: FrequencyItem[];
}) {
  return (
    <ChartCard
      id={targetId}
      highlighted={highlighted}
      title="Pediatric Deep Dive"
      subtitle={`${pediatricSummary}. Includes distribution and top primary questions among pediatric studies.`}
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <VerticalBarChart data={pediatricData} dataKey="value" xKey="name" color="hsl(var(--chart-4))" />
        {pediatricQuestionData.length > 0 ? (
          <HorizontalRankChart data={pediatricQuestionData} barColor="hsl(var(--chart-2))" />
        ) : (
          <div className="flex h-[280px] items-center justify-center rounded-md border border-dashed border-border/70 bg-background/50 px-4 text-center text-sm text-muted-foreground">
            No pediatric studies available for question-level exploration.
          </div>
        )}
      </div>
    </ChartCard>
  );
}
