import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { sanitizeArticleWriteInput, type ArticleWriteInput } from "@/lib/article-schemas";

export type Article = Database["public"]["Tables"]["articles"]["Row"];
export type ArticleInsert = Omit<Article, "id" | "created_at" | "updated_at">;

export type ArticleListItem = Pick<
  Article,
  "id" | "title" | "author" | "first_author" | "study_id" | "country" | "prosthesis_name" | "year" | "is_draft" | "created_at"
>;

export type VerificationListItem = Pick<
  Article,
  "id" | "title" | "author" | "year" | "country" | "verify_peer1" | "verify_peer2" | "verify_qa3" | "verify_qa4" | "qa_score"
>;

export async function fetchArticles() {
  const { data, error } = await supabase.from("articles").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Article[];
}

export async function fetchArticle(id: string) {
  const { data, error } = await supabase.from("articles").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Article;
}

export async function fetchArticleSummaries() {
  const { data, error } = await supabase
    .from("articles")
    .select("id,title,author,first_author,study_id,country,prosthesis_name,year,is_draft,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as ArticleListItem[];
}

export async function fetchVerificationSummaries() {
  const { data, error } = await supabase
    .from("articles")
    .select("id,title,author,year,country,verify_peer1,verify_peer2,verify_qa3,verify_qa4,qa_score")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as VerificationListItem[];
}

export async function fetchArticlesPage(page: number, pageSize: number, search: string) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from("articles")
    .select("id,title,author,first_author,study_id,country,prosthesis_name,year,is_draft,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const term = search.trim();
  if (term) {
    const escaped = term.replaceAll("%", "\\%");
    query = query.or(
      `author.ilike.%${escaped}%,first_author.ilike.%${escaped}%,title.ilike.%${escaped}%,study_id.ilike.%${escaped}%,country.ilike.%${escaped}%,prosthesis_name.ilike.%${escaped}%`,
    );
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return {
    data: (data ?? []) as ArticleListItem[],
    count: count ?? 0,
  };
}

function withLegacyAuthorSync(input: ArticleWriteInput): ArticleWriteInput {
  if (input.first_author && !input.author) {
    return { ...input, author: input.first_author };
  }
  if (input.author && !input.first_author) {
    return { ...input, first_author: input.author };
  }
  return input;
}

export async function createArticle(article: Partial<ArticleInsert>) {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) throw new Error("Not authenticated");

  const sanitized = withLegacyAuthorSync(sanitizeArticleWriteInput(article));
  const payload: Database["public"]["Tables"]["articles"]["Insert"] = {
    ...sanitized,
    user_id: user.id,
  };

  const { data, error } = await supabase.from("articles").insert(payload).select().single();
  if (error) throw error;
  return data as Article;
}

export async function updateArticle(id: string, article: Partial<ArticleInsert>) {
  const sanitized = withLegacyAuthorSync(sanitizeArticleWriteInput(article));
  const payload: Database["public"]["Tables"]["articles"]["Update"] = sanitized;
  const { data, error } = await supabase.from("articles").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data as Article;
}

export async function deleteArticle(id: string) {
  const { error } = await supabase.from("articles").delete().eq("id", id);
  if (error) throw error;
}
