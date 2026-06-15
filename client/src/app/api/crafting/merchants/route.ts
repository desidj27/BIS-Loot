import { getCraftMerchants } from '@/lib/server/recipes';
import { jsonOk } from '@/lib/server/api';

export async function GET() {
  return jsonOk(getCraftMerchants());
}
