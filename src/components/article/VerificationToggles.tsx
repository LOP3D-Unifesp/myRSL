import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { VERIFICATION_STAGES, type VerificationKey } from "@/lib/article-verification";

export type VerificationStamp = { by: string | null; at: string | null };

interface Props {
  values: Record<VerificationKey, boolean>;
  onToggle: (key: VerificationKey) => void;
  // Who completed each step and when; names are looked up by user id.
  stamps?: Partial<Record<VerificationKey, VerificationStamp>>;
  names?: Map<string, string>;
  // Steps the current user may not change (they belong to the other reviewer).
  locked?: Set<VerificationKey>;
}

function formatStamp(stamp: VerificationStamp | undefined, names: Map<string, string> | undefined): string {
  if (!stamp?.by && !stamp?.at) return "Author not recorded";
  const who = stamp.by ? names?.get(stamp.by) ?? "A former member" : null;
  const when = stamp.at
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(stamp.at))
    : null;
  return [who, when].filter(Boolean).join(" · ");
}

const VerificationToggles = ({ values, onToggle, stamps, names, locked }: Props) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      {VERIFICATION_STAGES.map(({ key, label }) => {
        const active = values[key];
        return (
          <div key={key} className="space-y-1">
            <Button
              size="sm"
              variant={active ? "default" : "outline"}
              className={cn(
                "w-full justify-start transition-colors",
                active && "border-accent bg-accent text-accent-foreground hover:bg-accent/90"
              )}
              onClick={() => onToggle(key)}
              disabled={locked?.has(key)}
              title={locked?.has(key) ? "This step belongs to the other reviewer" : undefined}
            >
              <CheckCircle className="mr-1 h-4 w-4" />
              {label}
            </Button>
            {active ? (
              <p className="truncate px-1 text-xs text-muted-foreground" data-testid={`stamp-${key}`}>
                {formatStamp(stamps?.[key], names)}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

export default VerificationToggles;
