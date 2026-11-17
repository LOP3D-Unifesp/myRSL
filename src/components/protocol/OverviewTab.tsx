import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import KeywordsEditor, { type KeywordForm } from "@/components/protocol/KeywordsEditor";
import ScopeTab, { type ScopeValues } from "@/components/protocol/ScopeTab";
import type { Picoc } from "@/lib/protocol";

export type OverviewValues = ScopeValues & {
  title: string;
  objective: string;
  picoc: Picoc;
  keywords: KeywordForm[];
  search_string: string;
};

type Props = {
  values: OverviewValues;
  periodError: string | null;
  onChange: (values: OverviewValues) => void;
};

const PICOC_FIELDS: Array<{ key: keyof Picoc; label: string; hint: string }> = [
  { key: "population", label: "Population", hint: "Who is studied" },
  { key: "intervention", label: "Intervention", hint: "What is applied or evaluated" },
  { key: "comparison", label: "Comparison", hint: "Not mandatory" },
  { key: "outcome", label: "Outcome", hint: "What is measured" },
  { key: "context", label: "Context", hint: "Where it happens" },
];

const OverviewTab = ({ values, periodError, onChange }: Props) => (
  <div className="space-y-8">
    <section className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="protocol-title">Title</Label>
        <Input id="protocol-title" value={values.title} onChange={(e) => onChange({ ...values, title: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="protocol-objective">Objective</Label>
        <Textarea id="protocol-objective" rows={4} value={values.objective} onChange={(e) => onChange({ ...values, objective: e.target.value })} />
      </div>
    </section>

    <section className="space-y-3">
      <h3 className="text-base font-semibold">PICOC</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {PICOC_FIELDS.map(({ key, label, hint }) => (
          <div key={key} className="space-y-2">
            <Label htmlFor={`picoc-${key}`}>{label} <span className="font-normal text-muted-foreground">- {hint}</span></Label>
            <Textarea
              id={`picoc-${key}`}
              rows={3}
              value={values.picoc[key]}
              onChange={(e) => onChange({ ...values, picoc: { ...values.picoc, [key]: e.target.value } })}
            />
          </div>
        ))}
      </div>
    </section>

    <KeywordsEditor items={values.keywords} onChange={(keywords) => onChange({ ...values, keywords })} />

    <section className="space-y-2">
      <Label htmlFor="protocol-search-string">Search string</Label>
      <Textarea
        id="protocol-search-string"
        rows={6}
        className="font-mono text-sm"
        value={values.search_string}
        onChange={(e) => onChange({ ...values, search_string: e.target.value })}
      />
      <p className="text-xs text-muted-foreground">The base string; each database can keep its own adapted version in the Databases tab.</p>
    </section>

    <ScopeTab values={values} periodError={periodError} onChange={(scope) => onChange({ ...values, ...scope })} />
  </div>
);

export default OverviewTab;
