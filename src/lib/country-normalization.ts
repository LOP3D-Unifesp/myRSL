// Country normalization utilities for analytics

const COUNTRY_SYNONYMS: Record<string, string> = {
  "usa": "United States",
  "u.s.a.": "United States",
  "u.s.a": "United States",
  "united states of america": "United States",
  "us": "United States",
  "u.s.": "United States",
  "uk": "United Kingdom",
  "u.k.": "United Kingdom",
  "u.k": "United Kingdom",
  "uae": "United Arab Emirates",
  "south korea": "South Korea",
  "republic of korea": "South Korea",
  "korea": "South Korea",
};

function capitalizeWords(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizeCountryName(raw: string): string {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  return COUNTRY_SYNONYMS[lower] || capitalizeWords(trimmed);
}

/**
 * Split a country string like "Japan and China" or "UK, USA" into individual countries,
 * normalize each, and return unique list.
 */
export function splitAndNormalizeCountries(countryField: string | null | undefined): string[] {
  if (!countryField) return [];
  // Split by comma, semicolon, " and ", " & "
  const parts = countryField
    .split(/,|;|\band\b|&/gi)
    .map((s) => s.trim())
    .filter(Boolean);
  const normalized = parts.map(normalizeCountryName);
  return [...new Set(normalized)];
}

/**
 * Build a frequency map from articles' country fields with normalization + splitting.
 */
export function buildCountryFrequencyMap(articles: { country?: string | null }[]): Record<string, number> {
  const map: Record<string, number> = {};
  articles.forEach((a) => {
    const countries = splitAndNormalizeCountries(a.country);
    countries.forEach((c) => {
      map[c] = (map[c] || 0) + 1;
    });
  });
  return map;
}
