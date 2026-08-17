const DARKERDB_BASE = 'https://api.darkerdb.com';
const DARKERDB_API_VERSION = '2026-08-15';
/** Required when the API key has an Origins allowlist (e.g. https://www.bisloot.website/). */
const DARKERDB_ORIGIN =
  process.env.DARKERDB_ORIGIN?.trim() || 'https://www.bisloot.website';

import { aggregateToWeekly, sanitizePriceHistoryOutliers } from './services/priceHistory';
import { itemIdsEqual } from './recipes';

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
    next?: string | null;
    cursor?: number | string;
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
  last_seen_at?: string | null;
  expires_at: string;
  has_sold: boolean;
  has_expired: boolean;
  listing_state?: string;
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
  item_type?: string;
  [key: string]: unknown;
}

type QueryParams = Record<string, string | number | boolean | undefined>;

const ALL_ITEMS_CACHE_TTL_MS = 60 * 60 * 1000;
const SEARCH_ITEMS_CACHE_TTL_MS = 30 * 60 * 1000;
let allItemsCache: { data: GameItem[]; expiresAt: number } | null = null;
let allItemsLoadPromise: Promise<GameItem[]> | null = null;
const searchItemsCache = new Map<string, { data: GameItem[]; expiresAt: number }>();

function getApiKey(): string {
  const key = process.env.DARKERDB_API_KEY?.trim();
  if (!key) {
    throw new Error(
      'DARKERDB_API_KEY is not set. Create a key at https://darkerdb.com/dashboard/api-keys (scopes: darkerdb.data + darkerdb.live) and add it to client/.env.local'
    );
  }
  return key;
}

/** v2 returns slug rarities ("rare"); the app uses display labels ("Rare"). */
export function toDisplayRarity(rarity: string | null | undefined): string {
  if (!rarity) return '';
  return rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase();
}

export function toApiRarity(rarity: string | null | undefined): string | undefined {
  const trimmed = rarity?.trim();
  if (!trimmed) return undefined;
  return trimmed.toLowerCase();
}

function toDisplayType(typeOrItemType: string | null | undefined): string {
  if (!typeOrItemType) return '';
  return typeOrItemType.charAt(0).toUpperCase() + typeOrItemType.slice(1).toLowerCase();
}

function normalizeGameItem(raw: GameItem): GameItem {
  const itemType = raw.item_type ?? raw.type;
  return {
    ...raw,
    rarity: toDisplayRarity(raw.rarity),
    type: toDisplayType(typeof itemType === 'string' ? itemType : ''),
    vendor_price: Number(raw.vendor_price ?? 0),
  };
}

function isListingActive(listing: MarketListing): boolean {
  if (listing.listing_state) {
    return listing.listing_state === 'active';
  }
  return !listing.has_sold && !listing.has_expired;
}

const CHEAPEST_SAMPLE_SIZE = 10;
const STALE_LISTING_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const OUTLIER_LOW_RATIO = 0.5;
const MIN_FILTERED_LISTINGS = 3;

function listingUnitPrice(listing: MarketListing): number | null {
  const price = listing.price_per_unit ?? listing.price;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null;
  return price;
}

function listingSeenAtMs(listing: MarketListing): number | null {
  const raw =
    (typeof listing.last_seen_at === 'string' && listing.last_seen_at) ||
    (typeof listing.created_at === 'string' && listing.created_at) ||
    '';
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
}

/** Drop listings not seen with the latest market wave (ghost sold/expired rows). */
function rejectStaleListings(listings: MarketListing[]): MarketListing[] {
  const seenTimes = listings
    .map(listingSeenAtMs)
    .filter((ms): ms is number => ms !== null);
  if (seenTimes.length === 0) return listings;

  const newest = Math.max(...seenTimes);
  const fresh = listings.filter((listing) => {
    const seen = listingSeenAtMs(listing);
    return seen !== null && seen >= newest - STALE_LISTING_MAX_AGE_MS;
  });
  return fresh.length >= MIN_FILTERED_LISTINGS ? fresh : listings;
}

/** Drop bait/typo undercuts that sit far below the market median. */
function rejectPriceOutliers(listings: MarketListing[]): MarketListing[] {
  const prices = listings
    .map(listingUnitPrice)
    .filter((price): price is number => price !== null);
  if (prices.length < MIN_FILTERED_LISTINGS) return listings;

  const floor = median(prices) * OUTLIER_LOW_RATIO;
  const filtered = listings.filter((listing) => {
    const price = listingUnitPrice(listing);
    return price !== null && price >= floor;
  });
  return filtered.length >= MIN_FILTERED_LISTINGS ? filtered : listings;
}

export function averageCheapestUnitPrice(
  listings: MarketListing[],
  sampleSize = CHEAPEST_SAMPLE_SIZE
): number | null {
  const usable = rejectPriceOutliers(rejectStaleListings(listings));
  const prices = usable
    .map(listingUnitPrice)
    .filter((price): price is number => price !== null)
    .sort((a, b) => a - b)
    .slice(0, sampleSize);

  if (prices.length === 0) return null;
  const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  return Math.round(average * 100) / 100;
}

function isListingSold(listing: MarketListing): boolean {
  if (listing.listing_state) {
    return listing.listing_state === 'sold' || listing.listing_state === 'missing';
  }
  return Boolean(listing.has_sold);
}

function flattenListingAttributes(listing: MarketListing): Record<string, unknown> {
  const attrs = listing.attributes;
  if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) return {};
  return { ...(attrs as Record<string, unknown>) };
}

function socketId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['id', 'item_id', 'gem_id', 'gem']) {
      const nested = record[key];
      if (typeof nested === 'string' && nested.trim()) return nested.trim();
    }
  }
  return null;
}

export function listingSocketIds(listing: MarketListing): string[] {
  const ids: string[] = [];
  if (Array.isArray(listing.sockets)) {
    for (const socket of listing.sockets) {
      const id = socketId(socket);
      if (id) ids.push(id);
    }
  }

  for (let i = 1; i <= 5; i++) {
    const id = socketId(listing[`socket_${i}`]);
    if (id) ids.push(id);
  }

  return [...new Set(ids)];
}

function socketsFromListing(listing: MarketListing): Partial<MarketListing> {
  const ids = listingSocketIds(listing);
  return {
    socket_1: ids[0] ?? null,
    socket_2: ids[1] ?? null,
    socket_3: ids[2] ?? null,
    socket_4: ids[3] ?? null,
    socket_5: ids[4] ?? null,
  };
}

function normalizeMarketListing(listing: MarketListing): MarketListing {
  const active = isListingActive(listing);
  const sold = isListingSold(listing);
  const name =
    (typeof listing.item === 'string' && listing.item) ||
    (typeof listing.name === 'string' && listing.name) ||
    '';

  return {
    ...listing,
    ...flattenListingAttributes(listing),
    ...socketsFromListing(listing),
    rarity: toDisplayRarity(listing.rarity),
    item: name,
    has_sold: active ? false : sold,
    has_expired: active
      ? false
      : listing.listing_state === 'expired' || Boolean(listing.has_expired),
  };
}

async function fetchApi<T>(path: string, params: QueryParams = {}): Promise<ApiResponse<T>> {
  const url = new URL(`${DARKERDB_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-API-Key': getApiKey(),
      'X-API-Version': DARKERDB_API_VERSION,
      // Keys with an Origins allowlist require a matching Origin/Referer.
      Origin: DARKERDB_ORIGIN,
      Referer: `${DARKERDB_ORIGIN.replace(/\/$/, '')}/`,
    },
  });

  if (!response.ok) {
    let detail = '';
    try {
      const errBody = (await response.json()) as {
        errors?: string[];
        flash?: { errors?: Array<{ message?: string }> };
      };
      detail =
        errBody.errors?.[0] ??
        errBody.flash?.errors?.[0]?.message ??
        '';
    } catch {
      // ignore parse errors
    }
    throw new Error(
      detail
        ? `DarkerDB API error ${response.status}: ${path} — ${detail}`
        : `DarkerDB API error ${response.status}: ${path}`
    );
  }

  return response.json() as Promise<ApiResponse<T>>;
}

function extractCursor(next: string | null | undefined): string | undefined {
  if (!next) return undefined;
  try {
    if (next.includes('://') || next.startsWith('/')) {
      return new URL(next, DARKERDB_BASE).searchParams.get('cursor') ?? next;
    }
  } catch {
    // fall through
  }
  return next;
}

export async function getMarketListings(params: QueryParams = {}): Promise<MarketListing[]> {
  const { order, has_sold, item, rarity, ...rest } = params;

  const query: QueryParams = {
    ...rest,
    limit: Math.min(Number(rest.limit ?? 100) || 100, 250),
  };

  if (rarity !== undefined) {
    query.rarity = toApiRarity(String(rarity));
  }

  // v2 prefers listing_state; keep has_sold as a compatibility fallback when set.
  if (has_sold === false || has_sold === 'false') {
    query.listing_state = 'active';
  } else if (has_sold === true || has_sold === 'true') {
    query.listing_state = 'sold';
  }

  if (order === 'asc') {
    query.sort = 'price_per_unit:asc';
  } else if (order === 'desc') {
    query.sort = 'created_at:desc';
  }

  // v2 market filters by item_id / archetype; `item` name is resolved when possible.
  if (typeof item === 'string' && item.trim()) {
    const matches = await searchItems(item.trim());
    const exact =
      matches.find((entry) => entry.name.toLowerCase() === item.trim().toLowerCase()) ??
      matches[0];
    if (exact?.archetype) {
      query.archetype = exact.archetype;
    } else {
      query.item = item.trim();
    }
  }

  const data = await fetchApi<MarketListing[]>('/v2/market', query);
  return (data.body ?? []).map(normalizeMarketListing);
}

async function fetchPriceHistoryRaw(
  itemId: string,
  interval: string,
  extraParams: QueryParams = {}
): Promise<PriceHistoryPoint[]> {
  const data = await fetchApi<PriceHistoryPoint[]>(
    `/v2/market/analytics/${encodeURIComponent(itemId)}/prices/history`,
    { interval, ...extraParams }
  );
  return data.body ?? [];
}

async function fetchDailyHistory(itemId: string): Promise<PriceHistoryPoint[]> {
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 30);
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
    const data = await fetchApi<GameItem | GameItem[]>('/v2/items', {
      archetype,
      limit: 200,
    });
    const body = data.body;
    const items = Array.isArray(body) ? body : body ? [body] : [];
    return items.map(normalizeGameItem);
  } catch {
    return [];
  }
}

export async function getItem(idOrArchetype: string): Promise<GameItem | null> {
  try {
    const data = await fetchApi<GameItem>(`/v2/items/${encodeURIComponent(idOrArchetype)}`);
    return data.body ? normalizeGameItem(data.body) : null;
  } catch {
    const variants = await getItemsByArchetype(idOrArchetype);
    return variants[0] ?? null;
  }
}

export async function getItemAttributes(): Promise<ItemAttribute[]> {
  try {
    const data = await fetchApi<{
      values?: Array<{ value: string; label: string }>;
      facet?: { values?: Array<{ value: string; label: string }> };
    }>('/v2/facets/ids/attribute');

    const values = data.body?.values ?? data.body?.facet?.values ?? [];
    if (Array.isArray(values) && values.length > 0) {
      return values.map((entry) => {
        const field = entry.value.replace(/^id\.attribute\./i, '');
        return {
          id: entry.value,
          field,
          display: entry.label || field,
        };
      });
    }
  } catch {
    // Fall through to legacy path if facets shape differs.
  }

  try {
    const data = await fetchApi<ItemAttribute[]>('/v2/items/attributes');
    return data.body ?? [];
  } catch {
    return [];
  }
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
  return listings.filter((l) => isListingSold(l));
}

export async function searchMarketListings(options: MarketSearchOptions = {}): Promise<MarketListing[]> {
  const { item, rarity, gems = 'any', limit = 100 } = options;

  const params: QueryParams = {
    limit,
    order: 'asc',
    has_sold: false,
  };

  if (item?.trim()) params.item = item.trim();
  if (rarity?.trim()) params.rarity = rarity.trim();
  if (gems === 'gemmed') params.has_gems = true;
  if (gems === 'no_gems') params.has_gems = false;

  const listings = await getMarketListings(params);
  const active = listings.filter((l) => isListingActive(l));

  if (gems === 'gemmed') {
    return active.filter((listing) => listingSocketIds(listing).length > 0);
  }
  if (gems === 'no_gems') {
    return active.filter((listing) => listingSocketIds(listing).length === 0);
  }

  return active;
}

export async function searchItems(name: string): Promise<GameItem[]> {
  const trimmed = name.trim();
  if (!trimmed) return [];

  const cacheKey = trimmed.toLowerCase();
  const cached = searchItemsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const data = await fetchApi<GameItem | GameItem[]>('/v2/items', {
    name: trimmed,
    limit: 200,
  });
  const body = data.body;
  const items = (Array.isArray(body) ? body : body ? [body] : []).map(normalizeGameItem);
  searchItemsCache.set(cacheKey, {
    data: items,
    expiresAt: Date.now() + SEARCH_ITEMS_CACHE_TTL_MS,
  });
  return items;
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
  let cursor: string | undefined;

  while (true) {
    const data = await fetchApi<GameItem[]>('/v2/items', {
      limit: 200,
      ...(cursor ? { cursor } : {}),
    });
    const body = data.body ?? [];
    items.push(...body.map(normalizeGameItem));

    const next = extractCursor(data.pagination?.next ?? undefined);
    if (!next) break;
    cursor = next;
  }

  return items;
}

export async function getLowestListingPrice(archetype: string): Promise<number | null> {
  const listings = await getMarketListings({
    archetype,
    limit: 100,
    order: 'asc',
    has_sold: false,
  });

  return averageCheapestUnitPrice(listings.filter((l) => isListingActive(l)));
}

export async function getLowestListingPriceForItem(
  archetype: string,
  itemId: string,
  itemMeta?: { name: string; rarity: string }
): Promise<number | null> {
  if (itemMeta?.name && itemMeta?.rarity) {
    const targeted = await getMarketListings({
      item: itemMeta.name,
      rarity: itemMeta.rarity,
      limit: 100,
      order: 'asc',
      has_sold: false,
    });
    const targetedActive = targeted.filter(
      (listing) => isListingActive(listing) && itemIdsEqual(listing.item_id, itemId)
    );
    const targetedPrice = averageCheapestUnitPrice(targetedActive);
    if (targetedPrice !== null) return targetedPrice;
  }

  const listings = await getMarketListings({
    archetype,
    limit: 100,
    order: 'asc',
    has_sold: false,
  });

  const active = listings.filter(
    (listing) => isListingActive(listing) && itemIdsEqual(listing.item_id, itemId)
  );
  return averageCheapestUnitPrice(active);
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

export function darkerdbItemIconUrl(itemId: string): string {
  return `${DARKERDB_BASE}/v2/items/${encodeURIComponent(itemId)}/icon`;
}
