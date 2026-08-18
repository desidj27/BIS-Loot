import type { WatcherRule } from '@/lib/watchers';
import { maskWebhook } from '@/lib/watchers';

export interface WatcherPublic extends Omit<WatcherRule, 'webhookUrl' | 'seenListingIds'> {
  webhookMasked: string;
}

export function toPublicWatcher(watcher: WatcherRule): WatcherPublic {
  const { webhookUrl: _webhookUrl, seenListingIds: _seenListingIds, ...rest } = watcher;
  return {
    ...rest,
    webhookMasked: maskWebhook(watcher.webhookUrl),
  };
}
