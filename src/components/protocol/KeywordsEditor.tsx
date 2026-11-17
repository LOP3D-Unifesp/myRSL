import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type KeywordForm = { term: string; synonyms: string };

type Props = {
  items: KeywordForm[];
  onChange: (items: KeywordForm[]) => void;
};

const KeywordsEditor = ({ items, onChange }: Props) => (
  <div className="space-y-3">
    <div>
      <h3 className="text-base font-semibold">Keywords and synonyms</h3>
      <p className="text-sm text-muted-foreground">Separate synonyms with commas.</p>
    </div>

    {items.map((item, index) => (
      <div key={index} className="flex items-start gap-2">
        <Input
          className="w-48 shrink-0"
          placeholder="Keyword"
          aria-label={`Keyword ${index + 1}`}
          value={item.term}
          onChange={(e) => onChange(items.map((current, i) => (i === index ? { ...current, term: e.target.value } : current)))}
        />
        <Input
          placeholder="Synonyms, separated by commas"
          aria-label={`Synonyms of keyword ${index + 1}`}
          value={item.synonyms}
          onChange={(e) => onChange(items.map((current, i) => (i === index ? { ...current, synonyms: e.target.value } : current)))}
        />
        <Button type="button" variant="ghost" size="icon" aria-label={`Remove keyword ${index + 1}`} onClick={() => onChange(items.filter((_, i) => i !== index))}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    ))}

    <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, { term: "", synonyms: "" }])}>
      <Plus className="mr-1 h-4 w-4" />Add keyword
    </Button>
  </div>
);

export default KeywordsEditor;
