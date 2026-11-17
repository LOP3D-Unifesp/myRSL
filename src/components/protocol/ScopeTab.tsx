import { useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ScopeValues = {
  period_from: string;
  period_to: string;
  languages: string[];
  extraction_notes: string;
};

type Props = {
  values: ScopeValues;
  periodError: string | null;
  onChange: (values: ScopeValues) => void;
};

const ScopeTab = ({ values, periodError, onChange }: Props) => {
  const [language, setLanguage] = useState("");
  const set = <K extends keyof ScopeValues>(key: K, value: ScopeValues[K]) => onChange({ ...values, [key]: value });

  const addLanguage = () => {
    const text = language.trim();
    if (!text || values.languages.includes(text)) return;
    set("languages", [...values.languages, text]);
    setLanguage("");
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="protocol-from">Period from (year)</Label>
          <Input id="protocol-from" type="number" value={values.period_from} onChange={(e) => set("period_from", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="protocol-to">Period to (year)</Label>
          <Input id="protocol-to" type="number" placeholder="Present" value={values.period_to} onChange={(e) => set("period_to", e.target.value)} />
          <p className="text-xs text-muted-foreground">Leave empty when the search runs up to the present.</p>
        </div>
        {periodError ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{periodError}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="protocol-language">Languages</Label>
        <div className="flex flex-wrap gap-2">
          {values.languages.map((item) => (
            <Badge key={item} variant="secondary" className="gap-1">
              {item}
              <button type="button" aria-label={`Remove ${item}`} onClick={() => set("languages", values.languages.filter((l) => l !== item))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            id="protocol-language"
            value={language}
            placeholder="e.g. English"
            onChange={(e) => setLanguage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLanguage();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addLanguage} disabled={!language.trim()}>Add</Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="protocol-notes">Data extraction notes</Label>
        <Textarea id="protocol-notes" rows={4} value={values.extraction_notes} onChange={(e) => set("extraction_notes", e.target.value)} />
      </div>
    </div>
  );
};

export default ScopeTab;
