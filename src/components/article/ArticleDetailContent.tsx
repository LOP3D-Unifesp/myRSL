import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Article } from "@/lib/articles";

interface Props {
  article: Article;
}

function deriveFirstAuthorFromAuthors(authors: string | null | undefined): string | null {
  if (!authors) return null;
  const first = authors
    .split(";")
    .map((part) => part.trim())
    .find(Boolean);
  return first || null;
}

const ArticleDetailContent = ({ article }: Props) => {
  return (
    <div className="space-y-4">
      <Section title="Section 1: General Information">
        <Row label="Title" value={article.title} />
        <Row label="DOI" value={article.doi} link={article.doi ? `https://doi.org/${article.doi}` : undefined} />
        {article.abstract && (
          <div className="flex gap-2">
            <span className="text-sm font-medium text-muted-foreground min-w-[200px]">Abstract:</span>
            <p className="text-sm text-foreground whitespace-pre-wrap">{article.abstract}</p>
          </div>
        )}
        <Row label="Study ID" value={article.study_id} />
        <Row label="Author(s)" value={article.author} />
        <Row label="First Author" value={article.first_author || deriveFirstAuthorFromAuthors(article.author)} />
        <Row label="Last Author" value={article.last_author} />
        <Row label="Universities / Research Centers" value={article.universities} />
        <Row label="Country" value={article.country} />
        <Row label="Year" value={article.year?.toString()} />
        <Row label="Place of Publication" value={article.publication_place} />
      </Section>

      <Section title="Section 2: Publication & Study Characteristics">
        <Row label="Publication Type" value={article.publication_type} />
        <Row label="Study Design" value={article.study_design} />
      </Section>

      <Section title="Section 3: Pediatric Implementation">
        <Row label="Pediatric Participants?" value={article.has_pediatric_participants} />
        {article.has_pediatric_participants === "Yes" && (
          <>
            <Row label="Number of Pediatric Participants" value={article.sample_size?.toString()} />
            <Row label="Age Range" value={article.age_range} />
            <Tags label="Cause of Limb Absence" values={article.amputation_cause} />
            <Tags label="Level of Limb Absence" values={article.amputation_level} />
          </>
        )}
        <Row label="Specific Pediatric Approach" value={article.pediatric_approach} />
      </Section>

      <Section title="Section 4: Technical Specifications">
        <Row label="Prosthesis Name / Model" value={article.prosthesis_name} />
        <Row label="Prosthesis Level" value={article.prosthesis_level} />
        <Row label="Degrees of Freedom" value={article.dof} />
        <Tags label="Control Strategy" values={article.control_strategy} />
        <Tags label="Sensors Used" values={article.sensors} />
        <Row label="Sensors (Text)" value={article.sensors_used} />
        <Tags label="Feedback Modalities" values={article.feedback_modalities} />
        <Row label="Feedback Modalities (Text)" value={article.feedback_modalities_text} />
        <Row label="Manufacturing Method" value={article.manufacturing_method} />
        <Row label="Growth Accommodation" value={article.growth_accommodation} />
        <Row label="Technical Innovation" value={article.technical_innovation} />
        <Row label="Technical Challenges & Solutions" value={article.technical_challenges} />
      </Section>

      <Section title="Section 5: Testing, Outcomes & Statistical Analysis">
        <Tags label="Setting of Use / Testing" values={article.setting || []} />
        <Tags label="Standardized Functional Tests" values={article.functional_tests} />
        <Row label="Were INFERENTIAL Statistical Tests Performed?" value={article.statistical_tests_performed} />
        <Row label="Inferential Statistical Tests Specified" value={article.statistical_tests_specified} />
        <Row label="Quantitative Results" value={article.quantitative_results} />
        <Row label="Usage Outcomes" value={article.usage_outcomes} />
        <Row label="Main Gaps" value={article.gaps} />
      </Section>

      <Section title="Section 6: Research Scope">
        <Row label="Primary Research Question" value={article.primary_research_question} />
        <Tags label="All Applicable Research Questions" values={article.research_questions} />
      </Section>
    </div>
  );
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg font-serif">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function Row({ label, value, link }: { label: string; value?: string | null; link?: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <span className="text-sm font-medium text-muted-foreground min-w-[200px]">{label}:</span>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline hover:text-primary/80">
          {value}
        </a>
      ) : (
        <span className="text-sm text-foreground whitespace-pre-wrap">{value}</span>
      )}
    </div>
  );
}

function Tags({ label, values }: { label: string; values?: string[] }) {
  if (!values?.length) return null;
  return (
    <div className="flex gap-2 flex-wrap items-start">
      <span className="text-sm font-medium text-muted-foreground min-w-[200px] pt-0.5">{label}:</span>
      <div className="flex flex-wrap gap-1">
        {values.map((v) => (
          <Badge key={v} variant="secondary" className="text-xs">{v}</Badge>
        ))}
      </div>
    </div>
  );
}

export default ArticleDetailContent;
