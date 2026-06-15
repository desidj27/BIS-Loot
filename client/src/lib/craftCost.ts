import { api, CraftCostResult } from '@/api/client';

export async function fetchCraftCostForLookup(
  itemName: string,
  rarity?: string
): Promise<CraftCostResult | null> {
  const trimmed = itemName.trim();
  if (!trimmed) return null;

  const items = await api.searchItems(trimmed);
  const normalized = trimmed.toLowerCase();

  const match =
    items.find(
      (item) => item.name.toLowerCase() === normalized && (!rarity || item.rarity === rarity)
    ) ?? items.find((item) => item.name.toLowerCase() === normalized);

  if (!match) return null;

  try {
    return await api.craftCostForItem(match.id);
  } catch {
    return null;
  }
}
