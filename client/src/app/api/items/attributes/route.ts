import { getItemAttributes } from '@/lib/server/darkerdb';
import { getAttributeRangesForItem } from '@/lib/server/services/itemAttributes';
import { jsonError, jsonOk } from '@/lib/server/api';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const item = searchParams.get('item') ?? undefined;
    const rarity = searchParams.get('rarity') ?? undefined;

    if (item?.trim()) {
      const ranges = await getAttributeRangesForItem(item, rarity);
      return jsonOk(ranges);
    }

    const attributes = await getItemAttributes();
    return jsonOk(attributes);
  } catch (error) {
    return jsonError(error);
  }
}
