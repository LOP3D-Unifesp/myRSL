import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { inActiveReview } from "@/lib/articles";
import { requireActiveReviewId } from "@/lib/active-review";

export type Protocol = Database["public"]["Tables"]["protocols"]["Row"];
export type ProtocolDatabase = Database["public"]["Tables"]["protocol_databases"]["Row"];
export type ProtocolCriterion = Database["public"]["Tables"]["protocol_criteria"]["Row"];
export type ProtocolQuestion = Database["public"]["Tables"]["protocol_questions"]["Row"];
export type ProtocolQaItem = Database["public"]["Tables"]["protocol_qa_items"]["Row"];

export type Picoc = {
  population: string;
  intervention: string;
  comparison: string;
  outcome: string;
  context: string;
};

export type ProtocolKeyword = { term: string; synonyms: string[] };

export const EMPTY_PICOC: Picoc = { population: "", intervention: "", comparison: "", outcome: "", context: "" };

const optionalText = z.string().max(10000).nullable().optional();

export const protocolWriteSchema = z.object({
  title: z.string().max(500).nullable().optional(),
  objective: optionalText,
  picoc: z.object({
    population: z.string().max(5000),
    intervention: z.string().max(5000),
    comparison: z.string().max(5000),
    outcome: z.string().max(5000),
    context: z.string().max(5000),
  }),
  keywords: z.array(z.object({ term: z.string().trim().min(1).max(200), synonyms: z.array(z.string().trim().min(1).max(200)).max(100) })).max(100),
  search_string: optionalText,
  period_from: z.number().int().min(1800).max(2100).nullable().optional(),
  period_to: z.number().int().min(1800).max(2100).nullable().optional(),
  languages: z.array(z.string().trim().min(1).max(100)).max(50).nullable().optional(),
  extraction_notes: optionalText,
});

export const protocolListsSchema = z.object({
  criteria: z.array(z.object({
    kind: z.enum(["inclusion", "exclusion"]),
    code: z.string().trim().min(1).max(20),
    text: z.string().trim().min(1, "Criteria cannot be empty.").max(2000),
  })).max(100),
  questions: z.array(z.object({
    code: z.string().trim().min(1).max(20),
    label: z.string().trim().min(1, "Research questions need a label.").max(300),
    text: z.string().max(5000).nullable(),
    is_main: z.boolean(),
  })).max(50),
  qa: z.array(z.object({
    slot: z.string().regex(/^qa_q([1-9]|10)$/),
    label: z.string().trim().min(1, "QA items need a label.").max(300),
    description: z.string().max(2000).nullable(),
  })).max(10),
});

export const protocolDatabaseWriteSchema = z.object({
  name: z.string().trim().min(1, "Database name is required.").max(200),
  search_string: z.string().max(10000).nullable().optional(),
  searched_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.").nullable().optional(),
  results_count: z.number().int().min(0).max(100000000).nullable().optional(),
  url: z.string().max(2000).nullable().optional(),
});

export type ProtocolWriteInput = z.infer<typeof protocolWriteSchema>;
export type ProtocolListsInput = z.infer<typeof protocolListsSchema>;
export type ProtocolDatabaseWriteInput = z.infer<typeof protocolDatabaseWriteSchema>;

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

export async function fetchProtocol(): Promise<Protocol | null> {
  const { data, error } = await inActiveReview(supabase.from("protocols").select("*")).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveProtocol(input: ProtocolWriteInput): Promise<Protocol> {
  const userId = await requireUserId();
  const sanitized = protocolWriteSchema.parse(input);
  const { data, error } = await supabase
    .from("protocols")
    .upsert({ ...sanitized, user_id: userId, review_id: requireActiveReviewId() }, { onConflict: "review_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchProtocolDatabases(): Promise<ProtocolDatabase[]> {
  const { data, error } = await inActiveReview(supabase.from("protocol_databases").select("*")).order("name");
  if (error) throw error;
  return data ?? [];
}

export async function saveProtocolDatabase(input: ProtocolDatabaseWriteInput, id?: string): Promise<ProtocolDatabase> {
  const sanitized = protocolDatabaseWriteSchema.parse(input);
  if (id) {
    const { data, error } = await supabase.from("protocol_databases").update(sanitized).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("protocol_databases")
    .insert({ ...sanitized, name: sanitized.name, user_id: userId, review_id: requireActiveReviewId() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProtocolDatabase(id: string): Promise<void> {
  const { error } = await supabase.from("protocol_databases").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchProtocolCriteria(): Promise<ProtocolCriterion[]> {
  const { data, error } = await inActiveReview(supabase.from("protocol_criteria").select("*")).order("position");
  if (error) throw error;
  return data ?? [];
}

export async function fetchProtocolQuestions(): Promise<ProtocolQuestion[]> {
  const { data, error } = await inActiveReview(supabase.from("protocol_questions").select("*")).order("position");
  if (error) throw error;
  return data ?? [];
}

export async function fetchProtocolQaItems(): Promise<ProtocolQaItem[]> {
  const { data, error } = await inActiveReview(supabase.from("protocol_qa_items").select("*"));
  if (error) throw error;
  return data ?? [];
}

// Criteria, questions and the QA checklist are replaced together in one database transaction.
export async function saveProtocolLists(input: ProtocolListsInput): Promise<void> {
  const parsed = protocolListsSchema.parse(input);
  const { error } = await supabase.rpc("save_protocol_lists", {
    p_review_id: requireActiveReviewId(),
    p_criteria: parsed.criteria.map((item, position) => ({ ...item, position })),
    p_questions: parsed.questions.map((item, position) => ({ ...item, position })),
    p_qa: parsed.qa,
  });
  if (error) throw error;
}

const SOURCE_DATABASE_PREFIXES: Record<string, string> = {
  scopus: "Scopus",
  ieee: "IEEE",
  acm: "ACM",
  pubmed: "PubMed",
};

// "SCOPUS_22 / Jiang et al., 2017" -> "Scopus"
export function deriveSourceDatabaseFromStudyId(studyId: string | null | undefined): string | null {
  const prefix = /^\s*([A-Za-z]+)_/.exec(studyId ?? "")?.[1]?.toLowerCase();
  return (prefix && SOURCE_DATABASE_PREFIXES[prefix]) || null;
}
