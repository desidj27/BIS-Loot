const DARKERDB_BASE = 'https://api.darkerdb.com';

import { aggregateToWeekly, sanitizePriceHistoryOutliers } from './services/priceHistory.js';

export interface ApiResponse<T> {
  version: string;
  status: string;
  code: number;
  body: T;
  pagination?: {
    count: number;
    limit: number;
    page?: number;
    num_pages?: number;
    total?: number;
    next?: string;
    cursor?: number;
  };
}

export interface MarketListing {
  id: number;
  item_id: string;
  item: string;
  archetype: string;
  rarity: string;
  price: number;
  price_per_unit: number;
  quantity: number;
  created_at: string;
  expires_at: string;
  has_sold: boolean;
  has_expired: boolean;
  sold_at?: string | null;
  socket_1?: string | null;
  socket_2?: string | null;
  socket_3?: string | null;
  socket_4?: string | null;
  socket_5?: string | null;
  [key: string]: unknown;
}

export interface ItemAttribute {
  id: string;
  display: string;
  field: string;
  is_percentage?: boolean;
}

export interface AttributeFilter {
  field: string;
  display: string;
  min?: number;
}

export interface PriceHistoryPoint {
  timestamp: string;
  item_id: string;
  avg: number | null;
  min: number | null;
  max: number | null;
  volume: number;
}

export interface GameItem {
  id: string;
  archetype: string;
  name: string;
  rarity: string;
  type: string;
  armor_type?: string | null;
  hand_type?: string | null;
  slot_type?: string | null;
  vendor_price: number;
}

type QueryParams = Record<string, string | number | boolean | undefined>;

const ALL_ITEMS_CACHE_TTL_MS = 60 * 60 * 1000;
let allItemsCache: { data: GameItem[]; expiresAt: number } | null = null;
let allItemsLoadPromise: Promise<GameItem[]> | null = null;

async function fetchApi<T>(path: string, params: QueryParams = {}): Promise<ApiResponse<T>> {
  const url = new URL(`${DARKERDB_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`DarkerDB API error ${response.status}: ${path}`);
  }

  return response.json() as Promise<ApiResponse<T>>;
}

export async function getMarketListings(params: QueryParams = {}): Promise<MarketListing[]> {
  const data = await fetchApi<MarketListing[]>('/v1/market', {
    has_sold: false,
    ...params,
  });
  return data.body;
}

async function fetchPriceHistoryRaw(
  itemId: string,
  interval: string,
  extraParams: QueryParams = {}
): Promise<PriceHistoryPoint[]> {
  const data = await fetchApi<PriceHistoryPoint[]>(
    `/v1/market/analytics/${encodeURIComponent(itemId)}/prices/history`,
    { interval, ...extraParams }
  );
  return data.body;
}

async function fetchDailyHistory(itemId: string): Promise<PriceHistoryPoint[]> {
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 90);
  const fromDate = from.toISOString().slice(0, 10);
  return fetchPriceHistoryRaw(itemId, '1d', { from: fromDate });
}

async function resolveItemIdForHistory(idOrArchetype: string): Promise<string | null> {
  if ((await fetchPriceHistoryRaw(idOrArchetype, '1h')).length > 0) {
    return idOrArchetype;
  }

  const item = await getItem(idOrArchetype);
  if (item && (await fetchPriceHistoryRaw(item.id, '1h')).length > 0) {
    return item.id;
  }

  for (const variant of await getItemsByArchetype(idOrArchetype)) {
    if (variant.id === idOrArchetype) continue;
    if ((await fetchPriceHistoryRaw(variant.id, '1h')).length > 0) {
      return variant.id;
    }
  }

  return item?.id ?? null;
}

async function fetchHistoryWithFallback(
  idOrArchetype: string,
  interval: string
): Promise<PriceHistoryPoint[]> {
  const direct = await fetchPriceHistoryRaw(idOrArchetype, interval);
  if (direct.length > 0) return direct;

  const item = await getItem(idOrArchetype);
  if (item && item.id !== idOrArchetype) {
    const byItem = await fetchPriceHistoryRaw(item.id, interval);
    if (byItem.length > 0) return byItem;
  }

  for (const variant of await getItemsByArchetype(idOrArchetype)) {
    if (variant.id === idOrArchetype) continue;
    const history = await fetchPriceHistoryRaw(variant.id, interval);
    if (history.length > 0) return history;
  }

  return [];
}

export async function getPriceHistory(
  idOrArchetype: string,
  interval: string = '1h'
): Promise<PriceHistoryPoint[]> {
  if (interval === '1w') {
    let daily = await fetchDailyHistory(idOrArchetype);
    if (daily.length === 0) {
      const resolvedId = await resolveItemIdForHistory(idOrArchetype);
      if (resolvedId) {
        daily = await fetchDailyHistory(resolvedId);
      }
    }
    return sanitizePriceHistoryOutliers(aggregateToWeekly(daily));
  }

  return sanitizePriceHistoryOutliers(await fetchHistoryWithFallback(idOrArchetype, interval));
}

export async function getItemsByArchetype(archetype: string): Promise<GameItem[]> {
  try {
    const data = await fetchApi<GameItem | GameItem[]>('/v1/items', { archetype });
    const body = data.body;
    return Array.isArray(body) ? body : [body];
  } catch {
    return [];
  }
}

export async function getItem(idOrArchetype: string): Promise<GameItem | null> {
  try {
    const data = await fetchApi<GameItem>(`/v1/items/${encodeURIComponent(idOrArchetype)}`);
    return data.body;
  } catch {
    const variants = await getItemsByArchetype(idOrArchetype);
    return variants[0] ?? null;
  }
}

export async function getItemAttributes(): Promise<ItemAttribute[]> {
  const data = await fetchApi<ItemAttribute[]>('/v1/items/attributes');
  return data.body;
}

export interface MarketSearchOptions {
  item?: string;
  rarity?: string;
  gems?: 'any' | 'gemmed' | 'no_gems';
  limit?: number;
}

export async function getSoldMarketListings(options: MarketSearchOptions = {}): Promise<MarketListing[]> {
  const { item, rarity, limit = 100 } = options;

  const params: QueryParams = {
    limit,
    order: 'desc',
    has_sold: true,
  };

  if (item?.trim()) params.item = item.trim();
  if (rarity?.trim()) params.rarity = rarity.trim();

  const listings = await getMarketListings(params);
  return listings.filter((l) => l.has_sold);
}

export async function searchMarketListings(options: MarketSearchOptions = {}): Promise<MarketListing[]> {
  const { item, rarity, gems = 'any', limit = 100 } = options;

  const params: QueryParams = {
    limit,
    order: 'desc',
    has_sold: false,
  };

  if (item?.trim()) params.item = item.trim();
  if (rarity?.trim()) params.rarity = rarity.trim();
  if (gems === 'gemmed') params.has_gems = true;
  if (gems === 'no_gems') params.has_gems = false;

  const listings = await getMarketListings(params);
  return listings.filter((l) => !l.has_sold && !l.has_expired);
}

export async function searchItems(name: string): Promise<GameItem[]> {
  const data = await fetchApi<GameItem | GameItem[]>('/v1/items', { name });
  const body = data.body;
  return Array.isArray(body) ? body : [body];
}

export async function getAllItemsPaginated(): Promise<GameItem[]> {
  if (allItemsCache && allItemsCache.expiresAt > Date.now()) {
    return allItemsCache.data;
  }

  if (allItemsLoadPromise) {
    return allItemsLoadPromise;
  }

  allItemsLoadPromise = loadAllItemsPaginated().then((items) => {
    allItemsCache = { data: items, expiresAt: Date.now() + ALL_ITEMS_CACHE_TTL_MS };
    allItemsLoadPromise = null;
    return items;
  });

  return allItemsLoadPromise;
}

async function loadAllItemsPaginated(): Promise<GameItem[]> {
  const items: GameItem[] = [];
  let page = 1;

  while (true) {
    const data = await fetchApi<GameItem[]>('/v1/items', { page, limit: 100 });
    items.push(...data.body);
    if (!data.pagination?.next) break;
    page += 1;
  }

  return items;
}

export async function getLowestListingPrice(archetype: string): Promise<number | null> {
  const listings = await getMarketListings({
    archetype,
    limit: 20,
    order: 'asc',
    has_sold: false,
  });

  const active = listings.filter((l) => !l.has_sold && !l.has_expired);
  if (active.length === 0) return null;

  return Math.min(...active.map((l) => l.price_per_unit ?? l.price));
}

export async function getFairPrice(archetype: string): Promise<number | null> {
  const history = await getPriceHistory(archetype, '1h');
  if (history.length === 0) return null;

  const recent = history.slice(-24).filter((p) => p.avg != null && p.avg > 0);
  if (recent.length === 0) return null;

  const totalVolume = recent.reduce((sum, p) => sum + p.volume, 0);
  if (totalVolume === 0) {
    return recent[recent.length - 1]?.avg ?? null;
  }

  const weighted = recent.reduce((sum, p) => sum + (p.avg as number) * p.volume, 0);
  return Math.round(weighted / totalVolume);
}
