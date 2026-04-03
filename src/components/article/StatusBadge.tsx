import { Badge } from "@/components/ui/badge";

type Tone = "warning" | "success" | "draft" | "pending" | "verified";

const toneClasses: Record<Tone, string> = {
  warning: "border-warning/40 bg-warning/20 text-warning-foreground",
  success: "border-success/40 bg-success/15 text-success",
  draft: "text-[11px]",
  pending: "border-warning/35 bg-warning/15 text-[11px] text-warning-foreground",
  verified: "border-accent/40 bg-accent/5 text-[11px] text-accent",
};

export function StatusBadge({ tone, children }: { tone: Tone; children: string }) {
  return (
    <Badge variant="outline" className={toneClasses[tone]}>
      {children}
    </Badge>
  );
}
