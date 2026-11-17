import type { FetchArticlesPageParams } from "@/lib/articles";

const NO_USER_SCOPE = "no-user";

function scope(userId: string | null | undefined): string {
  return userId ?? NO_USER_SCOPE;
}

export const protocolKeys = {
  protocol: (userId: string | null | undefined) => ["protocol", scope(userId)] as const,
  databases: (userId: string | null | undefined) => ["protocol-databases", scope(userId)] as const,
};

export const articleKeys = {
  all: (userId: string | null | undefined) => ["articles", scope(userId)] as const,
  page: (userId: string | null | undefined, params: FetchArticlesPageParams) => ["articles", scope(userId), "page", params] as const,
  filterOptions: (userId: string | null | undefined) => ["articles", scope(userId), "filters-options"] as const,
  detail: (userId: string | null | undefined, articleId: string | undefined) => ["article", scope(userId), articleId ?? "unknown"] as const,
};
