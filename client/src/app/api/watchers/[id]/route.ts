import { jsonError, jsonOk } from '@/lib/server/api';
import { requireSessionUser } from '@/lib/server/session';
import { isDiscordWebhookUrl } from '@/lib/server/services/watchers';
import { replaceAndSeedWatcher } from '@/lib/server/services/watcherRunner';
import { toPublicWatcher } from '@/lib/server/services/watcherPublic';
import { getUserWatchers, setUserWatchers } from '@/lib/server/watcherStore';
import { maxWatchersForUser, type WatcherRule } from '@/lib/watchers';

type RouteContext = { params: Promise<{ id: string }> };

type PatchBody = {
  enabled?: boolean;
  resetSeen?: boolean;
  itemName?: string;
  rarity?: string;
  gems?: WatcherRule['gems'];
  attributes?: WatcherRule['attributes'];
  maxPrice?: number | null;
  webhookUrl?: string;
};

function isRuleEdit(body: PatchBody): boolean {
  return (
    typeof body.itemName === 'string' ||
    typeof body.rarity === 'string' ||
    body.gems !== undefined ||
    Array.isArray(body.attributes) ||
    body.maxPrice !== undefined ||
    typeof body.webhookUrl === 'string'
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireSessionUser();
    const { id } = await context.params;
    const body = (await request.json()) as PatchBody;
    const current = await getUserWatchers(user.id);
    const existing = current.find((watcher) => watcher.id === id);
    if (!existing) return jsonError('Watcher not found', 404);

    if (!isRuleEdit(body)) {
      const next = current.map((watcher) => {
        if (watcher.id !== id) return watcher;
        return {
          ...watcher,
          enabled: typeof body.enabled === 'boolean' ? body.enabled : watcher.enabled,
          seenListingIds: body.resetSeen ? [] : watcher.seenListingIds,
        };
      });

      const saved = await setUserWatchers(user.id, next);
      return jsonOk({
        watchers: saved.map(toPublicWatcher),
        maxWatchers: maxWatchersForUser(user.id),
      });
    }

    const itemName =
      typeof body.itemName === 'string' ? body.itemName.trim() : existing.itemName.trim();
    const webhookInput =
      typeof body.webhookUrl === 'string' ? body.webhookUrl.trim() : '';
    const webhookUrl = webhookInput || existing.webhookUrl;
    const maxPrice =
      body.maxPrice === undefined
        ? existing.maxPrice
        : body.maxPrice === null
          ? null
          : Number(body.maxPrice);

    if (!itemName) return jsonError('Pick an item to watch', 400);
    if (!isDiscordWebhookUrl(webhookUrl)) {
      return jsonError(
        webhookInput ? 'Enter a valid Discord webhook URL' : 'Saved webhook is invalid; paste a new one',
        400
      );
    }
    if (maxPrice !== null && (!Number.isFinite(maxPrice) || maxPrice <= 0)) {
      return jsonError('Max price must be a positive number', 400);
    }

    const attributes = Array.isArray(body.attributes)
      ? body.attributes.filter(
          (attr) => attr && typeof attr.field === 'string' && typeof attr.display === 'string'
        )
      : existing.attributes;

    if (maxPrice === null && attributes.length === 0) {
      return jsonError('Set a max price, or add at least one roll filter', 400);
    }

    const updated: WatcherRule = {
      ...existing,
      itemName,
      rarity: typeof body.rarity === 'string' ? body.rarity : existing.rarity,
      gems:
        body.gems === 'gemmed' || body.gems === 'no_gems' || body.gems === 'any'
          ? body.gems
          : existing.gems,
      attributes,
      maxPrice,
      webhookUrl,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : existing.enabled,
    };

    const saved = await replaceAndSeedWatcher(user.id, updated);
    return jsonOk({
      watcher: saved.watcher,
      watchers: saved.watchers,
      maxWatchers: maxWatchersForUser(user.id),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireSessionUser();
    const { id } = await context.params;
    const current = await getUserWatchers(user.id);
    const saved = await setUserWatchers(
      user.id,
      current.filter((watcher) => watcher.id !== id)
    );
    return jsonOk({
      watchers: saved.map(toPublicWatcher),
      maxWatchers: maxWatchersForUser(user.id),
    });
  } catch (error) {
    return jsonError(error);
  }
}
