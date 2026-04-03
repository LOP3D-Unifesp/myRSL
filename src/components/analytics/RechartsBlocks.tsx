import type { FrequencyItem } from "@/lib/analytics-utils";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const truncateLabel = (value: string, max = 24) => (value.length > max ? `${value.slice(0, max - 1)}...` : value);

export function VerticalBarChart({ data, dataKey, xKey, color }: { data: FrequencyItem[]; dataKey: string; xKey: string; color: string }) {
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
        <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" />
        <XAxis dataKey={xKey} fontSize={11} />
        <YAxis allowDecimals={false} fontSize={11} width={32} />
        <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey={dataKey} fill="var(--color-value)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

export function HorizontalRankChart({ data, barColor }: { data: FrequencyItem[]; barColor: string }) {
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
        <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" />
        <XAxis type="number" allowDecimals={false} fontSize={11} />
        <YAxis dataKey="name" type="category" width={190} fontSize={11} tickFormatter={(value) => truncateLabel(String(value), 26)} />
        <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey="value" fill="var(--color-value)" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
