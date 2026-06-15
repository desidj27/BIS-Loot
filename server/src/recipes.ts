import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ParsedIngredient {
  amount: number;
  name: string;
  rarity: number;
}

export interface CraftRecipe {
  id: string;
  outputName: string;
  outputRarity: number;
  merchant: string;
  quantity: number;
  ingredients: ParsedIngredient[];
}

interface MerchantCraftRarity {
  quantity: number;
  ingredients: string[];
}

interface MerchantCraft {
  itemname: string;
  rarities: Record<string, MerchantCraftRarity>;
}

interface MerchantData {
  crafts?: Record<string, MerchantCraft>;
}

interface MerchantJson {
  craft_order: string[];
  [merchant: string]: MerchantData | string[];
}

const RARITY_NAMES: Record<number, string> = {
  0: 'Poor',
  1: 'Common',
  2: 'Uncommon',
  3: 'Rare',
  4: 'Epic',
  5: 'Legendary',
};

function parseIngredient(raw: string): ParsedIngredient {
  const match = raw.match(/^(\d+)-(.+)-(\d+)$/);
  if (!match) {
    return { amount: 1, name: raw, rarity: -1 };
  }
  return {
    amount: Number(match[1]),
    name: match[2],
    rarity: Number(match[3]),
  };
}

function loadMerchantData(): MerchantJson {
  const path = join(__dirname, '../data/merchant.json');
  return JSON.parse(readFileSync(path, 'utf-8')) as MerchantJson;
}

export function getAllRecipes(): CraftRecipe[] {
  const data = loadMerchantData();
  const recipes: CraftRecipe[] = [];

  for (const merchant of data.craft_order) {
    const merchantData = data[merchant] as MerchantData;
    if (!merchantData?.crafts) continue;

    for (const [craftKey, craft] of Object.entries(merchantData.crafts)) {
      for (const [rarityKey, rarityData] of Object.entries(craft.rarities)) {
        recipes.push({
          id: `${craftKey}_${rarityKey}`,
          outputName: craft.itemname ?? craftKey,
          outputRarity: Number(rarityKey),
          merchant,
          quantity: rarityData.quantity,
          ingredients: rarityData.ingredients.map(parseIngredient),
        });
      }
    }
  }

  return recipes;
}

export function getRecipesByMerchant(merchant?: string): CraftRecipe[] {
  const all = getAllRecipes();
  if (!merchant) return all;
  return all.filter((r) => r.merchant === merchant);
}

export function getCraftMerchants(): string[] {
  const data = loadMerchantData();
  return data.craft_order;
}

export function rarityNumberToName(rarity: number): string {
  return RARITY_NAMES[rarity] ?? 'Unknown';
}

export function normalizeItemName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function nameToArchetype(name: string, itemIndex: Map<string, string>): string | null {
  const normalized = normalizeItemName(name);
  return itemIndex.get(normalized) ?? null;
}

export function buildItemIndex(
  items: Array<{ name: string; archetype: string }>
): Map<string, string> {
  const index = new Map<string, string>();

  for (const item of items) {
    index.set(normalizeItemName(item.name), item.archetype);
    index.set(normalizeItemName(item.archetype), item.archetype);
  }

  return index;
}
