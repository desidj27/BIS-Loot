import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
  6: 'Unique',
  7: 'Artifact',
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
  const path = join(process.cwd(), 'data', 'merchant.json');
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

/** Craft output tier from merchant.json (e.g. ring tier 3 = Rare). */
export function rarityNumberToName(rarity: number): string {
  return RARITY_NAMES[rarity] ?? 'Unknown';
}

/** Ingredient suffix in wiki format (e.g. Arcane Essence-4 = Rare essence). */
export function ingredientRarityNumberToName(rarity: number): string {
  if (rarity < 0) return 'Unknown';
  return RARITY_NAMES[rarity - 1] ?? 'Unknown';
}

export function normalizeItemName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function itemRarityKey(name: string, rarityName: string): string {
  return `${normalizeItemName(name)}_${normalizeItemName(rarityName)}`;
}

export interface ResolvedIngredientItem {
  id: string;
  archetype: string;
}

export interface ItemIndex {
  archetypeByName: Map<string, string>;
  itemByNameAndRarity: Map<string, ResolvedIngredientItem>;
}

export function buildItemIndex(
  items: Array<{ id: string; name: string; archetype: string; rarity?: string }>
): ItemIndex {
  const archetypeByName = new Map<string, string>();
  const itemByNameAndRarity = new Map<string, ResolvedIngredientItem>();

  for (const item of items) {
    archetypeByName.set(normalizeItemName(item.name), item.archetype);
    archetypeByName.set(normalizeItemName(item.archetype), item.archetype);
    if (item.rarity) {
      itemByNameAndRarity.set(itemRarityKey(item.name, item.rarity), {
        id: item.id,
        archetype: item.archetype,
      });
    }
  }

  return { archetypeByName, itemByNameAndRarity };
}

export function nameToArchetype(name: string, itemIndex: ItemIndex | Map<string, string>): string | null {
  const map = itemIndex instanceof Map ? itemIndex : itemIndex.archetypeByName;
  const normalized = normalizeItemName(name);
  return map.get(normalized) ?? null;
}

export function ingredientSuffixToItemId(archetype: string, suffix: number): string {
  return `${archetype}_${suffix}001`;
}

export function isConcreteItemId(itemId: string): boolean {
  return /_\d{4}$/.test(itemId);
}

export function resolveIngredientItem(
  name: string,
  ingredientRarity: number,
  itemIndex: ItemIndex
): ResolvedIngredientItem | null {
  const archetype = itemIndex.archetypeByName.get(normalizeItemName(name));
  if (!archetype) return null;

  if (ingredientRarity >= 0) {
    const rarityName = ingredientRarityNumberToName(ingredientRarity);
    const keyed = itemIndex.itemByNameAndRarity.get(itemRarityKey(name, rarityName));
    if (keyed) return keyed;

    return {
      id: ingredientSuffixToItemId(archetype, ingredientRarity),
      archetype,
    };
  }

  return null;
}

export function nameToArchetypeForIngredient(
  name: string,
  ingredientRarity: number,
  itemIndex: ItemIndex | Map<string, string>
): string | null {
  if (itemIndex instanceof Map) {
    if (ingredientRarity >= 0) {
      const rarityName = ingredientRarityNumberToName(ingredientRarity);
      const keyed = itemIndex.get(itemRarityKey(name, rarityName));
      if (keyed) return keyed;
    }
    return nameToArchetype(name, itemIndex);
  }

  return resolveIngredientItem(name, ingredientRarity, itemIndex)?.archetype ?? null;
}
