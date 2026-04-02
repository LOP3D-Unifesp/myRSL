import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Article } from "@/lib/articles";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  invalidateQueriesMock: vi.fn(),
  updateArticleMock: vi.fn(),
  navigateMock: vi.fn(),
}));

const articleFixture: Article = {
  id: "article-1",
  user_id: "user-1",
  is_draft: false,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
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
  title: "Paper title",
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
};

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: articleFixture, isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueriesMock }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ id: "article-1" }),
    useNavigate: () => mocks.navigateMock,
  };
});

vi.mock("@/lib/articles", async () => {
  const actual = await vi.importActual("@/lib/articles");
  return {
    ...actual,
    fetchArticle: vi.fn(),
    updateArticle: mocks.updateArticleMock,
  };
});

vi.mock("@/lib/pdf-storage", () => ({
  getPdfAccessUrl: vi.fn().mockResolvedValue(null),
}));

import ArticleDetail from "@/pages/ArticleDetail";

describe("ArticleDetail", () => {
  it("toggles verification and calls updateArticle", async () => {
    mocks.updateArticleMock.mockResolvedValue({ ...articleFixture, verify_peer1: true });
    render(
      <MemoryRouter>
        <ArticleDetail />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Peer 1/i }));

    await waitFor(() => {
      expect(mocks.updateArticleMock).toHaveBeenCalledWith("article-1", { verify_peer1: true });
      expect(mocks.invalidateQueriesMock).toHaveBeenCalled();
    });
  });
});
