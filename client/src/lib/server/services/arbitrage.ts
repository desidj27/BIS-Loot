import {
  getAllItemsPaginated,
  getMarketListings,
  getSoldMarketListings,
  MarketListing,
} from '../darkerdb';
import { countSimilarSold, fairPriceFromSimilarSold } from './listingSimilarity';
import { calculateFlipMargin, calculateFlipProfit, calculateListingFee } from './marketFees';
import { DEAL_EXCLUDED_ITEM_TYPES, isRarityAtLeast } from './items';
import { getVendorPriceMap } from './priceCache';

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

const soldListingsCache = new Map<string, { listings: MarketListing[]; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

let archetypeTypeCache: { map: Map<string, string>; expiresAt: number } | null = null;

async function getArchetypeTypeMap(): Promise<Map<string, string>> {
  if (archetypeTypeCache && archetypeTypeCache.expiresAt > Date.now()) {
    return archetypeTypeCache.map;
  }

  const items = await getAllItemsPaginated();
  const map = new Map<string, string>();
  for (const item of items) {
    if (!map.has(item.archetype)) {
      map.set(item.archetype, item.type);
    }
  }

  archetypeTypeCache = { map, expiresAt: Date.now() + CACHE_TTL_MS };
  return map;
}

function isEligibleDealListing(listing: MarketListing, archetypeTypes: Map<string, string>): boolean {
  if (!isRarityAtLeast(listing.rarity)) return false;

  const itemType = archetypeTypes.get(listing.archetype);
  if (itemType && DEAL_EXCLUDED_ITEM_TYPES.has(itemType)) return false;

  return true;
}

async function getCachedSoldListings(item: string, rarity: string): Promise<MarketListing[]> {
  const key = `${item.toLowerCase()}::${rarity.toLowerCase()}`;
  const cached = soldListingsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.listings;
  }

  const listings = await getSoldMarketListings({ item, rarity, limit: 100 });
  soldListingsCache.set(key, { listings, expiresAt: Date.now() + CACHE_TTL_MS });
  return listings;
}

function evaluateListing(
  listing: MarketListing,
  soldListings: MarketListing[]
): { fairPrice: number; compCount: number } | null {
  const compCount = countSimilarSold(listing, soldListings);
  const fairPrice = fairPriceFromSimilarSold(listing, soldListings);
  if (fairPrice === null) return null;

  return { fairPrice, compCount };
}

function buildOpportunity(
  listing: MarketListing,
  fairPrice: number,
  compCount: number,
  minProfitPercent: number,
  vendorPrices: Map<string, number>
): ArbitrageOpportunity | null {
  const unitPrice = listing.price_per_unit ?? listing.price;
  if (unitPrice <= 0) return null;

  const listingFee = calculateListingFee(fairPrice);
  const profitGold = calculateFlipProfit(unitPrice, fairPrice);
  if (profitGold <= 0) return null;

  const profitPercent = calculateFlipMargin(unitPrice, fairPrice);
  if (profitPercent < minProfitPercent) return null;

  return {
    listingId: listing.id,
    item: listing.item,
    archetype: listing.archetype,
    rarity: listing.rarity,
    listingPrice: listing.price,
    pricePerUnit: unitPrice,
    quantity: listing.quantity,
    fairPrice,
    listingFee,
    profitGold: Math.round(profitGold),
    profitPercent: Math.round(profitPercent * 10) / 10,
    expiresAt: listing.expires_at,
    compCount,
    vendorPrice:
      vendorPrices.get(listing.archetype) ?? vendorPrices.get(listing.item_id) ?? null,
  };
}

export async function findArbitrageOpportunities(
  minProfitPercent = 30,
  listingLimit = 200
): Promise<ArbitrageOpportunity[]> {
  const [listings, archetypeTypes, vendorPrices] = await Promise.all([
    getMarketListings({
      limit: listingLimit,
      order: 'desc',
      has_sold: false,
    }),
    getArchetypeTypeMap(),
    getVendorPriceMap(),
  ]);

  const active = listings.filter(
    (l) => !l.has_sold && !l.has_expired && isEligibleDealListing(l, archetypeTypes)
  );
  const lookupKeys = [...new Set(active.map((l) => `${l.item}::${l.rarity}`))];

  const soldByKey = new Map<string, MarketListing[]>();
  await Promise.all(
    lookupKeys.map(async (key) => {
      const [item, rarity] = key.split('::');
      const sold = await getCachedSoldListings(item, rarity);
      soldByKey.set(key, sold);
    })
  );

  const opportunities: ArbitrageOpportunity[] = [];

  for (const listing of active) {
    const soldListings = soldByKey.get(`${listing.item}::${listing.rarity}`) ?? [];
    const evaluation = evaluateListing(listing, soldListings);
    if (!evaluation) continue;

    const opp = buildOpportunity(
      listing,
      evaluation.fairPrice,
      evaluation.compCount,
      minProfitPercent,
      vendorPrices
    );
    if (opp) opportunities.push(opp);
  }

  return opportunities.sort((a, b) => b.profitPercent - a.profitPercent);
}

export async function getMarketSummary(limit = 50) {
  const listings = await getMarketListings({ limit, order: 'desc', has_sold: false });
  return listings.filter((l) => !l.has_sold && !l.has_expired);
}
