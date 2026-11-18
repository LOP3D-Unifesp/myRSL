import { Badge } from "@/components/ui/badge";
import type { Article } from "@/lib/articles";

type Props = {
  article: Article;
  fullyVerified: boolean;
  articleTitle: string;
  citationLabel: string;
};

export function ArticleDetailHeader({ article, fullyVerified, articleTitle, citationLabel }: Props) {
  const meta = [article.source_database, article.country].filter(Boolean).join(" · ");
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{article.study_id || "No Study ID"}</Badge>
        {fullyVerified
          ? <Badge className="bg-accent text-accent-foreground">Verified</Badge>
          : <Badge className="bg-warning text-warning-foreground">Pending Review</Badge>}
      </div>
      <h1 className="text-2xl font-bold text-foreground md:text-3xl">{articleTitle}</h1>
      <p className="text-base text-muted-foreground">
        {citationLabel}
        {meta ? <span> · {meta}</span> : null}
      </p>
    </div>
  );
}
