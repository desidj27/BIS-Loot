import { findArbitrageOpportunities } from '@/lib/server/services/arbitrage';
import { jsonError, jsonOk } from '@/lib/server/api';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const minProfit = Number(searchParams.get('minProfit')) || 30;
    const limit = Number(searchParams.get('limit')) || 200;
    const opportunities = await findArbitrageOpportunities(minProfit, limit);
    return jsonOk(opportunities);
  } catch (error) {
    return jsonError(error);
  }
}
