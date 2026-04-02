import { describe, expect, it } from "vitest";
import type { Article } from "@/lib/articles";
import { groupArticlesForCrossAnalysis } from "@/components/CrossAnalysis";

let articleCounter = 0;

function makeArticle(overrides: Partial<Article>): Article {
  articleCounter += 1;
  return {
    id: `article-${articleCounter}`,
    user_id: "user-1",
    is_draft: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    study_id: null,
    author: null,
    first_author: null,
    last_author: null,
    universities: null,
    publication_place: null,
    year: null,
    country: null,
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
    technical_innovation: null,
    feedback_modalities: [],
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
    pdf_url: null,
    title: null,
    abstract: null,
    review_status: "pending",
    doi: null,
    sensors_used: null,
    feedback_modalities_text: null,
    verify_peer1: false,
    verify_peer2: false,
    verify_qa3: false,
    verify_qa4: false,
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

describe("groupArticlesForCrossAnalysis", () => {
  it("splits author list into individual author groups", () => {
    const articles = [makeArticle({ author: "Kenji Suzuki; Paul F. Pasquina" })];

    const groups = groupArticlesForCrossAnalysis(articles, "author");
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.name).sort()).toEqual(["Kenji Suzuki", "Paul F. Pasquina"]);
  });

  it("merges author variants by spacing and case", () => {
    const articles = [
      makeArticle({ author: " Kenji Suzuki " }),
      makeArticle({ author: "KENJI SUZUKI" }),
      makeArticle({ author: "kenji    suzuki" }),
    ];

    const groups = groupArticlesForCrossAnalysis(articles, "author");
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("Kenji Suzuki");
    expect(groups[0].items).toHaveLength(3);
  });

  it("uses first_author fallback when author is empty", () => {
    const articles = [makeArticle({ author: null, first_author: "Yinlai Jiang" })];

    const groups = groupArticlesForCrossAnalysis(articles, "author");
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("Yinlai Jiang");
  });

  it("uses Unknown when author and first_author are both missing", () => {
    const articles = [makeArticle({ author: null, first_author: null })];

    const groups = groupArticlesForCrossAnalysis(articles, "author");
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("Unknown");
  });

  it("merges case variants for last author", () => {
    const articles = [
      makeArticle({ last_author: "Kenji Suzuki" }),
      makeArticle({ last_author: "KENJI SUZUKI" }),
      makeArticle({ last_author: "kenji suzuki" }),
    ];

    const groups = groupArticlesForCrossAnalysis(articles, "last_author");
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("Kenji Suzuki");
    expect(groups[0].items).toHaveLength(3);
  });

  it("merges spacing and case variants for university", () => {
    const articles = [
      makeArticle({ universities: " University X " }),
      makeArticle({ universities: "university x" }),
    ];

    const groups = groupArticlesForCrossAnalysis(articles, "university");
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("University X");
    expect(groups[0].items).toHaveLength(2);
  });

  it("renders group labels in title case", () => {
    const articles = [makeArticle({ primary_research_question: "q6 - technical challenges" })];
    const groups = groupArticlesForCrossAnalysis(articles, "primary_rq");
    expect(groups[0].name).toBe("Q6 - Technical Challenges");
  });
});
