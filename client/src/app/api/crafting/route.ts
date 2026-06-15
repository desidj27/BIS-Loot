import { getCraftingCosts } from '@/lib/server/services/crafting';
import { jsonError, jsonOk } from '@/lib/server/api';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const merchant = searchParams.get('merchant') ?? undefined;
    const costs = await getCraftingCosts(merchant);
    return jsonOk(costs);
  } catch (error) {
    return jsonError(error);
  }
}
