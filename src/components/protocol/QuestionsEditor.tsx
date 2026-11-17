import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type QuestionForm = { code: string; label: string; text: string; is_main: boolean };

type Props = {
  items: QuestionForm[];
  onChange: (items: QuestionForm[]) => void;
};

function nextCode(items: QuestionForm[]): string {
  const used = items.map((item) => Number(/^Q(\d+)$/.exec(item.code)?.[1] ?? 0));
  return `Q${Math.max(0, ...used) + 1}`;
}

const QuestionsEditor = ({ items, onChange }: Props) => {
  const update = (index: number, patch: Partial<QuestionForm>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const setMain = (index: number) => onChange(items.map((item, i) => ({ ...item, is_main: i === index })));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Research questions</h3>
        <p className="text-sm text-muted-foreground">
          Articles reference a question as <span className="font-mono">code – label</span>. Changing a code or label does not update articles that already use it.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">No questions yet.</p>
      ) : null}

      {items.map((item, index) => (
        <div key={index} className="space-y-3 rounded-md border border-border/60 p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-20 space-y-2">
              <Label htmlFor={`rq-code-${index}`}>Code</Label>
              <Input id={`rq-code-${index}`} value={item.code} onChange={(e) => update(index, { code: e.target.value })} />
            </div>
            <div className="min-w-48 flex-1 space-y-2">
              <Label htmlFor={`rq-label-${index}`}>Label</Label>
              <Input id={`rq-label-${index}`} value={item.label} onChange={(e) => update(index, { label: e.target.value })} />
            </div>
            {item.is_main ? (
              <Badge className="mb-2">Main</Badge>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => setMain(index)}>Make main</Button>
            )}
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove question ${item.code}`} onClick={() => onChange(items.filter((_, i) => i !== index))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`rq-text-${index}`}>Question</Label>
            <Textarea id={`rq-text-${index}`} rows={3} value={item.text} onChange={(e) => update(index, { text: e.target.value })} />
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, { code: nextCode(items), label: "", text: "", is_main: items.length === 0 }])}>
        <Plus className="mr-1 h-4 w-4" />Add question
      </Button>
    </div>
  );
};

export default QuestionsEditor;
