import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Protocol = Database["public"]["Tables"]["protocols"]["Row"];
export type ProtocolDatabase = Database["public"]["Tables"]["protocol_databases"]["Row"];

const optionalText = z.string().max(10000).nullable().optional();
const stringList = z.array(z.string().trim().min(1).max(1000)).max(100).nullable().optional();

export const protocolWriteSchema = z.object({
  research_questions: optionalText,
  period_from: z.number().int().min(1800).max(2100).nullable().optional(),
  period_to: z.number().int().min(1800).max(2100).nullable().optional(),
  languages: z.array(z.string().trim().min(1).max(100)).max(50).nullable().optional(),
  extraction_notes: optionalText,
  inclusion_criteria: stringList,
  exclusion_criteria: stringList,
});

export const protocolDatabaseWriteSchema = z.object({
  name: z.string().trim().min(1, "Database name is required.").max(200),
  search_string: z.string().max(10000).nullable().optional(),
  searched_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.").nullable().optional(),
  results_count: z.number().int().min(0).max(100000000).nullable().optional(),
});

export type ProtocolWriteInput = z.infer<typeof protocolWriteSchema>;
export type ProtocolDatabaseWriteInput = z.infer<typeof protocolDatabaseWriteSchema>;

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

export async function fetchProtocol(): Promise<Protocol | null> {
  const { data, error } = await supabase.from("protocols").select("*").maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveProtocol(input: ProtocolWriteInput): Promise<Protocol> {
  const userId = await requireUserId();
  const sanitized = protocolWriteSchema.parse(input);
  const { data, error } = await supabase
    .from("protocols")
    .upsert({ ...sanitized, user_id: userId }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchProtocolDatabases(): Promise<ProtocolDatabase[]> {
  const { data, error } = await supabase.from("protocol_databases").select("*").order("name");
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
    .insert({ ...sanitized, name: sanitized.name, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProtocolDatabase(id: string): Promise<void> {
  const { error } = await supabase.from("protocol_databases").delete().eq("id", id);
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
