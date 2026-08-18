import { jsonError, jsonOk } from '@/lib/server/api';
import { requireSessionUser } from '@/lib/server/session';
import { checkStoredWatchers } from '@/lib/server/services/watcherRunner';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const body = (await request.json().catch(() => ({}))) as { watcherId?: string };
    const watcherId = typeof body.watcherId === 'string' ? body.watcherId : undefined;
    const result = await checkStoredWatchers(user.id, { watcherId });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
