import { jsonError, jsonOk } from '@/lib/server/api';
import { requireSessionUser } from '@/lib/server/session';
import { isDiscordWebhookUrl } from '@/lib/server/services/watchers';
import { createWatcherId, seedAndSaveWatcher } from '@/lib/server/services/watcherRunner';
import { toPublicWatcher } from '@/lib/server/services/watcherPublic';
import { getUserWatchers, watcherStorageMode } from '@/lib/server/watcherStore';
import { maxWatchersForUser, type WatcherRule } from '@/lib/watchers';

export async function GET() {
  try {
    const user = await requireSessionUser();
    const watchers = await getUserWatchers(user.id);
    return jsonOk({
      user,
      watchers: watchers.map(toPublicWatcher),
      maxWatchers: maxWatchersForUser(user.id),
      storage: watcherStorageMode(),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const current = await getUserWatchers(user.id);
    const cap = maxWatchersForUser(user.id);
    if (cap != null && current.length >= cap) {
      return jsonError(`You can watch up to ${cap} items at a time`, 400);
    }

    const body = (await request.json()) as Partial<WatcherRule>;
    const itemName = typeof body.itemName === 'string' ? body.itemName.trim() : '';
    const webhookUrl = typeof body.webhookUrl === 'string' ? body.webhookUrl.trim() : '';
    const maxPrice =
      body.maxPrice === null || body.maxPrice === undefined ? null : Number(body.maxPrice);

    if (!itemName) return jsonError('Pick an item to watch', 400);
    if (!isDiscordWebhookUrl(webhookUrl)) {
      return jsonError('Enter a valid Discord webhook URL', 400);
    }
    if (maxPrice !== null && (!Number.isFinite(maxPrice) || maxPrice <= 0)) {
      return jsonError('Max price must be a positive number', 400);
    }

    const attributes = Array.isArray(body.attributes)
      ? body.attributes.filter(
          (attr) => attr && typeof attr.field === 'string' && typeof attr.display === 'string'
        )
      : [];

    if (maxPrice === null && attributes.length === 0) {
      return jsonError('Set a max price, or add at least one roll filter', 400);
    }

    const watcher: WatcherRule = {
      id: createWatcherId(),
      itemName,
      rarity: typeof body.rarity === 'string' ? body.rarity : '',
      gems: body.gems === 'gemmed' || body.gems === 'no_gems' ? body.gems : 'any',
      attributes,
      maxPrice,
      webhookUrl,
      enabled: true,
      createdAt: new Date().toISOString(),
      lastCheckedAt: null,
      lastNotifiedAt: null,
      lastError: null,
      seenListingIds: [],
    };

    const saved = await seedAndSaveWatcher(user.id, watcher);
    return jsonOk({
      watcher: saved.watcher,
      watchers: saved.watchers,
      maxWatchers: maxWatchersForUser(user.id),
    });
  } catch (error) {
    return jsonError(error);
  }
}
