import type { AttributeFilter, WatcherCheckPayload, WatcherCheckResult } from '@/api/client';
import type { GemStatus } from '@/lib/marketFilters';

export const MAX_WATCHERS_PER_USER = 3;
const MAX_SEEN_IDS = 250;

export interface WatcherRule {
  id: string;
  itemName: string;
  rarity: string;
  gems: GemStatus;
  attributes: AttributeFilter[];
  maxPrice: number | null;
  webhookUrl: string;
  enabled: boolean;
  createdAt: string;
  lastCheckedAt: string | null;
  lastNotifiedAt: string | null;
  lastError: string | null;
  seenListingIds: number[];
}

export function capSeenListingIds(ids: number[]): number[] {
  if (ids.length <= MAX_SEEN_IDS) return ids;
  return ids.slice(ids.length - MAX_SEEN_IDS);
}

export function toCheckPayload(watcher: WatcherRule): WatcherCheckPayload {
  return {
    id: watcher.id,
    itemName: watcher.itemName,
    rarity: watcher.rarity,
    gems: watcher.gems,
    attributes: watcher.attributes,
    maxPrice: watcher.maxPrice,
    webhookUrl: watcher.webhookUrl,
    seenListingIds: watcher.seenListingIds,
  };
}

export function maskWebhook(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const token = parts[parts.length - 1] ?? '';
    const suffix = token.slice(-4);
    return `discord.com/api/webhooks/…${suffix}`;
  } catch {
    return 'Discord webhook';
  }
}

export function summarizeWatcher(watcher: {
  rarity: string;
  maxPrice: number | null;
  gems: string;
  attributes: AttributeFilter[];
}): string {
  const parts: string[] = [];
  if (watcher.rarity) parts.push(watcher.rarity);
  if (watcher.maxPrice != null) parts.push(`≤ ${watcher.maxPrice.toLocaleString()}G ea`);
  if (watcher.gems === 'gemmed') parts.push('Gemmed');
  if (watcher.gems === 'no_gems') parts.push('No gems');
  for (const attr of watcher.attributes) {
    if (attr.min === undefined) parts.push(attr.display);
    else parts.push(`${attr.display} ≥ ${attr.min}`);
  }
  return parts.join(' · ') || 'Any listing';
}

export function applyCheckResults(
  watchers: WatcherRule[],
  results: WatcherCheckResult[],
  options: { seedSeen?: boolean } = {}
): WatcherRule[] {
  const byId = new Map(results.map((result) => [result.id, result]));
  const checkedAt = new Date().toISOString();

  return watchers.map((watcher) => {
    const result = byId.get(watcher.id);
    if (!result) return watcher;

    const extraSeen = options.seedSeen ? result.matchListingIds : result.notifiedListingIds;
    const seenListingIds = capSeenListingIds([
      ...watcher.seenListingIds.filter((id) => !extraSeen.includes(id)),
      ...extraSeen,
    ]);

    return {
      ...watcher,
      seenListingIds,
      lastCheckedAt: checkedAt,
      lastError: result.error ?? null,
      lastNotifiedAt:
        result.notifiedListingIds.length > 0 ? checkedAt : watcher.lastNotifiedAt,
    };
  });
}
