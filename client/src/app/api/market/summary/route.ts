import { getMarketSummary } from '@/lib/server/services/arbitrage';
import { jsonError, jsonOk } from '@/lib/server/api';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit')) || 50;
    const summary = await getMarketSummary(limit);
    return jsonOk(summary);
  } catch (error) {
    return jsonError(error);
  }
}
