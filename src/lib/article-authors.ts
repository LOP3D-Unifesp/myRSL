export function splitAuthors(author: string | null | undefined): string[] {
  if (!author) return [];
  return author
    .split(/[;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatCompactAuthors(author: string | null | undefined, firstAuthor: string | null | undefined): string {
  const authors = splitAuthors(author);
  if (authors.length >= 3) return `${authors[0]} et al.`;
  if (authors.length === 2) return `${authors[0]}; ${authors[1]}`;
  if (authors.length === 1) return authors[0];
  if (firstAuthor?.trim()) return firstAuthor.trim();
  return "No author";
}
