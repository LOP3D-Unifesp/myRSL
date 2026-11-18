import type { Article } from "@/lib/articles";
import { DetailRow, ExpandableRow, TagRow } from "@/components/article/detail-rows";

export function ArticleOverviewTab({ article }: { article: Article }) {
  return (
    <div className="space-y-3">
      <DetailRow label="Primary Question" value={article.primary_research_question} />
      <TagRow label="Research Questions" values={article.research_questions} />
      <DetailRow label="DOI" value={article.doi} link={article.doi ? `https://doi.org/${article.doi}` : undefined} />
      <DetailRow label="Authors" value={article.author} />
      <DetailRow label="Last Author" value={article.last_author} />
      <DetailRow label="Universities" value={article.universities} />
      <DetailRow label="Publication Type" value={article.publication_type} />
      <DetailRow label="Study Design" value={article.study_design} />
      <DetailRow label="Publication Place" value={article.publication_place} />
      <ExpandableRow label="Abstract" value={article.abstract} />
    </div>
  );
}
