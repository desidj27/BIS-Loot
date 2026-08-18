import { jsonError, jsonOk } from '@/lib/server/api';
import { requireSessionUser } from '@/lib/server/session';
import { isDiscordWebhookUrl, sendWatcherTestPing } from '@/lib/server/services/watchers';

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const body = (await request.json()) as { webhookUrl?: string; itemName?: string };
    const webhookUrl = body.webhookUrl?.trim() ?? '';
    if (!isDiscordWebhookUrl(webhookUrl)) {
      return jsonError('Enter a valid Discord webhook URL', 400);
    }

    await sendWatcherTestPing(webhookUrl, body.itemName, user.id);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
