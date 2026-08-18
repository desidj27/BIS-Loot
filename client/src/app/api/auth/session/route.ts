import { jsonOk } from '@/lib/server/api';
import { getSessionUser } from '@/lib/server/session';

export async function GET() {
  const user = await getSessionUser();
  return jsonOk({ user });
}
