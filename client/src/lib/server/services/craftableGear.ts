import { getAllItemsPaginated, GameItem } from '../darkerdb';
import {
  CraftRecipe,
  getAllRecipes,
  normalizeItemName,
  rarityNumberToName,
} from '../recipes';
import { getRecipeDetailsForRecipes, IngredientCost } from './crafting';
import { resolveAverageMarketPricesForItems } from './priceCache';
import { sortGearItems } from './items';

export interface CraftableGearItem {
  id: string;
  archetype: string;
  name: string;
  rarity: string;
  type: 'Armor' | 'Weapon';
  armor_type?: string | null;
  hand_type?: string | null;
  slot_type?: string | null;
  merchant: string;
  iconUrl: string;
  recipeId: string;
  craftCost: number | null;
  marketPrice: number | null;
  ingredients: IngredientCost[] | null;
}

const DARKERDB_ICON_BASE = 'https://api.darkerdb.com/v1/items';

function findItemForRecipe(recipe: CraftRecipe, items: GameItem[]): GameItem | null {
  const rarityName = rarityNumberToName(recipe.outputRarity);
  const normalizedName = normalizeItemName(recipe.outputName);

  const exact = items.find(
    (item) =>
      normalizeItemName(item.name) === normalizedName && item.rarity === rarityName
  );
  if (exact) return exact;

  return (
    items.find(
      (item) =>
        normalizeItemName(item.name) === normalizedName ||
        normalizeItemName(item.archetype) === normalizedName
    ) ?? null
  );
}

export async function getCraftableGear(
  merchant?: string,
  includeCosts = true
): Promise<{
  armor: CraftableGearItem[];
  weapons: CraftableGearItem[];
}> {
  let recipes = getAllRecipes();
  if (merchant) {
    recipes = recipes.filter((r) => r.merchant === merchant);
  }

  const allItems = await getAllItemsPaginated();
  const matched: { recipe: CraftRecipe; item: GameItem }[] = [];
  const seen = new Set<string>();

  for (const recipe of recipes) {
    const item = findItemForRecipe(recipe, allItems);
    if (!item || (item.type !== 'Armor' && item.type !== 'Weapon')) continue;
    if (seen.has(item.id)) continue;

    seen.add(item.id);
    matched.push({ recipe, item });
  }

  const [recipeDetails, marketPrices] = includeCosts
    ? await Promise.all([
        getRecipeDetailsForRecipes(matched.map(({ recipe }) => recipe)),
        resolveAverageMarketPricesForItems(
          matched.map(({ item }) => ({ id: item.id, archetype: item.archetype }))
        ),
      ])
    : [new Map<string, { craftCost: number | null; ingredients: IngredientCost[] }>(), new Map<string, number | null>()];

  const craftable: CraftableGearItem[] = matched.map(({ recipe, item }) => {
    const details = recipeDetails.get(recipe.id);

    return {
      id: item.id,
      archetype: item.archetype,
      name: item.name,
      rarity: item.rarity,
      type: item.type as 'Armor' | 'Weapon',
      armor_type: item.armor_type,
      hand_type: item.hand_type,
      slot_type: item.slot_type,
      merchant: recipe.merchant,
      iconUrl: `${DARKERDB_ICON_BASE}/${encodeURIComponent(item.id)}/icon`,
      recipeId: recipe.id,
      craftCost: details?.craftCost ?? null,
      marketPrice: marketPrices.get(item.id) ?? null,
      ingredients: details?.ingredients ?? null,
    };
  });

  const { armor, weapons } = sortGearItems(craftable as unknown as GameItem[]);

  return {
    armor: armor as unknown as CraftableGearItem[],
    weapons: weapons as unknown as CraftableGearItem[],
  };
}
