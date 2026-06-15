import { getAllItemsPaginated } from '@/lib/server/darkerdb';
import { sortGearItems } from '@/lib/server/services/items';
import { ITEMS_CACHE_TTL_MS, serverCache } from '@/lib/server/cache';
import { jsonError, jsonOk } from '@/lib/server/api';

export async function GET() {
  try {
    if (serverCache.items && serverCache.items.expiresAt > Date.now()) {
      return jsonOk(serverCache.items.data);
    }

    const allItems = await getAllItemsPaginated();
    const data = sortGearItems(allItems);
    serverCache.items = { data, expiresAt: Date.now() + ITEMS_CACHE_TTL_MS };
    return jsonOk(data);
  } catch (error) {
    return jsonError(error);
  }
}
