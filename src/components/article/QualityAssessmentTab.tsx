import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { QA_QUESTIONS, calculateQAScore, type QAKey } from "@/lib/qa-questions";
import { updateArticle } from "@/lib/articles";
import { toast } from "sonner";
import type { Article } from "@/lib/articles";

interface Props {
  article: Article;
  onUpdated: () => void;
}

const QualityAssessmentTab = ({ article, onUpdated }: Props) => {
  const [answers, setAnswers] = useState<Record<QAKey, string | null>>({} as Record<QAKey, string | null>);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const initial = {} as Record<QAKey, string | null>;
    for (const q of QA_QUESTIONS) {
      initial[q.key] = article[q.key];
    }
    setAnswers(initial);
  }, [article]);

  const score = calculateQAScore(answers);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateArticle(article.id, { ...answers, qa_score: score });
      toast.success("Quality assessment saved!");
      onUpdated();
    } catch {
      toast.error("Failed to save assessment");
    } finally {
      setSaving(false);
    }
  };

  const scoreColor = score >= 7 ? "text-green-600" : score >= 4 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-serif font-semibold">Quality Assessment</h3>
          <Badge variant="outline" className={`text-base font-bold ${scoreColor}`}>
            {score} / 10
          </Badge>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          <Save className="mr-1 h-4 w-4" /> Save QA
        </Button>
      </div>

      {QA_QUESTIONS.map((q) => (
        <Card key={q.key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{q.label}</CardTitle>
            <p className="text-xs text-muted-foreground">{q.description}</p>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={answers[q.key] ?? ""}
              onValueChange={(v) => setAnswers((prev) => ({ ...prev, [q.key]: v }))}
              className="flex gap-6"
            >
              {["Yes", "Partial", "No"].map((opt) => (
                <div key={opt} className="flex items-center gap-2">
                  <RadioGroupItem value={opt} id={`${q.key}-${opt}`} />
                  <Label htmlFor={`${q.key}-${opt}`} className="font-normal cursor-pointer">
                    {opt} {opt === "Yes" ? "(1)" : opt === "Partial" ? "(0.5)" : "(0)"}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default QualityAssessmentTab;
