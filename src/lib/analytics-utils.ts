export type FrequencyItem = {
  name: string;
  value: number;
};

export function buildFrequency(items: Array<string | null | undefined>): FrequencyItem[] {
  const map = new Map<string, number>();
  for (const item of items) {
    if (!item) continue;
    const label = item.trim();
    if (!label) continue;
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function buildFrequencyFromNested(items: Array<Array<string | null | undefined> | null | undefined>): FrequencyItem[] {
  const flattened: string[] = [];
  for (const group of items) {
    if (!group) continue;
    for (const value of group) {
      if (!value) continue;
      const label = value.trim();
      if (!label) continue;
      flattened.push(label);
    }
  }
  return buildFrequency(flattened);
}

export function topNWithOthers(data: FrequencyItem[], topN = 8): FrequencyItem[] {
  if (data.length <= topN) return data;
  const top = data.slice(0, topN);
  const othersTotal = data.slice(topN).reduce((acc, item) => acc + item.value, 0);
  if (othersTotal <= 0) return top;
  return [...top, { name: "Others", value: othersTotal }];
}
