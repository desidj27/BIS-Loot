import { jsonError, jsonOk } from '@/lib/server/api';
import { checkAllUsersWatchers } from '@/lib/server/services/watcherRunner';

export const runtime = 'nodejs';
export const maxDuration = 60;

function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  try {
    if (!isAuthorizedCron(request)) {
      return jsonError('Unauthorized', 401);
    }

    const summary = await checkAllUsersWatchers();
    return jsonOk(summary);
  } catch (error) {
    return jsonError(error);
  }
}
