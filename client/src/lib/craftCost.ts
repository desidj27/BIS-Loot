import { api, CraftCostResult } from '@/api/client';

export async function fetchCraftCostsForLookup(
  itemName: string,
  rarity?: string
): Promise<CraftCostResult[]> {
  const trimmed = itemName.trim();
  if (!trimmed) return [];

  try {
    const costs = await api.craftingForItemName(trimmed);
    const sorted = [...costs].sort((a, b) => a.outputRarity - b.outputRarity);
    if (!rarity) return sorted;
    return sorted.filter((cost) => cost.outputRarityName === rarity);
  } catch {
    return [];
  }
}
