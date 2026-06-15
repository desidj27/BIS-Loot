import { getPriceHistory } from '@/lib/server/darkerdb';
import { jsonError, jsonOk } from '@/lib/server/api';

type RouteContext = { params: Promise<{ archetype: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { archetype } = await context.params;
    const { searchParams } = new URL(request.url);
    const interval = searchParams.get('interval') || '1h';
    const history = await getPriceHistory(archetype, interval);
    return jsonOk(history);
  } catch (error) {
    return jsonError(error);
  }
}
