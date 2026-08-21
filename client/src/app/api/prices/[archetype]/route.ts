import {
  averageCheapestUnitPrice,
  getFairPriceFromHistory,
  getMarketListings,
  getPriceHistory,
} from '@/lib/server/darkerdb';
import { jsonError, jsonOk } from '@/lib/server/api';

type RouteContext = { params: Promise<{ archetype: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { archetype } = await context.params;
    const isItemId = /^id\.item\./i.test(archetype);

    const [history, listings] = await Promise.all([
      getPriceHistory(archetype, '1h'),
      getMarketListings(
        isItemId
          ? { item_id: archetype, limit: 50, order: 'asc', has_sold: false }
          : { archetype, limit: 50, order: 'asc', has_sold: false }
      ),
    ]);

    const active = listings.filter((listing) => {
      if (listing.listing_state) return listing.listing_state === 'active';
      return !listing.has_sold && !listing.has_expired;
    });

    return jsonOk({
      archetype,
      fairPrice: getFairPriceFromHistory(history),
      lowestPrice: averageCheapestUnitPrice(active),
      activeListings: active.length,
    });
  } catch (error) {
    return jsonError(error);
  }
}
