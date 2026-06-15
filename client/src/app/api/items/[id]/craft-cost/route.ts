import { getCraftingCostForItemId } from '@/lib/server/services/crafting';
import { jsonError, jsonOk } from '@/lib/server/api';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const cost = await getCraftingCostForItemId(id);
    if (!cost) {
      return jsonError('No craft recipe found for this item', 404);
    }
    return jsonOk(cost);
  } catch (error) {
    return jsonError(error);
  }
}
