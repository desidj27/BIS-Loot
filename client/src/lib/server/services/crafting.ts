import { getAllItemsPaginated, getItem } from '../darkerdb';
import {
  buildItemIndex,
  CraftRecipe,
  getAllRecipes,
  getRecipesByMerchant,
  nameToArchetype,
  normalizeItemName,
  ParsedIngredient,
  rarityNumberToName,
} from '../recipes';
import { getCachedMarketPrice, resolvePricesForArchetypes } from './priceCache';

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

let itemIndexPromise: Promise<Map<string, string>> | null = null;

async function getItemIndex(): Promise<Map<string, string>> {
  if (!itemIndexPromise) {
    itemIndexPromise = getAllItemsPaginated().then((items) => buildItemIndex(items));
  }
  return itemIndexPromise;
}

function ingredientArchetypes(recipes: CraftRecipe[], itemIndex: Map<string, string>): string[] {
  const archetypes: string[] = [];
  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      const archetype = nameToArchetype(ingredient.name, itemIndex);
      if (archetype) archetypes.push(archetype);
    }
  }
  return archetypes;
}

function buildIngredientCosts(
  recipe: CraftRecipe,
  itemIndex: Map<string, string>,
  prices: Map<string, number | null>
): IngredientCost[] {
  return recipe.ingredients.map((ingredient) => {
    const archetype = nameToArchetype(ingredient.name, itemIndex);
    const unitPrice = archetype ? (prices.get(archetype) ?? null) : null;

    return {
      name: ingredient.name,
      amount: ingredient.amount,
      rarity: ingredient.rarity,
      rarityName: rarityNumberToName(ingredient.rarity),
      archetype,
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
  itemIndex: Map<string, string>,
  prices?: Map<string, number | null>
): Promise<IngredientCost> {
  const archetype = nameToArchetype(ingredient.name, itemIndex);
  let unitPrice: number | null = null;

  if (archetype) {
    unitPrice = prices?.get(archetype) ?? (await getCachedMarketPrice(archetype));
  }

  return {
    name: ingredient.name,
    amount: ingredient.amount,
    rarity: ingredient.rarity,
    rarityName: rarityNumberToName(ingredient.rarity),
    archetype,
    unitPrice,
    totalCost: unitPrice !== null ? unitPrice * ingredient.amount : null,
  };
}

async function calculateRecipeCost(
  recipe: CraftRecipe,
  itemIndex: Map<string, string>,
  prices?: Map<string, number | null>
): Promise<CraftCostResult> {
  const ingredients = await Promise.all(
    recipe.ingredients.map((ing) => resolveIngredientCost(ing, itemIndex, prices))
  );

  const hasMissingPrices = ingredients.some((i) => i.totalCost === null);
  const craftCost = hasMissingPrices
    ? null
    : ingredients.reduce((sum, i) => sum + (i.totalCost ?? 0), 0);

  const outputArchetype = nameToArchetype(recipe.outputName, itemIndex);
  let marketPrice: number | null = null;

  if (outputArchetype) {
    marketPrice = prices?.get(outputArchetype) ?? (await getCachedMarketPrice(outputArchetype));
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
  const archetypes = ingredientArchetypes(recipes, itemIndex);

  for (const recipe of recipes) {
    const outputArchetype = nameToArchetype(recipe.outputName, itemIndex);
    if (outputArchetype) archetypes.push(outputArchetype);
  }

  const prices = await resolvePricesForArchetypes(archetypes);

  const batchSize = 20;
  const results: CraftCostResult[] = [];

  for (let i = 0; i < recipes.length; i += batchSize) {
    const batch = recipes.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((recipe) => calculateRecipeCost(recipe, itemIndex, prices))
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

  if (recipes.length === 1) return recipes[0];

  return (
    recipes.find(
      (recipe) => normalizeItemName(recipe.outputName) === normalizeItemName(item.archetype)
    ) ?? recipes[0]
  );
}

export async function getCraftingCostForItem(itemName: string): Promise<CraftCostResult[]> {
  const recipes = getAllRecipes().filter(
    (r) => r.outputName.toLowerCase() === itemName.toLowerCase()
  );
  const itemIndex = await getItemIndex();
  const prices = await resolvePricesForArchetypes(ingredientArchetypes(recipes, itemIndex), 20, {
    skipFairPrice: true,
  });
  return recipes.map((recipe) => {
    const ingredients = buildIngredientCosts(recipe, itemIndex, prices);
    return {
      id: recipe.id,
      outputName: recipe.outputName,
      outputRarity: recipe.outputRarity,
      outputRarityName: rarityNumberToName(recipe.outputRarity),
      merchant: recipe.merchant,
      quantity: recipe.quantity,
      ingredients,
      craftCost: craftCostFromIngredients(ingredients),
      marketPrice: null,
      profitGold: null,
      profitPercent: null,
    };
  });
}

export async function getCraftingCostForItemId(itemId: string): Promise<CraftCostResult | null> {
  const item = await getItem(itemId);
  if (!item) return null;

  const recipe = findRecipeForItem(item);
  if (!recipe) return null;

  const itemIndex = await getItemIndex();
  const archetypes = ingredientArchetypes([recipe], itemIndex);
  const outputArchetype = nameToArchetype(recipe.outputName, itemIndex);
  if (outputArchetype) archetypes.push(outputArchetype);

  const prices = await resolvePricesForArchetypes(archetypes, 20, { skipFairPrice: true });
  return calculateRecipeCost(recipe, itemIndex, prices);
}

export async function getRecipeDetailsForRecipes(
  recipes: CraftRecipe[]
): Promise<Map<string, { craftCost: number | null; ingredients: IngredientCost[] }>> {
  if (recipes.length === 0) return new Map();

  const itemIndex = await getItemIndex();
  const prices = await resolvePricesForArchetypes(ingredientArchetypes(recipes, itemIndex), 20, {
    skipFairPrice: true,
  });
  const details = new Map<string, { craftCost: number | null; ingredients: IngredientCost[] }>();

  for (const recipe of recipes) {
    const ingredients = buildIngredientCosts(recipe, itemIndex, prices);
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
