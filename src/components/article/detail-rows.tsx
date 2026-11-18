import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ROW_CLASS = "grid gap-1 text-sm md:grid-cols-[200px_minmax(0,1fr)] md:gap-3";
const LABEL_CLASS = "pt-0.5 font-medium text-muted-foreground";

// Empty fields are shown as "Not filled" so missing data is visible at a glance.
function Empty() {
  return <span className="italic text-muted-foreground/70">Not filled</span>;
}

export function DetailRow({ label, value, link }: { label: string; value?: string | null; link?: string }) {
  return (
    <div className={ROW_CLASS}>
      <span className={LABEL_CLASS}>{label}</span>
      {!value ? (
        <Empty />
      ) : link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-primary underline hover:text-primary/80">
          {value}
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <span className="whitespace-pre-wrap text-foreground">{value}</span>
      )}
    </div>
  );
}

export function ExpandableRow({ label, value }: { label: string; value?: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const shouldCollapse = Boolean(value && value.length > 280);
  const shortValue = value && shouldCollapse ? `${value.slice(0, 280)}...` : value;
  return (
    <div className={ROW_CLASS}>
      <span className={LABEL_CLASS}>{label}</span>
      {!value ? (
        <Empty />
      ) : (
        <div>
          <p className="whitespace-pre-wrap text-foreground">{expanded || !shouldCollapse ? value : shortValue}</p>
          {shouldCollapse ? (
            <Button variant="link" size="sm" className="h-auto px-0 text-sm" onClick={() => setExpanded((prev) => !prev)}>
              {expanded ? "Show less" : "Show more"}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function TagRow({ label, values }: { label: string; values?: string[] | null }) {
  return (
    <div className={ROW_CLASS}>
      <span className={LABEL_CLASS}>{label}</span>
      {!values || values.length === 0 ? (
        <Empty />
      ) : (
        <div className="flex flex-wrap gap-1">
          {values.map((item) => (
            <Badge key={`${label}-${item}`} variant="secondary" className="text-xs">{item}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}
