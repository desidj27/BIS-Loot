const API_BASE = '/api';

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || 'Request failed');
  }
  return response.json();
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

export interface ItemAttributeRange {
  field: string;
  display: string;
  is_percentage?: boolean;
  min: number;
  max: number;
}

export interface AttributeFilter {
  field: string;
  display: string;
  min?: number;
}

export interface MarketSearchParams {
  item?: string;
  rarity?: string;
  gems?: 'any' | 'gemmed' | 'no_gems';
  limit?: number;
  attributes?: AttributeFilter[];
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
  ingredients?: IngredientCost[] | null;
}

export interface GearItems {
  armor: GameItem[];
  weapons: GameItem[];
}

export interface CraftableGear {
  armor: CraftableGearItem[];
  weapons: CraftableGearItem[];
}

export interface PriceSummary {
  archetype: string;
  fairPrice: number | null;
  lowestPrice: number | null;
  activeListings: number;
}

export interface ArbitrageOpportunity {
  listingId: number;
  item: string;
  archetype: string;
  rarity: string;
  listingPrice: number;
  pricePerUnit: number;
  quantity: number;
  fairPrice: number;
  listingFee: number;
  profitGold: number;
  profitPercent: number;
  expiresAt: string;
  compCount: number;
  vendorPrice: number | null;
}

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

export const api = {
  health: () => fetchJson<{ status: string }>('/health'),
  market: (limit = 50) => fetchJson<MarketListing[]>(`/market?limit=${limit}`),
  marketSearch: (params: MarketSearchParams) => {
    const query = new URLSearchParams();
    if (params.item) query.set('item', params.item);
    if (params.rarity) query.set('rarity', params.rarity);
    if (params.gems) query.set('gems', params.gems);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.attributes?.length) {
      query.set('attributes', JSON.stringify(params.attributes));
    }
    return fetchJson<MarketListing[]>(`/market/search?${query.toString()}`);
  },
  itemAttributes: () => fetchJson<ItemAttribute[]>('/items/attributes'),
  itemAttributeRanges: (item: string, rarity?: string) => {
    const query = new URLSearchParams({ item });
    if (rarity) query.set('rarity', rarity);
    return fetchJson<ItemAttributeRange[]>(`/items/attributes?${query.toString()}`);
  },
  searchItems: (q: string) => fetchJson<GameItem[]>(`/items/search?q=${encodeURIComponent(q)}`),
  getItem: (id: string) => fetchJson<GameItem>(`/items/${encodeURIComponent(id)}`),
  craftCostForItem: (id: string) =>
    fetchJson<CraftCostResult>(`/items/${encodeURIComponent(id)}/craft-cost`),
  priceHistory: (archetype: string, interval = '1h') =>
    fetchJson<PriceHistoryPoint[]>(
      `/prices/${encodeURIComponent(archetype)}/history?interval=${interval}`
    ),
  priceSummary: (archetype: string) =>
    fetchJson<PriceSummary>(`/prices/${encodeURIComponent(archetype)}`),
  alerts: (minProfit = 30) => fetchJson<ArbitrageOpportunity[]>(`/alerts?minProfit=${minProfit}`),
  gearItems: () => fetchJson<GearItems>('/items/gear'),
  craftableGear: (merchant?: string, includeCosts = true) => {
    const params = new URLSearchParams();
    if (merchant) params.set('merchant', merchant);
    if (!includeCosts) params.set('costs', 'false');
    const query = params.toString();
    return fetchJson<CraftableGear>(query ? `/items/craftable?${query}` : '/items/craftable');
  },
  craftingMerchants: () => fetchJson<string[]>('/crafting/merchants'),
  crafting: (merchant?: string) =>
    fetchJson<CraftCostResult[]>(
      merchant ? `/crafting?merchant=${encodeURIComponent(merchant)}` : '/crafting'
    ),
};

export function formatGold(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value.toLocaleString()}G`;
}

export function formatVolume(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString();
}

export function averageVolume(history: PriceHistoryPoint[]): number | null {
  if (history.length === 0) return null;
  const total = history.reduce((sum, point) => sum + point.volume, 0);
  return Math.round(total / history.length);
}

const VOLUME_PERIOD_LABELS: Record<string, string> = {
  '15m': '15 min',
  '1h': 'hour',
  '4h': '4 hr',
  '1d': 'day',
  '1w': 'week',
};

export function volumePeriodLabel(interval: string): string {
  return VOLUME_PERIOD_LABELS[interval] ?? 'period';
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value > 0 ? '+' : ''}${value}%`;
}

export function rarityClass(rarity: string): string {
  const map: Record<string, string> = {
    Poor: 'text-[#9d9d9d]',
    Common: 'text-[#ffffff]',
    Uncommon: 'text-[#71AD31]',
    Rare: 'text-[#0070dd]',
    Epic: 'text-[#A335EE]',
    Legendary: 'text-[#FF8000] font-semibold',
    Unique: 'text-[#ECD99A] font-semibold',
    Artifact: 'text-[#E60505] font-semibold',
  };
  return map[rarity] ?? 'text-[#c9bfb0]';
}
