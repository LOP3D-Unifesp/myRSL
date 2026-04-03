import { Badge } from "@/components/ui/badge";
import type { Article } from "@/lib/articles";

type Props = {
  article: Article;
  fullyVerified: boolean;
  articleTitle: string;
  citationLabel: string;
  primaryQuestion: string | null;
  researchQuestions: string[];
};

export function ArticleDetailHeader({ article, fullyVerified, articleTitle, citationLabel, primaryQuestion, researchQuestions }: Props) {
  return (
    <div className="min-w-0 flex-1 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{article.study_id || "No Study ID"}</Badge>
        {fullyVerified
          ? <Badge className="bg-accent text-accent-foreground">Verified</Badge>
          : <Badge className="bg-warning text-warning-foreground">Pending Review</Badge>}
        {article.year ? <Badge variant="secondary">{article.year}</Badge> : null}
        {article.country ? <Badge variant="secondary">{article.country}</Badge> : null}
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">{articleTitle}</h1>
        <p className="text-base text-muted-foreground">{citationLabel}</p>

        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Primary question</p>
            {primaryQuestion ? (
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="max-w-full whitespace-normal break-words">{primaryQuestion}</Badge>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not set</p>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Research Questions</p>
            {researchQuestions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {researchQuestions.map((question) => (
                  <Badge key={question} variant="outline" className="max-w-full whitespace-normal break-words">{question}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not set</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
