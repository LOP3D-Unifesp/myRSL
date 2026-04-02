import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type VerificationKey = "verify_peer1" | "verify_peer2" | "verify_qa3" | "verify_qa4";

const VERIFICATIONS: { key: VerificationKey; label: string }[] = [
  { key: "verify_peer1", label: "Peer 1" },
  { key: "verify_peer2", label: "Peer 2" },
  { key: "verify_qa3", label: "QA 3" },
  { key: "verify_qa4", label: "QA 4" },
];

interface Props {
  values: Record<VerificationKey, boolean>;
  onToggle: (key: VerificationKey) => void;
}

const VerificationToggles = ({ values, onToggle }: Props) => {
  return (
    <div className="flex flex-wrap gap-2">
      {VERIFICATIONS.map(({ key, label }) => {
        const active = values[key];
        return (
          <Button
            key={key}
            size="sm"
            variant={active ? "default" : "outline"}
            className={cn(
              "transition-colors",
              active && "bg-green-600 hover:bg-green-700 text-white border-green-600"
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
