import {
  api,
  AttributeFilter,
  formatGold,
  GameItem,
  ItemAttributeRange,
  MarketListing,
  MarketSearchParams,
  rarityClass,
} from '../api/client';

export interface ItemSuggestion {
  name: string;
  type: string;
}

export interface ItemSearchResult {
  id: string;
  name: string;
  type: string;
  rarity: string;
}

export function dedupeItemSearchResults(items: GameItem[]): ItemSearchResult[] {
  const seen = new Map<string, ItemSearchResult>();

  for (const item of items) {
    const key = item.name.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, {
        id: item.id,
        name: item.name,
        type: item.type,
        rarity: item.rarity,
      });
    }
  }

  return Array.from(seen.values());
}

export function rankItemSearchResults(results: ItemSearchResult[], query: string): ItemSearchResult[] {
  const lower = query.trim().toLowerCase();
  if (!lower) return results;

  return [...results].sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    const aStarts = aName.startsWith(lower);
    const bStarts = bName.startsWith(lower);

    if (aStarts !== bStarts) return aStarts ? -1 : 1;
    return aName.localeCompare(bName);
  });
}

export async function searchItemsForLookup(query: string): Promise<ItemSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const items = await api.searchItems(trimmed);
  return rankItemSearchResults(dedupeItemSearchResults(items), trimmed);
}

export function dedupeItemSuggestions(items: GameItem[]): ItemSuggestion[] {
  const seen = new Map<string, ItemSuggestion>();

  for (const item of items) {
    const key = item.name.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, { name: item.name, type: item.type });
    }
  }

  return Array.from(seen.values());
}

export function rankItemSuggestions(suggestions: ItemSuggestion[], query: string): ItemSuggestion[] {
  const lower = query.trim().toLowerCase();
  if (!lower) return suggestions;

  return [...suggestions].sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    const aStarts = aName.startsWith(lower);
    const bStarts = bName.startsWith(lower);

    if (aStarts !== bStarts) return aStarts ? -1 : 1;
    return aName.localeCompare(bName);
  });
}

export async function searchItemSuggestions(query: string): Promise<ItemSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const items = await api.searchItems(trimmed);
  return rankItemSuggestions(dedupeItemSuggestions(items), trimmed);
}

export const RARITIES = [
  'Poor',
  'Common',
  'Uncommon',
  'Rare',
  'Epic',
  'Legendary',
  'Unique',
  'Artifact',
] as const;

export type GemStatus = 'any' | 'gemmed' | 'no_gems';

export interface MarketFilterState {
  itemName: string;
  rarity: string;
  gems: GemStatus;
  attributes: AttributeFilter[];
}

export const defaultMarketFilters: MarketFilterState = {
  itemName: '',
  rarity: '',
  gems: 'any',
  attributes: [],
};

export function buildMarketSearchQuery(filters: MarketFilterState): MarketSearchParams {
  return {
    item: filters.itemName.trim() || undefined,
    rarity: filters.rarity || undefined,
    gems: filters.gems,
    limit: 100,
    attributes: filters.attributes.length > 0 ? filters.attributes : undefined,
  };
}

export function clampAttributeValue(value: number, range: ItemAttributeRange): number {
  return Math.min(range.max, Math.max(range.min, value));
}

export function attributeInputStep(range: ItemAttributeRange): number {
  return range.is_percentage ? 0.1 : 1;
}

export function mergePendingAttributeFilter(
  filters: MarketFilterState,
  pending: { field: string; min: string } | null,
  availableAttributes: ItemAttributeRange[]
): MarketFilterState {
  if (!pending?.field) return filters;
  if (filters.attributes.some((attr) => attr.field === pending.field)) return filters;

  const attr = availableAttributes.find((entry) => entry.field === pending.field);
  if (!attr) return filters;
  if (pending.min === '') return filters;

  const parsed = Number(pending.min);
  if (Number.isNaN(parsed)) return filters;

  const min = clampAttributeValue(parsed, attr);

  return {
    ...filters,
    attributes: [...filters.attributes, { field: attr.field, display: attr.display, min }],
  };
}

function listingAttributeValues(listing: MarketListing, field: string): number[] {
  const values: number[] = [];
  const primary = listing[`primary_${field}`];
  const secondary = listing[`secondary_${field}`];

  if (typeof primary === 'number') values.push(primary);
  if (typeof secondary === 'number') values.push(secondary);

  return values;
}

export function filterListingsByAttributes(
  listings: MarketListing[],
  attributes: AttributeFilter[]
): MarketListing[] {
  if (attributes.length === 0) return listings;

  return listings.filter((listing) =>
    attributes.every((filter) => {
      const values = listingAttributeValues(listing, filter.field);
      if (values.length === 0) return false;
      if (filter.min === undefined) return true;
      return values.some((value) => value >= filter.min!);
    })
  );
}

export async function fetchMarketListings(filters: MarketFilterState): Promise<MarketListing[]> {
  const params = buildMarketSearchQuery(filters);
  const listings = await api.marketSearch(params);
  if (!params.attributes?.length) return listings;
  return filterListingsByAttributes(listings, params.attributes);
}

export async function loadItemAttributeRanges(
  itemName: string,
  rarity?: string
): Promise<ItemAttributeRange[]> {
  const trimmed = itemName.trim();
  if (!trimmed) return [];
  return api.itemAttributeRanges(trimmed, rarity || undefined);
}

export type { AttributeFilter, ItemAttributeRange };
export { formatGold, rarityClass };
