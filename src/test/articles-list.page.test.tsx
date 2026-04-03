import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  fetchArticlesPageMock: vi.fn(),
  fetchFilterOptionsMock: vi.fn(),
  deleteArticleMock: vi.fn(),
  exportCurrentUserArticlesToExcelMock: vi.fn(),
  syncCurrentUserDoiMetadataMock: vi.fn(),
  fetchArticleSummariesMock: vi.fn(),
  previewArticlesExcelImportMock: vi.fn(),
  executeArticlesExcelImportMock: vi.fn(),
  invalidateQueriesMock: vi.fn(),
  fetchQueryMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey[0] === "articles" && queryKey.includes("page")) {
      return {
        data: {
          data: [
            {
              id: "article-1",
              title: "Sample Article",
              author: "Author A",
              first_author: "Author A",
              study_id: "S-1",
              country: "Brazil",
              prosthesis_name: "Neuro Arm",
              year: 2025,
              is_draft: false,
              created_at: "2026-03-01T10:00:00.000Z",
              updated_at: "2026-03-01T10:00:00.000Z",
              verify_peer1: true,
              verify_peer2: false,
              verify_qa3: true,
              verify_qa4: false,
              qa_score: 7,
            },
          ],
          count: 1,
        },
        isLoading: false,
      };
    }

    if (queryKey[0] === "articles" && queryKey.includes("filters-options")) {
      return { data: [], isLoading: false };
    }

    return { data: undefined, isLoading: false };
  },
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueriesMock,
    fetchQuery: mocks.fetchQueryMock,
  }),
}));

vi.mock("@/lib/articles", async () => {
  const actual = await vi.importActual("@/lib/articles");
  return {
    ...actual,
    fetchArticlesPage: mocks.fetchArticlesPageMock,
    fetchFilterOptions: mocks.fetchFilterOptionsMock,
    deleteArticle: mocks.deleteArticleMock,
    exportCurrentUserArticlesToExcel: mocks.exportCurrentUserArticlesToExcelMock,
    syncCurrentUserDoiMetadata: mocks.syncCurrentUserDoiMetadataMock,
    fetchArticleSummaries: mocks.fetchArticleSummariesMock,
  };
});

vi.mock("@/lib/articles-import", () => ({
  previewArticlesExcelImport: mocks.previewArticlesExcelImportMock,
  executeArticlesExcelImport: mocks.executeArticlesExcelImportMock,
}));

import ArticlesList from "@/pages/ArticlesList";

describe("ArticlesList", () => {
  beforeEach(() => {
    mocks.invalidateQueriesMock.mockReset();
    mocks.fetchQueryMock.mockReset();
    mocks.previewArticlesExcelImportMock.mockReset();
    mocks.executeArticlesExcelImportMock.mockReset();
  });

  it("renders Sync DOI Metadata action in header", () => {
    render(
      <MemoryRouter>
        <ArticlesList />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /Sync DOI Metadata/i })).toBeInTheDocument();
  });

  it("renders Import Excel action in header", () => {
    render(
      <MemoryRouter>
        <ArticlesList />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /Import Excel/i })).toBeInTheDocument();
  });

  it("opens import preview dialog and runs default import mode", async () => {
    mocks.previewArticlesExcelImportMock.mockResolvedValue({
      fileName: "articles-export.xlsx",
      totalRows: 4,
      validRows: [{ rowNumber: 2, payload: { title: "A" }, duplicateField: null, duplicateValue: null }],
      possibleDuplicateRows: [{ rowNumber: 3, payload: { title: "B" }, duplicateField: "doi", duplicateValue: "10.1000/dup" }],
      duplicateInFileRows: [{ rowNumber: 4, payload: { title: "C" }, duplicateField: "study_id", duplicateValue: "s-1" }],
      invalidRows: [{ rowNumber: 5, reason: "year: invalid" }],
      duplicateCandidates: [],
    });
    mocks.executeArticlesExcelImportMock.mockResolvedValue({
      attempted: 1,
      imported: 1,
      skippedDuplicates: 2,
      invalid: 1,
      failed: 0,
      failures: [],
    });

    render(
      <MemoryRouter>
        <ArticlesList />
      </MemoryRouter>,
    );

    const file = new File(["excel-content"], "articles-export.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const input = screen.getByLabelText("Import Excel file");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Import Excel" })).toBeInTheDocument();
      expect(screen.getByText(/Rows in file:/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Import Without Duplicates/i }));

    await waitFor(() => {
      expect(mocks.executeArticlesExcelImportMock).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: "articles-export.xlsx" }),
        "skip_duplicates",
      );
      expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["articles", "no-user"] });
    });
  });
});
