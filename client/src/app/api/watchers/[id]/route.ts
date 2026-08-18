import { jsonError, jsonOk } from '@/lib/server/api';
import { requireSessionUser } from '@/lib/server/session';
import { toPublicWatcher } from '@/lib/server/services/watcherPublic';
import { getUserWatchers, setUserWatchers } from '@/lib/server/watcherStore';
import { MAX_WATCHERS_PER_USER } from '@/lib/watchers';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireSessionUser();
    const { id } = await context.params;
    const body = (await request.json()) as { enabled?: boolean; resetSeen?: boolean };
    const current = await getUserWatchers(user.id);
    const existing = current.find((watcher) => watcher.id === id);
    if (!existing) return jsonError('Watcher not found', 404);

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
      maxWatchers: MAX_WATCHERS_PER_USER,
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
      maxWatchers: MAX_WATCHERS_PER_USER,
    });
  } catch (error) {
    return jsonError(error);
  }
}
