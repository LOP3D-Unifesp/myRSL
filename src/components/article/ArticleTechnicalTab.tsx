import type { Article } from "@/lib/articles";
import { DetailRow, ExpandableRow, TagRow } from "@/components/article/detail-rows";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="border-b border-border/60 pb-1 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

export function ArticleTechnicalTab({ article }: { article: Article }) {
  return (
    <div className="space-y-6">
      <Group title="Technical">
        <DetailRow label="Prosthesis" value={article.prosthesis_name} />
        <DetailRow label="Level" value={article.prosthesis_level} />
        <DetailRow label="DOF" value={article.dof} />
        <TagRow label="Control Strategy" values={article.control_strategy} />
        <TagRow label="Sensors" values={article.sensors} />
        <TagRow label="Feedback" values={article.feedback_modalities} />
        <DetailRow label="Manufacturing" value={article.manufacturing_method} />
        <DetailRow label="Growth Accommodation" value={article.growth_accommodation} />
        <ExpandableRow label="Technical Innovation" value={article.technical_innovation} />
        <ExpandableRow label="Challenges & Solutions" value={article.technical_challenges} />
      </Group>

      <Group title="Outcomes">
        <DetailRow label="Pediatric Participants" value={article.has_pediatric_participants} />
        <DetailRow label="Sample Size" value={article.sample_size?.toString()} />
        <DetailRow label="Age Range" value={article.age_range} />
        <TagRow label="Amputation Cause" values={article.amputation_cause} />
        <TagRow label="Amputation Level" values={article.amputation_level} />
        <TagRow label="Setting" values={article.setting || []} />
        <TagRow label="Functional Tests" values={article.functional_tests} />
        <DetailRow label="Inferential Tests" value={article.statistical_tests_performed} />
        <ExpandableRow label="Statistical Tests Specified" value={article.statistical_tests_specified} />
        <ExpandableRow label="Quantitative Results" value={article.quantitative_results} />
        <ExpandableRow label="Usage Outcomes" value={article.usage_outcomes} />
        <ExpandableRow label="Main Gaps" value={article.gaps} />
      </Group>
    </div>
  );
}
