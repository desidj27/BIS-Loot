import { getCraftingCostForItem } from '@/lib/server/services/crafting';
import { jsonError, jsonOk } from '@/lib/server/api';

type RouteContext = { params: Promise<{ itemName: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { itemName } = await context.params;
    const costs = await getCraftingCostForItem(itemName);
    return jsonOk(costs);
  } catch (error) {
    return jsonError(error);
  }
}
