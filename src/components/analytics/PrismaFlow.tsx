import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { PrismaCounts } from "@/lib/screening";

function Box({ title, value, children, tone = "default" }: { title: string; value?: number; children?: ReactNode; tone?: "default" | "muted" | "success" }) {
  const toneClass = tone === "success" ? "border-primary/50 bg-primary/5" : tone === "muted" ? "bg-muted/30" : "bg-card";
  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      {value != null ? <p className="text-2xl font-semibold">{value.toLocaleString()}</p> : null}
      {children ? <div className="mt-1 text-sm">{children}</div> : null}
    </div>
  );
}

const Arrow = () => <div aria-hidden className="py-1 text-center text-muted-foreground">↓</div>;

const PrismaFlow = ({ counts }: { counts: PrismaCounts }) => {
  if (counts.identified === 0) {
    return (
      <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        No screening records yet. <Link to="/screening" className="underline">Import them from Parsifal</Link> to see the flow.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Box title="Identified" value={counts.identified}>
        <ul className="grid grid-cols-2 gap-x-6 text-muted-foreground sm:grid-cols-4">
          {counts.bySource.map((item) => <li key={item.source}>{item.source}: <strong className="text-foreground">{item.count}</strong></li>)}
        </ul>
      </Box>
      <Arrow />
      <div className="grid gap-3 sm:grid-cols-2">
        <Box title="Screened" value={counts.screened} />
        <Box title="Duplicates removed" value={counts.duplicates} tone="muted" />
      </div>
      <Arrow />
      <div className="grid gap-3 sm:grid-cols-2">
        <Box title="Included" value={counts.included} tone="success">
          <span className="text-muted-foreground">{counts.extracted} with data extracted</span>
          {counts.unclassified > 0 ? <span className="block text-muted-foreground">{counts.unclassified} still unclassified</span> : null}
        </Box>
        <Box title="Excluded" value={counts.excluded} tone="muted">
          <ul className="space-y-1 text-muted-foreground">
            {counts.excludedByCriterion.map((item) => (
              <li key={item.code || "none"} className="flex gap-2">
                <strong className="w-8 shrink-0 text-right text-foreground">{item.count}</strong>
                <span>{item.code ? `${item.code}: ` : ""}{item.text}</span>
              </li>
            ))}
          </ul>
        </Box>
      </div>
    </div>
  );
};

export default PrismaFlow;
