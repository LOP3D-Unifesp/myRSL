import { describe, expect, it } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { ARTICLE_EXPORT_HEADERS, createArticlesExportFileName, mapArticleToExportRow } from "@/lib/articles-export";

type ArticleRow = Database["public"]["Tables"]["articles"]["Row"];

function createArticleFixture(overrides: Partial<ArticleRow> = {}): ArticleRow {
  return {
    id: "article-1",
    user_id: "user-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    is_draft: false,
    review_status: "pending",
    pdf_url: null,
    doi: null,
    title: "Paper",
    abstract: null,
    study_id: null,
    author: "Alice",
    first_author: "Alice",
    last_author: null,
    universities: null,
    publication_place: null,
    year: 2025,
    country: "Brazil",
    publication_type: null,
    study_design: null,
    has_pediatric_participants: null,
    sample_size: null,
    age_range: null,
    amputation_cause: [],
    amputation_level: [],
    pediatric_approach: null,
    prosthesis_name: null,
    prosthesis_level: null,
    dof: null,
    control_strategy: [],
    sensors: [],
    sensors_used: null,
    technical_innovation: null,
    feedback_modalities: [],
    feedback_modalities_text: null,
    manufacturing_method: null,
    growth_accommodation: null,
    setting: [],
    functional_tests: [],
    statistical_tests_performed: null,
    statistical_tests_specified: null,
    quantitative_results: null,
    usage_outcomes: null,
    gaps: null,
    technical_challenges: null,
    primary_research_question: null,
    research_questions: [],
    verify_peer1: false,
    verify_peer2: true,
    verify_qa3: false,
    verify_qa4: true,
    qa_q1: null,
    qa_q2: null,
    qa_q3: null,
    qa_q4: null,
    qa_q5: null,
    qa_q6: null,
    qa_q7: null,
    qa_q8: null,
    qa_q9: null,
    qa_q10: null,
    qa_score: null,
    q1: null,
    q2: null,
    q3: null,
    q4: null,
    q5: null,
    ...overrides,
  };
}

describe("articles export mapping", () => {
  it("keeps stable column order and normalizes arrays/nulls", () => {
    const article = createArticleFixture({
      sensors: ["EMG", "IMU"],
      research_questions: ["Q1", "Q6"],
      abstract: null,
    });
    const row = mapArticleToExportRow(article);

    expect(Object.keys(row)).toEqual(ARTICLE_EXPORT_HEADERS);
    expect(row.sensors).toBe("EMG; IMU");
    expect(row.research_questions).toBe("Q1; Q6");
    expect(row.abstract).toBe("");
    expect(row.verify_peer2).toBe(true);
  });

  it("uses first author fallback from authors list only for export view", () => {
    const article = createArticleFixture({
      author: "Ana Oliveira; Bruno Silva",
      first_author: null,
    });

    const row = mapArticleToExportRow(article);

    expect(row.author).toBe("Ana Oliveira; Bruno Silva");
    expect(row.first_author).toBe("Ana Oliveira");
  });

  it("builds deterministic export filename format", () => {
    const name = createArticlesExportFileName(new Date(2026, 3, 2, 14, 5, 0));
    expect(name).toBe("articles-export-20260402-1405.xlsx");
  });
});
