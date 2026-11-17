import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  title: string;
  description: string;
  items: string[];
  onChange: (items: string[]) => void;
};

const CriteriaList = ({ title, description, items, onChange }: Props) => {
  const [draft, setDraft] = useState("");

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, text]);
    setDraft("");
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">No criteria yet.</p>
      ) : (
        <ol className="space-y-2">
          {items.map((item, index) => (
            <li key={index} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-right text-sm text-muted-foreground">{index + 1}.</span>
              <Input
                value={item}
                aria-label={`${title} ${index + 1}`}
                onChange={(e) => onChange(items.map((current, i) => (i === index ? e.target.value : current)))}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${title} ${index + 1}`}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ol>
      )}

      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder="Add criterion"
          aria-label={`Add ${title}`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add} disabled={!draft.trim()}>
          <Plus className="mr-1 h-4 w-4" />Add
        </Button>
      </div>
    </div>
  );
};

export default CriteriaList;
