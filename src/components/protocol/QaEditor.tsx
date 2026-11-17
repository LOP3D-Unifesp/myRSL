import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type QaForm = { slot: string; label: string; description: string };

type Props = {
  items: QaForm[];
  onChange: (items: QaForm[]) => void;
};

const QaEditor = ({ items, onChange }: Props) => {
  const update = (index: number, patch: Partial<QaForm>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Quality assessment checklist</h3>
        <p className="text-sm text-muted-foreground">
          Ten fixed slots, each answered Yes / Partial / No on every article. Editing the wording does not change answers already given, so keep the meaning of a slot when you reword it.
        </p>
      </div>

      {items.map((item, index) => (
        <div key={item.slot} className="space-y-2 rounded-md border border-border/60 p-3">
          <Label htmlFor={`qa-label-${item.slot}`}>{item.slot.replace("qa_q", "Item ")}</Label>
          <Input id={`qa-label-${item.slot}`} value={item.label} onChange={(e) => update(index, { label: e.target.value })} />
          <Textarea
            aria-label={`Description of ${item.slot}`}
            rows={2}
            value={item.description}
            onChange={(e) => update(index, { description: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
};

export default QaEditor;
