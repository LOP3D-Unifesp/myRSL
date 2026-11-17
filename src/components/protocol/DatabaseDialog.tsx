import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProtocolDatabase, ProtocolDatabaseWriteInput } from "@/lib/protocol";

type Props = {
  open: boolean;
  database: ProtocolDatabase | null;
  existingNames: string[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: ProtocolDatabaseWriteInput, id?: string) => Promise<void>;
};

const DatabaseDialog = ({ open, database, existingNames, onOpenChange, onSubmit }: Props) => {
  const [name, setName] = useState("");
  const [searchedAt, setSearchedAt] = useState("");
  const [results, setResults] = useState("");
  const [searchString, setSearchString] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(database?.name ?? "");
    setSearchedAt(database?.searched_at ?? "");
    setResults(database?.results_count != null ? String(database.results_count) : "");
    setSearchString(database?.search_string ?? "");
  }, [open, database]);

  const trimmed = name.trim();
  const duplicate = existingNames.some((existing) => existing.toLowerCase() === trimmed.toLowerCase() && existing !== database?.name);
  const error = !trimmed ? "Database name is required." : duplicate ? "A database with this name already exists." : null;

  const submit = async () => {
    if (error) return;
    setSaving(true);
    try {
      await onSubmit(
        {
          name: trimmed,
          search_string: searchString.trim() || null,
          searched_at: searchedAt || null,
          results_count: results.trim() ? Number(results) : null,
        },
        database?.id,
      );
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{database ? "Edit database" : "Add database"}</DialogTitle>
          <DialogDescription>Saved immediately, separately from the rest of the protocol.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="db-name">Database</Label>
              <Input id="db-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Scopus" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="db-date">Search date</Label>
              <Input id="db-date" type="date" value={searchedAt} onChange={(e) => setSearchedAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="db-results">Results</Label>
              <Input id="db-results" type="number" min={0} value={results} onChange={(e) => setResults(e.target.value)} />
            </div>
          </div>
          {name && error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <div className="space-y-2">
            <Label htmlFor="db-string">Search string</Label>
            <Textarea id="db-string" rows={6} className="font-mono text-sm" value={searchString} onChange={(e) => setSearchString(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={Boolean(error) || saving}>{saving ? "Saving..." : "Save database"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DatabaseDialog;
