import { searchItems } from '@/lib/server/darkerdb';
import { jsonError, jsonOk } from '@/lib/server/api';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') ?? '';
    if (!q) {
      return jsonOk([]);
    }
    const items = await searchItems(q);
    return jsonOk(items);
  } catch (error) {
    return jsonError(error);
  }
}
