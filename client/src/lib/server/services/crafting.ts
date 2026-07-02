import { getAllItemsPaginated, getItem, searchItems } from '../darkerdb';
import {
  buildItemIndex,
  CraftRecipe,
  getAllRecipes,
  getRecipesByMerchant,
  ingredientRarityNumberToName,
  ItemIndex,
  nameToArchetype,
  normalizeItemName,
  ParsedIngredient,
  rarityNumberToName,
  resolveIngredientItem,
} from '../recipes';
import {
  getCachedItemPrice,
  getCachedMarketPrice,
  PriceItemRef,
  resolvePricesForArchetypes,
  resolvePricesForItems,
} from './priceCache';

export interface IngredientCost {
  name: string;
  amount: number;
  rarity: number;
  rarityName: string;
  archetype: string | null;
  unitPrice: number | null;
  totalCost: number | null;
}

export interface CraftCostResult {
  id: string;
  outputName: string;
  outputRarity: number;
  outputRarityName: string;
  merchant: string;
  quantity: number;
  ingredients: IngredientCost[];
  craftCost: number | null;
  marketPrice: number | null;
  profitGold: number | null;
  profitPercent: number | null;
}

let itemIndexPromise: Promise<ItemIndex> | null = null;

async function getItemIndex(): Promise<ItemIndex> {
  if (!itemIndexPromise) {
    itemIndexPromise = getAllItemsPaginated().then((items) => buildItemIndex(items));
  }
  return itemIndexPromise;
}

async function buildCraftItemIndex(
  recipes: CraftRecipe[],
  outputItemName: string
): Promise<{
  index: ItemIndex;
  vendorPricesByItemId: Map<string, number>;
  catalog: Array<{ id: string; name: string; rarity: string; archetype: string }>;
}> {
  const names = new Set<string>([outputItemName]);
  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      names.add(ingredient.name);
    }
  }

  const vendorPricesByItemId = new Map<string, number>();
  const items = (
    await Promise.all([...names].map((name) => searchItems(name)))
  ).flat();

  for (const item of items) {
    if (item.vendor_price > 0) {
      vendorPricesByItemId.set(item.id, item.vendor_price);
    }
  }

  return {
    index: buildItemIndex(items),
    vendorPricesByItemId,
    catalog: items.map((item) => ({
      id: item.id,
      name: item.name,
      rarity: item.rarity,
      archetype: item.archetype,
    })),
  };
}

function ingredientItems(recipes: CraftRecipe[], itemIndex: ItemIndex): PriceItemRef[] {
  const items: PriceItemRef[] = [];

  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      const resolved = resolveIngredientItem(ingredient.name, ingredient.rarity, itemIndex);
      if (!resolved) continue;

      items.push({
        id: resolved.id,
        archetype: resolved.archetype,
        name: ingredient.name,
        rarity: ingredientRarityNumberToName(ingredient.rarity),
      });
    }
  }

  return items;
}

function outputPriceItems(
  recipes: CraftRecipe[],
  itemName: string,
  catalog: Array<{ id: string; name: string; rarity: string; archetype: string }>
): Array<PriceItemRef & { recipeId: string }> {
  return recipes
    .map((recipe) => {
      const rarityName = rarityNumberToName(recipe.outputRarity);
      const item = catalog.find(
        (entry) =>
          entry.name.toLowerCase() === itemName.toLowerCase() && entry.rarity === rarityName
      );
      if (!item) return null;

      return {
        id: item.id,
        archetype: item.archetype,
        name: item.name,
        rarity: item.rarity,
        recipeId: recipe.id,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

function buildIngredientCosts(
  recipe: CraftRecipe,
  itemIndex: ItemIndex,
  prices: Map<string, number | null>
): IngredientCost[] {
  return recipe.ingredients.map((ingredient) => {
    const resolved = resolveIngredientItem(ingredient.name, ingredient.rarity, itemIndex);
    const unitPrice = resolved ? (prices.get(resolved.id) ?? null) : null;

    return {
      name: ingredient.name,
      amount: ingredient.amount,
      rarity: ingredient.rarity,
      rarityName: ingredientRarityNumberToName(ingredient.rarity),
      archetype: resolved?.archetype ?? null,
      unitPrice,
      totalCost: unitPrice !== null ? unitPrice * ingredient.amount : null,
    };
  });
}

function craftCostFromIngredients(ingredients: IngredientCost[]): number | null {
  if (ingredients.some((ingredient) => ingredient.totalCost === null)) return null;
  return ingredients.reduce((sum, ingredient) => sum + (ingredient.totalCost ?? 0), 0);
}

async function resolveIngredientCost(
  ingredient: ParsedIngredient,
  itemIndex: ItemIndex,
  prices?: Map<string, number | null>
): Promise<IngredientCost> {
  const resolved = resolveIngredientItem(ingredient.name, ingredient.rarity, itemIndex);
  let unitPrice: number | null = null;

  if (resolved) {
    unitPrice =
      prices?.get(resolved.id) ??
      (await getCachedItemPrice(resolved.id, resolved.archetype, {
        skipFairPrice: true,
        itemMeta: {
          name: ingredient.name,
          rarity: ingredientRarityNumberToName(ingredient.rarity),
        },
      }));
  }

  return {
    name: ingredient.name,
    amount: ingredient.amount,
    rarity: ingredient.rarity,
    rarityName: ingredientRarityNumberToName(ingredient.rarity),
    archetype: resolved?.archetype ?? null,
    unitPrice,
    totalCost: unitPrice !== null ? unitPrice * ingredient.amount : null,
  };
}

async function calculateRecipeCost(
  recipe: CraftRecipe,
  itemIndex: ItemIndex,
  ingredientPrices?: Map<string, number | null>,
  outputItem?: { id: string; archetype: string; name: string; rarity: string }
): Promise<CraftCostResult> {
  const ingredients = await Promise.all(
    recipe.ingredients.map((ing) => resolveIngredientCost(ing, itemIndex, ingredientPrices))
  );

  const hasMissingPrices = ingredients.some((i) => i.totalCost === null);
  const craftCost = hasMissingPrices
    ? null
    : ingredients.reduce((sum, i) => sum + (i.totalCost ?? 0), 0);

  let marketPrice: number | null = null;

  if (outputItem) {
    marketPrice =
      ingredientPrices?.get(outputItem.id) ??
      (await getCachedItemPrice(outputItem.id, outputItem.archetype, {
        skipFairPrice: true,
        itemMeta: { name: outputItem.name, rarity: outputItem.rarity },
      }));
  } else {
    const outputArchetype = nameToArchetype(recipe.outputName, itemIndex);
    if (outputArchetype) {
      marketPrice = await getCachedMarketPrice(outputArchetype, { skipFairPrice: true });
    }
  }

  let profitGold: number | null = null;
  let profitPercent: number | null = null;

  if (craftCost !== null && marketPrice !== null && craftCost > 0) {
    profitGold = marketPrice - craftCost;
    profitPercent = Math.round((profitGold / craftCost) * 1000) / 10;
  }

  return {
    id: recipe.id,
    outputName: recipe.outputName,
    outputRarity: recipe.outputRarity,
    outputRarityName: rarityNumberToName(recipe.outputRarity),
    merchant: recipe.merchant,
    quantity: recipe.quantity,
    ingredients,
    craftCost,
    marketPrice,
    profitGold,
    profitPercent,
  };
}

export async function getCraftingCosts(merchant?: string): Promise<CraftCostResult[]> {
  const recipes = merchant ? getRecipesByMerchant(merchant) : getAllRecipes();
  const itemIndex = await getItemIndex();
  const ingredientPrices = await resolvePricesForItems(ingredientItems(recipes, itemIndex));

  const batchSize = 20;
  const results: CraftCostResult[] = [];

  for (let i = 0; i < recipes.length; i += batchSize) {
    const batch = recipes.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((recipe) => calculateRecipeCost(recipe, itemIndex, ingredientPrices))
    );
    results.push(...batchResults);
  }

  return results.sort((a, b) => (b.profitPercent ?? -999) - (a.profitPercent ?? -999));
}

function findRecipeForItem(item: { name: string; rarity: string; archetype: string }): CraftRecipe | null {
  const normalizedName = normalizeItemName(item.name);
  const recipes = getAllRecipes().filter(
    (recipe) => normalizeItemName(recipe.outputName) === normalizedName
  );

  if (recipes.length === 0) return null;

  const exact = recipes.find(
    (recipe) => rarityNumberToName(recipe.outputRarity) === item.rarity
  );
  if (exact) return exact;

  return null;
}

export async function getCraftingCostForItem(itemName: string): Promise<CraftCostResult[]> {
  const recipes = getAllRecipes().filter(
    (r) => r.outputName.toLowerCase() === itemName.toLowerCase()
  );
  if (recipes.length === 0) return [];

  const { index: itemIndex, vendorPricesByItemId, catalog } = await buildCraftItemIndex(
    recipes,
    itemName
  );
  const outputItems = outputPriceItems(recipes, itemName, catalog);

  const prices = await resolvePricesForItems(
    [...ingredientItems(recipes, itemIndex), ...outputItems],
    {
      skipFairPrice: true,
      vendorPricesByItemId,
    }
  );

  return recipes
    .map((recipe) => {
      const ingredients = buildIngredientCosts(recipe, itemIndex, prices);
      const rarityName = rarityNumberToName(recipe.outputRarity);
      const outputItem = outputItems.find((entry) => entry.recipeId === recipe.id);

      return {
        id: recipe.id,
        outputName: recipe.outputName,
        outputRarity: recipe.outputRarity,
        outputRarityName: rarityName,
        merchant: recipe.merchant,
        quantity: recipe.quantity,
        ingredients,
        craftCost: craftCostFromIngredients(ingredients),
        marketPrice: outputItem ? (prices.get(outputItem.id) ?? null) : null,
        profitGold: null,
        profitPercent: null,
      };
    })
    .sort((a, b) => a.outputRarity - b.outputRarity);
}

export async function getCraftingCostForItemId(itemId: string): Promise<CraftCostResult | null> {
  const item = await getItem(itemId);
  if (!item) return null;

  const recipe = findRecipeForItem(item);
  if (!recipe) return null;

  const itemIndex = await getItemIndex();
  const ingredientPrices = await resolvePricesForItems(ingredientItems([recipe], itemIndex), {
    skipFairPrice: true,
  });

  return calculateRecipeCost(recipe, itemIndex, ingredientPrices, {
    id: item.id,
    archetype: item.archetype,
    name: item.name,
    rarity: item.rarity,
  });
}

export async function getRecipeDetailsForRecipes(
  recipes: CraftRecipe[]
): Promise<Map<string, { craftCost: number | null; ingredients: IngredientCost[] }>> {
  if (recipes.length === 0) return new Map();

  const itemIndex = await getItemIndex();
  const ingredientPrices = await resolvePricesForItems(ingredientItems(recipes, itemIndex), {
    skipFairPrice: true,
  });
  const details = new Map<string, { craftCost: number | null; ingredients: IngredientCost[] }>();

  for (const recipe of recipes) {
    const ingredients = buildIngredientCosts(recipe, itemIndex, ingredientPrices);
    details.set(recipe.id, {
      ingredients,
      craftCost: craftCostFromIngredients(ingredients),
    });
  }

  return details;
}

export async function getCraftCostsForRecipes(
  recipes: CraftRecipe[]
): Promise<Map<string, number | null>> {
  const details = await getRecipeDetailsForRecipes(recipes);
  const costs = new Map<string, number | null>();

  for (const [recipeId, detail] of details) {
    costs.set(recipeId, detail.craftCost);
  }

  return costs;
}
