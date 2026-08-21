import { getMarketTrends } from '@/lib/server/services/marketTrends';
import { jsonError, jsonOk } from '@/lib/server/api';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const windowParam = searchParams.get('window');
    const window = windowParam === '1w' ? '1w' : '1d';
    const trends = await getMarketTrends(window);
    return jsonOk(trends);
  } catch (error) {
    return jsonError(error);
  }
}
