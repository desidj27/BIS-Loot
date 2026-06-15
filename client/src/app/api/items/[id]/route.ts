import { getItem } from '@/lib/server/darkerdb';
import { jsonError, jsonOk } from '@/lib/server/api';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const item = await getItem(id);
    if (!item) {
      return jsonError('Item not found', 404);
    }
    return jsonOk(item);
  } catch (error) {
    return jsonError(error);
  }
}
