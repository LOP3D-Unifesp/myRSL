import { describe, expect, it } from "vitest";
import { buildCountryFrequencyMap, splitAndNormalizeCountries } from "@/lib/country-normalization";

describe("country normalization", () => {
  it("splits and normalizes country synonyms", () => {
    const result = splitAndNormalizeCountries("usa, uk and Republic of Korea");
    expect(result).toEqual(["United States", "United Kingdom", "South Korea"]);
  });

  it("builds frequency map after normalization", () => {
    const map = buildCountryFrequencyMap([
      { country: "U.S.A." },
      { country: "United States of America" },
      { country: "Japan and Korea" },
      { country: "Malaysia; Saudi Arabia" },
    ]);
    expect(map["United States"]).toBe(2);
    expect(map["South Korea"]).toBe(1);
    expect(map["Japan"]).toBe(1);
    expect(map["Malaysia"]).toBe(1);
    expect(map["Saudi Arabia"]).toBe(1);
  });
});
