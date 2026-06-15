import { getMarketListings } from '@/lib/server/darkerdb';
import { jsonError, jsonOk } from '@/lib/server/api';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit')) || 50;
    const archetype = searchParams.get('archetype') ?? undefined;
    const listings = await getMarketListings({ limit, archetype, order: 'desc' });
    return jsonOk(listings.filter((l) => !l.has_sold && !l.has_expired));
  } catch (error) {
    return jsonError(error);
  }
}
