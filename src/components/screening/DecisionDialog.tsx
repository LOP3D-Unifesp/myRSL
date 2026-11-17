import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  SCREENING_STATUSES,
  SCREENING_STATUS_LABELS,
  isScreeningStatus,
  type ScreeningDecision,
  type ScreeningRecord,
  type ScreeningStatus,
} from "@/lib/screening";
import type { ProtocolCriterion } from "@/lib/protocol";

const NO_CRITERION = "__none__";

type Props = {
  record: ScreeningRecord | null;
  criteria: ProtocolCriterion[];
  onClose: () => void;
  onSave: (id: string, decision: ScreeningDecision) => Promise<void>;
};

const DecisionDialog = ({ record, criteria, onClose, onSave }: Props) => {
  const [status, setStatus] = useState<ScreeningStatus>("unclassified");
  const [criterion, setCriterion] = useState<string>(NO_CRITERION);
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!record) return;
    setStatus(isScreeningStatus(record.status) ? record.status : "unclassified");
    setCriterion(record.criterion_code ?? NO_CRITERION);
    setComments(record.comments ?? "");
  }, [record]);

  // Accepted records cite an inclusion criterion, rejected ones an exclusion criterion.
  const kind = status === "accepted" ? "inclusion" : status === "rejected" ? "exclusion" : null;
  const options = kind ? criteria.filter((item) => item.kind === kind) : [];

  const submit = async () => {
    if (!record) return;
    setSaving(true);
    try {
      await onSave(record.id, {
        status,
        criterion_code: kind && criterion !== NO_CRITERION ? criterion : null,
        comments: comments.trim() || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(record)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Screening decision</DialogTitle>
          <DialogDescription className="line-clamp-2">{record?.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="decision-status">Decision</Label>
            <Select value={status} onValueChange={(value) => { if (isScreeningStatus(value)) { setStatus(value); setCriterion(NO_CRITERION); } }}>
              <SelectTrigger id="decision-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCREENING_STATUSES.map((item) => <SelectItem key={item} value={item}>{SCREENING_STATUS_LABELS[item]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {kind ? (
            <div className="space-y-2">
              <Label htmlFor="decision-criterion">{kind === "inclusion" ? "Inclusion criterion" : "Exclusion criterion"}</Label>
              <Select value={criterion} onValueChange={setCriterion}>
                <SelectTrigger id="decision-criterion"><SelectValue placeholder="Select a criterion" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CRITERION}>Not specified</SelectItem>
                  {options.map((item) => (
                    <SelectItem key={item.code} value={item.code}>
                      {item.code} - {item.text.length > 90 ? `${item.text.slice(0, 90)}...` : item.text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="decision-comments">Comments</Label>
            <Textarea id="decision-comments" rows={3} value={comments} onChange={(e) => setComments(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save decision"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DecisionDialog;
