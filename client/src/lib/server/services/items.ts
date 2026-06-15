import type { GameItem } from '../darkerdb';

export const RARITY_ORDER = [
  'Poor',
  'Common',
  'Uncommon',
  'Rare',
  'Epic',
  'Legendary',
  'Unique',
  'Artifact',
] as const;

function rarityIndex(rarity: string): number {
  const index = RARITY_ORDER.indexOf(rarity as (typeof RARITY_ORDER)[number]);
  return index === -1 ? 999 : index;
}

export function isRarityAtLeast(rarity: string, minimum: (typeof RARITY_ORDER)[number] = 'Rare'): boolean {
  return rarityIndex(rarity) >= rarityIndex(minimum);
}

export const DEAL_EXCLUDED_ITEM_TYPES = new Set(['Utility']);

function compareByRaritySubTypeName(a: GameItem, b: GameItem): number {
  const rarityDiff = rarityIndex(a.rarity) - rarityIndex(b.rarity);
  if (rarityDiff !== 0) return rarityDiff;

  const subA = a.armor_type ?? a.hand_type ?? '';
  const subB = b.armor_type ?? b.hand_type ?? '';
  const subDiff = subA.localeCompare(subB);
  if (subDiff !== 0) return subDiff;

  const nameDiff = a.name.localeCompare(b.name);
  if (nameDiff !== 0) return nameDiff;

  return a.id.localeCompare(b.id);
}

export function sortGearItems(items: GameItem[]): {
  armor: GameItem[];
  weapons: GameItem[];
} {
  const armor = items.filter((i) => i.type === 'Armor').sort(compareByRaritySubTypeName);
  const weapons = items.filter((i) => i.type === 'Weapon').sort(compareByRaritySubTypeName);

  return { armor, weapons };
}
