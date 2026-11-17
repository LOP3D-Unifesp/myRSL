import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  executeParsifalImport,
  previewParsifalImport,
  type ParsifalImportPreview,
  type ParsifalImportResult,
} from "@/lib/screening-import";
import { SCREENING_STATUSES, SCREENING_STATUS_LABELS } from "@/lib/screening";
import type { ProtocolCriterion } from "@/lib/protocol";

type Props = {
  open: boolean;
  criteria: ProtocolCriterion[];
  onOpenChange: (open: boolean) => void;
  onImported: (result: ParsifalImportResult) => void;
};

const ImportDialog = ({ open, criteria, onOpenChange, onImported }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParsifalImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setPreview(await previewParsifalImport(file, criteria));
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : "Could not read this file.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      onImported(await executeParsifalImport(preview));
      close(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  const counts = SCREENING_STATUSES.map((status) => ({
    status,
    count: preview?.rows.filter((row) => row.record.status === status).length ?? 0,
  }));

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import screening from Parsifal</DialogTitle>
          <DialogDescription>
            Upload the articles export (.xls or .xlsx). Records already imported for the same database and DOI are updated, not duplicated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input ref={inputRef} type="file" accept=".xls,.xlsx" aria-label="Parsifal export file" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Upload className="mr-2 h-4 w-4" />{preview ? `Change file (${preview.fileName})` : "Choose file"}
          </Button>

          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

          {preview ? (
            <div className="space-y-3 text-sm">
              <p><strong>{preview.rows.length}</strong> of {preview.totalRows} rows can be imported.</p>
              <div className="grid grid-cols-2 gap-2">
                {counts.map(({ status, count }) => (
                  <div key={status} className="rounded border px-3 py-2">{SCREENING_STATUS_LABELS[status]}: <strong>{count}</strong></div>
                ))}
              </div>
              {preview.invalid.length > 0 ? (
                <p className="text-muted-foreground">{preview.invalid.length} rows skipped (no title and no DOI).</p>
              ) : null}
              {preview.unmatchedCriteria.length > 0 ? (
                <div className="rounded border border-dashed p-3">
                  <p className="font-medium">Criteria not found in the protocol ({preview.unmatchedCriteria.length})</p>
                  <p className="text-muted-foreground">These records are imported without a criterion code. Add the criteria to the Protocol first to keep them.</p>
                  <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                    {preview.unmatchedCriteria.slice(0, 5).map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={busy}>Cancel</Button>
          <Button onClick={confirm} disabled={!preview || preview.rows.length === 0 || busy}>{busy ? "Working..." : "Import"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportDialog;
