import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  saveMock: vi.fn(),
  membersMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/active-review", () => ({ getActiveReviewId: () => "review-1", setActiveReviewId: vi.fn(), requireActiveReviewId: () => "review-1" }));
vi.mock("@/lib/reviews", () => ({ fetchReviewMembers: mocks.membersMock }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/qa-assessments", async () => {
  const actual = await vi.importActual<typeof import("@/lib/qa-assessments")>("@/lib/qa-assessments");
  return { ...actual, fetchQaAssessments: mocks.fetchMock, saveQaAssessment: mocks.saveMock };
});

import QaAssessmentPanel from "@/components/article/QaAssessmentPanel";
import { AuthUserIdProvider } from "@/contexts/auth-user-id";
import { answersOf, compareAnswers } from "@/lib/qa-assessments";
import { QA_QUESTIONS } from "@/lib/qa-questions";

const questions = QA_QUESTIONS.map((question) => ({ key: question.key, label: question.label, description: question.description }));

const members = [
  { user_id: "u1", role: "reviewer", email: "gabi@x.com", full_name: "Gabi", reviewer_slot: 1 },
  { user_id: "u2", role: "owner", email: "thabata@x.com", full_name: "Thabata", reviewer_slot: 2 },
];

const row = (slot: number, overrides: Record<string, string | null>) => ({
  id: `row-${slot}`, article_id: "a1", review_id: "review-1", reviewer_slot: slot, reviewer_id: null, qa_score: null,
  created_at: "", updated_at: "", ...Object.fromEntries(QA_QUESTIONS.map((question) => [question.key, null])), ...overrides,
});

function renderPanel(userId: string, onUseAnswer = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AuthUserIdProvider userId={userId}>
        <QaAssessmentPanel articleId="a1" questions={questions} finalAnswers={answersOf(null)} onUseAnswer={onUseAnswer} />
      </AuthUserIdProvider>
    </QueryClientProvider>,
  );
  return onUseAnswer;
}

describe("compareAnswers", () => {
  it("counts only items both reviewers answered", () => {
    const first = answersOf({ qa_q1: "Yes", qa_q2: "No", qa_q3: "Partial" });
    const second = answersOf({ qa_q1: "Yes", qa_q2: "Yes", qa_q4: "No" });
    expect(compareAnswers(first, second)).toEqual({ answered: 2, agree: 1, differing: ["qa_q2"] });
  });
});

describe("QaAssessmentPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.membersMock.mockResolvedValue(members);
    mocks.saveMock.mockResolvedValue(undefined);
  });

  it("saves the reviewer's own assessment under their slot", async () => {
    mocks.fetchMock.mockResolvedValue([]);
    renderPanel("u1");

    expect(await screen.findByText(/Your assessment \(Reviewer 1\)/)).toBeInTheDocument();
    fireEvent.click(document.querySelector("#mine-qa_q1-Yes") as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Save my assessment" }));

    await waitFor(() => expect(mocks.saveMock).toHaveBeenCalled());
    const [articleId, slot, answers] = mocks.saveMock.mock.calls[0];
    expect(articleId).toBe("a1");
    expect(slot).toBe(1);
    expect(answers.qa_q1).toBe("Yes");
  });

  it("tells the reviewer the other assessment is not visible yet", async () => {
    mocks.fetchMock.mockResolvedValue([row(1, { qa_q1: "Yes" })]);
    renderPanel("u1");
    expect(await screen.findByText(/appears here once you finish yours/)).toBeInTheDocument();
  });

  it("compares both assessments and copies an answer to the final QA", async () => {
    mocks.fetchMock.mockResolvedValue([row(1, { qa_q1: "Yes", qa_q2: "Yes" }), row(2, { qa_q1: "No", qa_q2: "Yes" })]);
    const onUse = renderPanel("u2");

    expect(await screen.findByText("1 of 2 agree")).toBeInTheDocument();
    const differing = document.querySelector('tr[data-differs="true"]') as HTMLElement;
    expect(differing).toBeInTheDocument();
    fireEvent.click(differing.querySelectorAll("button")[0]);
    expect(onUse).toHaveBeenCalledWith("qa_q1", "Yes");
  });

  it("explains how to get a reviewer number when none is assigned", async () => {
    mocks.fetchMock.mockResolvedValue([]);
    mocks.membersMock.mockResolvedValue([{ user_id: "u3", role: "reviewer", email: "new@x.com", full_name: null, reviewer_slot: null }]);
    renderPanel("u3");
    expect(await screen.findByText(/Ask the owner to assign you as Reviewer 1 or 2/)).toBeInTheDocument();
  });
});
