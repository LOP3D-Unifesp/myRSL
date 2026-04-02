import { z } from "zod";

const optionalString = z.string().max(5000).nullable().optional();
const optionalShortString = z.string().max(500).nullable().optional();
const optionalStringArray = z.array(z.string().max(200)).max(50).nullable().optional();

export const articleWriteSchema = z.object({
  is_draft: z.boolean().optional(),
  study_id: optionalShortString,
  author: optionalShortString,
  first_author: optionalShortString,
  last_author: optionalShortString,
  universities: optionalString,
  publication_place: optionalShortString,
  year: z.number().int().min(1800).max(2100).nullable().optional(),
  country: optionalShortString,
  publication_type: optionalShortString,
  study_design: optionalShortString,
  has_pediatric_participants: optionalShortString,
  sample_size: z.number().int().min(0).max(1000000).nullable().optional(),
  age_range: optionalShortString,
  amputation_cause: optionalStringArray,
  amputation_level: optionalStringArray,
  pediatric_approach: optionalString,
  prosthesis_name: optionalShortString,
  prosthesis_level: optionalShortString,
  dof: optionalShortString,
  control_strategy: optionalStringArray,
  sensors: optionalStringArray,
  sensors_used: optionalString,
  technical_innovation: optionalString,
  feedback_modalities: optionalStringArray,
  feedback_modalities_text: optionalString,
  manufacturing_method: optionalString,
  growth_accommodation: optionalShortString,
  setting: optionalStringArray,
  functional_tests: optionalStringArray,
  statistical_tests_performed: optionalShortString,
  statistical_tests_specified: optionalString,
  quantitative_results: optionalString,
  usage_outcomes: optionalString,
  gaps: optionalString,
  technical_challenges: optionalString,
  primary_research_question: optionalShortString,
  research_questions: optionalStringArray,
  pdf_url: optionalString,
  title: optionalString,
  abstract: optionalString,
  review_status: optionalShortString,
  doi: optionalShortString,
  verify_peer1: z.boolean().optional(),
  verify_peer2: z.boolean().optional(),
  verify_qa3: z.boolean().optional(),
  verify_qa4: z.boolean().optional(),
  qa_q1: optionalShortString,
  qa_q2: optionalShortString,
  qa_q3: optionalShortString,
  qa_q4: optionalShortString,
  qa_q5: optionalShortString,
  qa_q6: optionalShortString,
  qa_q7: optionalShortString,
  qa_q8: optionalShortString,
  qa_q9: optionalShortString,
  qa_q10: optionalShortString,
  qa_score: z.number().min(0).max(10).nullable().optional(),
  q1: optionalString,
  q2: optionalString,
  q3: optionalString,
  q4: optionalString,
  q5: optionalString,
});

export type ArticleWriteInput = z.infer<typeof articleWriteSchema>;

export const extractedArticleSchema = articleWriteSchema.partial();
export type ExtractedArticleInput = z.infer<typeof extractedArticleSchema>;

export function sanitizeArticleWriteInput(input: unknown): ArticleWriteInput {
  return articleWriteSchema.parse(input);
}

export function sanitizeExtractedArticle(input: unknown): ExtractedArticleInput {
  return extractedArticleSchema.parse(input);
}
