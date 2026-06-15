import { jsonOk } from '@/lib/server/api';

export async function GET() {
  return jsonOk({ status: 'ok', source: 'DarkerDB', api: 'https://api.darkerdb.com' });
}
