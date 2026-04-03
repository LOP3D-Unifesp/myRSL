import { describe, expect, it, vi, beforeEach } from "vitest";
import * as XLSX from "xlsx";
import { ARTICLE_EXPORT_HEADERS } from "@/lib/articles-export";

const mocks = vi.hoisted(() => ({
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  insertMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.fromMock,
    auth: {
      getUser: mocks.getUserMock,
    },
  },
}));

import { executeArticlesExcelImport, previewArticlesExcelImport, type ImportPreview } from "@/lib/articles-import";

function createExcelFile(rows: Array<Record<string, unknown>>, fileName = "articles-export.xlsx"): File {
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: ARTICLE_EXPORT_HEADERS });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Articles");
  const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new File([arrayBuffer], fileName, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("articles import", () => {
  beforeEach(() => {
    mocks.fromMock.mockReset();
    mocks.selectMock.mockReset();
    mocks.insertMock.mockReset();
    mocks.getUserMock.mockReset();

    mocks.fromMock.mockImplementation(() => ({
      select: mocks.selectMock,
      insert: mocks.insertMock,
    }));
  });

  it("builds preview with normalized values and duplicate classification", async () => {
    mocks.selectMock.mockResolvedValue({
      data: [{ doi: "10.1000/abc", study_id: "S-EXISTING" }],
      error: null,
    });

    const file = createExcelFile([
      { id: "old-id-1", user_id: "old-user", doi: "10.1000/abc", title: "Duplicate DOI" },
      {
        id: "old-id-2",
        user_id: "old-user",
        study_id: "S-NEW",
        title: "Valid row",
        sensors: "EMG; IMU",
        verify_peer1: "1",
        verify_peer2: "false",
        year: "2024",
        sample_size: "42",
        qa_score: "7.5",
      },
      { id: "old-id-3", user_id: "old-user", study_id: "S-NEW", title: "Duplicate in same file" },
      { id: "old-id-4", user_id: "old-user", title: "Invalid year", year: "3001" },
    ]);

    const preview = await previewArticlesExcelImport(file);

    expect(preview.totalRows).toBe(4);
    expect(preview.validRows).toHaveLength(1);
    expect(preview.possibleDuplicateRows).toHaveLength(1);
    expect(preview.duplicateInFileRows).toHaveLength(1);
    expect(preview.invalidRows).toHaveLength(1);

    const validPayload = preview.validRows[0].payload as Record<string, unknown>;
    expect(validPayload.sensors).toEqual(["EMG", "IMU"]);
    expect(validPayload.verify_peer1).toBe(true);
    expect(validPayload.verify_peer2).toBe(false);
    expect(validPayload.year).toBe(2024);
    expect(validPayload.sample_size).toBe(42);
    expect(validPayload.qa_score).toBe(7.5);
    expect("id" in validPayload).toBe(false);
    expect("user_id" in validPayload).toBe(false);
    expect("created_at" in validPayload).toBe(false);
    expect("updated_at" in validPayload).toBe(false);
    expect("pdf_url" in validPayload).toBe(false);
    expect(preview.invalidRows[0].reason.toLowerCase()).toContain("year");
  });

  it("executes partial import with both modes and tracks failures", async () => {
    const preview: ImportPreview = {
      fileName: "articles-export.xlsx",
      totalRows: 4,
      validRows: [
        { rowNumber: 2, payload: { title: "A", study_id: "S-1" }, duplicateField: "study_id", duplicateValue: "s-1" },
      ],
      possibleDuplicateRows: [
        { rowNumber: 3, payload: { title: "B", doi: "10.1000/dup" }, duplicateField: "doi", duplicateValue: "10.1000/dup" },
      ],
      duplicateInFileRows: [
        { rowNumber: 4, payload: { title: "C", study_id: "S-1" }, duplicateField: "study_id", duplicateValue: "s-1" },
      ],
      invalidRows: [{ rowNumber: 5, reason: "year: Number must be less than or equal to 2100" }],
      duplicateCandidates: [],
    };

    mocks.getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mocks.insertMock.mockResolvedValue({ error: null });

    const skipResult = await executeArticlesExcelImport(preview, "skip_duplicates");
    expect(skipResult.attempted).toBe(1);
    expect(skipResult.imported).toBe(1);
    expect(skipResult.skippedDuplicates).toBe(2);
    expect(skipResult.invalid).toBe(1);
    expect(skipResult.failed).toBe(0);
    expect(mocks.insertMock).toHaveBeenCalledTimes(1);

    mocks.insertMock.mockReset();
    mocks.insertMock
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "duplicate key value violates unique constraint" } })
      .mockResolvedValueOnce({ error: null });

    const importAllResult = await executeArticlesExcelImport(preview, "import_all_duplicates");
    expect(importAllResult.attempted).toBe(3);
    expect(importAllResult.imported).toBe(2);
    expect(importAllResult.skippedDuplicates).toBe(0);
    expect(importAllResult.invalid).toBe(1);
    expect(importAllResult.failed).toBe(1);
    expect(importAllResult.failures[0].rowNumber).toBe(3);
    expect(mocks.insertMock).toHaveBeenCalledTimes(3);
  });
});
