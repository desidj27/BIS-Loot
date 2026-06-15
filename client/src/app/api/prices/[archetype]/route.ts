import {
  getFairPrice,
  getLowestListingPrice,
  getMarketListings,
} from '@/lib/server/darkerdb';
import { jsonError, jsonOk } from '@/lib/server/api';

type RouteContext = { params: Promise<{ archetype: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { archetype } = await context.params;
    const [fairPrice, lowestPrice, listings] = await Promise.all([
      getFairPrice(archetype),
      getLowestListingPrice(archetype),
      getMarketListings({ archetype, limit: 10, order: 'asc', has_sold: false }),
    ]);

    return jsonOk({
      archetype,
      fairPrice,
      lowestPrice,
      activeListings: listings.filter((l) => !l.has_sold && !l.has_expired).length,
    });
  } catch (error) {
    return jsonError(error);
  }
}
