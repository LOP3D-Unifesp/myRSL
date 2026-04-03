import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { VERIFICATION_STAGES, type VerificationKey } from "@/lib/article-verification";

interface Props {
  values: Record<VerificationKey, boolean>;
  onToggle: (key: VerificationKey) => void;
}

const VerificationToggles = ({ values, onToggle }: Props) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      {VERIFICATION_STAGES.map(({ key, label }) => {
        const active = values[key];
        return (
          <Button
            key={key}
            size="sm"
            variant={active ? "default" : "outline"}
            className={cn(
              "w-full justify-start transition-colors",
              active && "border-accent bg-accent text-accent-foreground hover:bg-accent/90"
            )}
            onClick={() => onToggle(key)}
          >
            <CheckCircle className="mr-1 h-4 w-4" />
            {label}
          </Button>
        );
      })}
    </div>
  );
};

export default VerificationToggles;
