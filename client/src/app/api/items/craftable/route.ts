import { getCraftableGear } from '@/lib/server/services/craftableGear';
import { ITEMS_CACHE_TTL_MS, serverCache } from '@/lib/server/cache';
import { jsonError, jsonOk } from '@/lib/server/api';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const merchant = searchParams.get('merchant') ?? undefined;
    const includeCosts = searchParams.get('costs') !== 'false';
    const cacheKey = `${merchant ?? '__all__'}:${includeCosts ? 'full' : 'fast'}`;

    if (includeCosts) {
      const cached = serverCache.craftable.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return jsonOk(cached.data);
      }
    }

    const data = await getCraftableGear(merchant, includeCosts);
    if (includeCosts) {
      serverCache.craftable.set(cacheKey, { data, expiresAt: Date.now() + ITEMS_CACHE_TTL_MS });
    }
    return jsonOk(data);
  } catch (error) {
    return jsonError(error);
  }
}
