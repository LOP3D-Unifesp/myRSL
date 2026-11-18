import { Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import VerificationToggles, { type VerificationStamp } from "@/components/article/VerificationToggles";
import { QA_STATUS_LABELS, qaStatusOf } from "@/lib/qa-status";
import type { VerificationKey } from "@/lib/article-verification";

type Props = {
  qaScore: number;
  qaTone: string;
  decidedQaItems: number;
  totalQaItems: number;
  consensusStatus: string | null | undefined;
  verificationProgress: number;
  verification: Record<VerificationKey, boolean>;
  stamps: Partial<Record<VerificationKey, VerificationStamp>>;
  names: Map<string, string>;
  locked: Set<VerificationKey>;
  samePeerReviewer: boolean;
  onToggleVerification: (key: VerificationKey) => void;
  sessionState: string;
  sessionBadgeTone: string;
  savedAgo: string | null;
};

// One flat row: QA score + consensus | verification | editing state.
export function ArticleSummaryStrip(props: Props) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="grid gap-5 py-4 lg:grid-cols-12 lg:gap-6">
        <div className="space-y-1 lg:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Final QA score</p>
          <p className={`text-3xl font-semibold ${props.qaTone}`}>{props.qaScore} / 10</p>
          <Badge variant="outline" className="text-xs" data-testid="qa-consensus-status">
            {QA_STATUS_LABELS[qaStatusOf(props.consensusStatus)]}
          </Badge>
          {props.decidedQaItems < props.totalQaItems ? (
            <p className="text-xs text-muted-foreground">{props.decidedQaItems} of {props.totalQaItems} items decided</p>
          ) : null}
        </div>

        <div className="space-y-2 lg:col-span-7">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Review verification</p>
            <Badge variant="outline">{props.verificationProgress}/4 complete</Badge>
          </div>
          <VerificationToggles values={props.verification} onToggle={props.onToggleVerification} stamps={props.stamps} names={props.names} locked={props.locked} />
          {props.samePeerReviewer ? (
            <p className="text-xs text-warning-foreground" role="status">Peer 1 and Peer 2 were verified by the same person.</p>
          ) : null}
        </div>

        <div className="space-y-2 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Session</p>
          <Badge variant="outline" className={props.sessionBadgeTone}>{props.sessionState}</Badge>
          {props.savedAgo ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock3 className="h-3 w-3" /> Saved {props.savedAgo}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
