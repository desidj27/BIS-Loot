import { searchMarketListings } from '@/lib/server/darkerdb';
import { filterListingsByAttributes, sortListingsByPrice } from '@/lib/server/services/marketFilters';
import { jsonError, jsonOk } from '@/lib/server/api';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const item = searchParams.get('item') ?? undefined;
    const rarity = searchParams.get('rarity') ?? undefined;
    const gems = (searchParams.get('gems') as 'any' | 'gemmed' | 'no_gems') || 'any';
    const limit = Number(searchParams.get('limit')) || 100;
    const attributesRaw = searchParams.get('attributes') ?? undefined;

    let listings = await searchMarketListings({ item, rarity, gems, limit });

    if (attributesRaw) {
      const attributeFilters = JSON.parse(attributesRaw) as Array<{
        field: string;
        display: string;
        min?: number;
      }>;
      listings = filterListingsByAttributes(listings, attributeFilters);
    }

    return jsonOk(sortListingsByPrice(listings));
  } catch (error) {
    return jsonError(error);
  }
}
