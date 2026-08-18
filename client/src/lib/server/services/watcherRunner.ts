import type { WatcherCheckResult } from '@/api/client';
import type { WatcherRule } from '@/lib/watchers';
import { applyCheckResults, toCheckPayload } from '@/lib/watchers';
import { getUserWatchers, setUserWatchers } from '../watcherStore';
import { findWatcherMatches, notifyWatcherMatches } from './watchers';
import { toPublicWatcher, type WatcherPublic } from './watcherPublic';

export type { WatcherPublic };

export async function checkStoredWatchers(
  userId: string,
  options: { watcherId?: string; dryRun?: boolean } = {}
): Promise<{ watchers: WatcherPublic[]; results: WatcherCheckResult[] }> {
  const watchers = await getUserWatchers(userId);
  const selected = options.watcherId
    ? watchers.filter((watcher) => watcher.id === options.watcherId)
    : watchers.filter((watcher) => watcher.enabled);

  const results: WatcherCheckResult[] = [];
  for (const watcher of selected) {
    const payload = toCheckPayload(watcher);
    try {
      const matches = await findWatcherMatches(payload);
      const notifiedListingIds = options.dryRun
        ? []
        : await notifyWatcherMatches(payload, matches, userId);
      results.push({
        id: watcher.id,
        matchCount: matches.length,
        matchListingIds: matches.map((listing) => listing.id),
        notifiedListingIds,
      });
    } catch (error) {
      results.push({
        id: watcher.id,
        matchCount: 0,
        matchListingIds: [],
        notifiedListingIds: [],
        error: error instanceof Error ? error.message : 'Watcher check failed',
      });
    }
  }

  const next = applyCheckResults(watchers, results, { seedSeen: Boolean(options.dryRun) });
  const saved = await setUserWatchers(userId, next);
  return {
    watchers: saved.map(toPublicWatcher),
    results,
  };
}

export function createWatcherId(): string {
  return crypto.randomUUID();
}

export async function seedAndSaveWatcher(
  userId: string,
  watcher: WatcherRule
): Promise<{ watcher: WatcherPublic; watchers: WatcherPublic[] }> {
  const matches = await findWatcherMatches(toCheckPayload(watcher));
  const seeded: WatcherRule = {
    ...watcher,
    seenListingIds: matches.map((listing) => listing.id),
    lastCheckedAt: new Date().toISOString(),
    lastError: null,
  };
  const current = await getUserWatchers(userId);
  const saved = await setUserWatchers(userId, [seeded, ...current]);
  const publicWatchers = saved.map(toPublicWatcher);
  return {
    watcher: publicWatchers.find((entry) => entry.id === seeded.id) ?? toPublicWatcher(seeded),
    watchers: publicWatchers,
  };
}
