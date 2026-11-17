import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { inActiveReview } from "@/lib/articles";

export type ScreeningRecord = Database["public"]["Tables"]["screening_records"]["Row"];

export const SCREENING_STATUSES = ["accepted", "rejected", "duplicate", "unclassified"] as const;
export type ScreeningStatus = (typeof SCREENING_STATUSES)[number];

export const SCREENING_STATUS_LABELS: Record<ScreeningStatus, string> = {
  accepted: "Accepted",
  rejected: "Rejected",
  duplicate: "Duplicate",
  unclassified: "Unclassified",
};

export function isScreeningStatus(value: string): value is ScreeningStatus {
  return (SCREENING_STATUSES as readonly string[]).includes(value);
}

export async function fetchScreeningRecords(): Promise<ScreeningRecord[]> {
  const { data, error } = await inActiveReview(supabase.from("screening_records").select("*"))
    .order("source_database")
    .order("title");
  if (error) throw error;
  return data ?? [];
}

export type ScreeningDecision = {
  status: ScreeningStatus;
  criterion_code: string | null;
  comments: string | null;
};

export async function saveScreeningDecision(id: string, decision: ScreeningDecision): Promise<ScreeningRecord> {
  const { data: authData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("screening_records")
    .update({ ...decision, screened_by: authData.user?.id ?? null, screened_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function linkRecordToArticle(recordId: string, articleId: string): Promise<void> {
  const { error } = await supabase.from("screening_records").update({ article_id: articleId }).eq("id", recordId);
  if (error) throw error;
}

export type PrismaCriterionCount = { code: string; text: string; count: number };

export type PrismaCounts = {
  identified: number;
  bySource: Array<{ source: string; count: number }>;
  duplicates: number;
  screened: number;
  excluded: number;
  excludedByCriterion: PrismaCriterionCount[];
  unclassified: number;
  included: number;
  extracted: number;
};

// Numbers for the PRISMA flow: identified -> duplicates removed -> screened -> excluded / included.
export function buildPrismaCounts(
  records: Array<Pick<ScreeningRecord, "status" | "source_database" | "criterion_code" | "article_id">>,
  criteria: Array<{ code: string; text: string }>,
): PrismaCounts {
  const bySource = new Map<string, number>();
  const reasons = new Map<string, number>();
  let duplicates = 0;
  let excluded = 0;
  let unclassified = 0;
  let included = 0;
  let extracted = 0;

  for (const record of records) {
    const source = record.source_database?.trim() || "Not specified";
    bySource.set(source, (bySource.get(source) ?? 0) + 1);

    if (record.status === "duplicate") duplicates += 1;
    else if (record.status === "rejected") {
      excluded += 1;
      const key = record.criterion_code?.trim() || "";
      reasons.set(key, (reasons.get(key) ?? 0) + 1);
    } else if (record.status === "accepted") {
      included += 1;
      if (record.article_id) extracted += 1;
    } else unclassified += 1;
  }

  const textFor = (code: string) => criteria.find((item) => item.code === code)?.text ?? (code ? code : "No criterion recorded");

  return {
    identified: records.length,
    bySource: Array.from(bySource, ([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count || a.source.localeCompare(b.source)),
    duplicates,
    screened: records.length - duplicates,
    excluded,
    excludedByCriterion: Array.from(reasons, ([code, count]) => ({ code, text: textFor(code), count })).sort((a, b) => b.count - a.count),
    unclassified,
    included,
    extracted,
  };
}

const SOURCE_PREFIXES: Record<string, string> = { scopus: "SCOPUS", ieee: "IEEE", acm: "ACM", pubmed: "PUBMED" };

// Next free study id for a source, following the existing "SCOPUS_22" pattern.
export function suggestStudyId(source: string | null | undefined, existingStudyIds: Array<string | null>): string {
  const key = (source ?? "").toLowerCase();
  const known = Object.entries(SOURCE_PREFIXES).find(([name]) => key.startsWith(name))?.[1];
  const prefix = known ?? ((source ?? "").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 8) || "STUDY");
  const pattern = new RegExp(String.raw`^\s*${prefix}_(\d+)`, "i");
  const used = existingStudyIds.map((id) => Number(pattern.exec(id ?? "")?.[1] ?? 0));
  return `${prefix}_${Math.max(0, ...used) + 1}`;
}
