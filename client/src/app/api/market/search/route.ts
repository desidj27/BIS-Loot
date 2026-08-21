import { searchMarketListingsWithMeta } from '@/lib/server/darkerdb';
import {
  filterListingsByAttributes,
  sortListingsByNewest,
  sortListingsByPrice,
} from '@/lib/server/services/marketFilters';
import { jsonError, jsonOk } from '@/lib/server/api';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const item = searchParams.get('item') ?? undefined;
    const rarity = searchParams.get('rarity') ?? undefined;
    const gems = (searchParams.get('gems') as 'any' | 'gemmed' | 'no_gems') || 'any';
    const hasItem = Boolean(item?.trim());
    const limit = Number(searchParams.get('limit')) || (hasItem ? 250 : 50);
    const attributesRaw = searchParams.get('attributes') ?? undefined;

    const { listings, meta } = await searchMarketListingsWithMeta({ item, rarity, gems, limit });

    let filtered = listings;
    if (attributesRaw) {
      const attributeFilters = JSON.parse(attributesRaw) as Array<{
        field: string;
        display: string;
        min?: number;
      }>;
      filtered = filterListingsByAttributes(listings, attributeFilters);
    }

    const sorted = hasItem ? sortListingsByPrice(filtered) : sortListingsByNewest(filtered);
    return jsonOk({ listings: sorted, meta });
  } catch (error) {
    return jsonError(error);
  }
}
