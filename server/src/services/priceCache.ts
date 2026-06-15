import {
  getAllItemsPaginated,
  getFairPrice,
  getLowestListingPrice,
  getMarketListings,
} from '../darkerdb.js';

const PRICE_CACHE_TTL_MS = 10 * 60 * 1000;
const priceCache = new Map<string, { price: number | null; expiresAt: number }>();
const avgMarketCache = new Map<string, { price: number | null; expiresAt: number }>();
let vendorPriceByArchetype: Map<string, number> | null = null;
let vendorPricePromise: Promise<Map<string, number>> | null = null;

/** Ingredients with no market/vendor listing but a known in-game value. */
const FIXED_INGREDIENT_PRICES: Record<string, number> = {
  GoldCoins: 1,
};

async function getVendorPriceIndex(): Promise<Map<string, number>> {
  if (vendorPriceByArchetype) return vendorPriceByArchetype;

  if (!vendorPricePromise) {
    vendorPricePromise = getAllItemsPaginated().then((items) => {
      const index = new Map<string, number>();
      for (const item of items) {
        if (item.vendor_price <= 0) continue;
        const existing = index.get(item.archetype);
        if (existing === undefined || item.vendor_price < existing) {
          index.set(item.archetype, item.vendor_price);
        }
      }
      vendorPriceByArchetype = index;
      vendorPricePromise = null;
      return index;
    });
  }

  return vendorPricePromise;
}

export async function getVendorPriceMap(): Promise<Map<string, number>> {
  return getVendorPriceIndex();
}

export async function getCachedMarketPrice(
  archetype: string,
  options: { skipFairPrice?: boolean } = {}
): Promise<number | null> {
  const fixedPrice = FIXED_INGREDIENT_PRICES[archetype];
  if (fixedPrice !== undefined) {
    return fixedPrice;
  }

  const cached = priceCache.get(archetype);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.price;
  }

  let price = await getLowestListingPrice(archetype);
  if (price === null) {
    const vendorPrices = await getVendorPriceIndex();
    price = vendorPrices.get(archetype) ?? null;
  }
  if (price === null && !options.skipFairPrice) {
    price = await getFairPrice(archetype);
  }

  priceCache.set(archetype, { price, expiresAt: Date.now() + PRICE_CACHE_TTL_MS });
  return price;
}

export async function resolvePricesForArchetypes(
  archetypes: string[],
  concurrency = 20,
  options: { skipFairPrice?: boolean } = {}
): Promise<Map<string, number | null>> {
  const unique = [...new Set(archetypes)];
  const prices = new Map<string, number | null>();

  for (let i = 0; i < unique.length; i += concurrency) {
    const batch = unique.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(
        async (archetype) =>
          [archetype, await getCachedMarketPrice(archetype, options)] as const
      )
    );
    for (const [archetype, price] of results) {
      prices.set(archetype, price);
    }
  }

  return prices;
}

async function averageListingPriceForItem(
  itemId: string,
  listings: Awaited<ReturnType<typeof getMarketListings>>
): Promise<number | null> {
  const active = listings.filter(
    (listing) => !listing.has_sold && !listing.has_expired && listing.item_id === itemId
  );
  if (active.length === 0) return null;

  const total = active.reduce((sum, listing) => sum + (listing.price_per_unit ?? listing.price), 0);
  return Math.round(total / active.length);
}

function lowestListingPrice(
  listings: Awaited<ReturnType<typeof getMarketListings>>
): number | null {
  const active = listings.filter((listing) => !listing.has_sold && !listing.has_expired);
  if (active.length === 0) return null;

  return Math.min(...active.map((listing) => listing.price_per_unit ?? listing.price));
}

export async function resolveAverageMarketPricesForItems(
  items: Array<{ id: string; archetype: string }>,
  concurrency = 20
): Promise<Map<string, number | null>> {
  const prices = new Map<string, number | null>();
  const byArchetype = new Map<string, string[]>();

  for (const item of items) {
    const ids = byArchetype.get(item.archetype) ?? [];
    ids.push(item.id);
    byArchetype.set(item.archetype, ids);
  }

  const archetypes = [...byArchetype.keys()];

  for (let i = 0; i < archetypes.length; i += concurrency) {
    const batch = archetypes.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (archetype) => {
        const itemIds = byArchetype.get(archetype) ?? [];
        const uncachedIds = itemIds.filter((id) => {
          const cached = avgMarketCache.get(id);
          if (cached && cached.expiresAt > Date.now()) {
            prices.set(id, cached.price);
            return false;
          }
          return true;
        });

        if (uncachedIds.length === 0) return;

        const listings = await getMarketListings({
          archetype,
          limit: 100,
          order: 'asc',
          has_sold: false,
        });
        const fallbackPrice = lowestListingPrice(listings);

        for (const itemId of uncachedIds) {
          const price = (await averageListingPriceForItem(itemId, listings)) ?? fallbackPrice;

          avgMarketCache.set(itemId, {
            price,
            expiresAt: Date.now() + PRICE_CACHE_TTL_MS,
          });
          prices.set(itemId, price);
        }
      })
    );
  }

  return prices;
}

export function clearPriceCache(): void {
  priceCache.clear();
  avgMarketCache.clear();
  vendorPriceByArchetype = null;
}
