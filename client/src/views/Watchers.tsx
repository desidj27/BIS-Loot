'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, MarketListing, WatcherPublic } from '@/api/client';
import MarketFilters from '@/components/MarketFilters';
import MarketListingCard from '@/components/MarketListingCard';
import { GameDivider, GamePanel } from '@/components/ui/game-panel';
import {
  gameButtonClass,
  gameButtonPrimaryClass,
  gameHeadingClass,
  gameInputClass,
  gameLabelClass,
  gameMutedTextClass,
  gameSidebarClass,
  gameTitleClass,
  itemCardRarityClass,
} from '@/lib/gameTheme';
import {
  buildAttributeLabelMap,
  type AttributeLabelMap,
} from '@/lib/listingStats';
import {
  defaultMarketFilters,
  fetchMarketListings,
  MarketFilterState,
} from '@/lib/marketFilters';
import { cn } from '@/lib/utils';
import { useSessionUser } from '@/lib/sessionClient';
import { MAX_WATCHERS_PER_USER, summarizeWatcher } from '@/lib/watchers';

function formatTimestamp(value: string | null): string {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleString();
}

export default function Watchers() {
  const { user, loading: sessionLoading } = useSessionUser();
  const [filters, setFilters] = useState<MarketFilterState>(defaultMarketFilters);
  const [maxPrice, setMaxPrice] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [watchers, setWatchers] = useState<WatcherPublic[]>([]);
  const [maxWatchers, setMaxWatchers] = useState<number | null>(MAX_WATCHERS_PER_USER);
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [attributeLabels, setAttributeLabels] = useState<AttributeLabelMap>(new Map());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const unlimited = maxWatchers == null;
  const atLimit = !unlimited && watchers.length >= maxWatchers;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loginError = params.get('loginError');
    if (loginError) setError(loginError);
  }, []);

  useEffect(() => {
    api.itemAttributes().then((attrs) => setAttributeLabels(buildAttributeLabelMap(attrs))).catch(() => {});
  }, []);

  const loadWatchers = useCallback(async () => {
    if (!user) {
      setWatchers([]);
      return;
    }
    try {
      const data = await api.listWatchers();
      setWatchers(data.watchers);
      setMaxWatchers(data.maxWatchers);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [user]);

  useEffect(() => {
    void loadWatchers();
  }, [loadWatchers]);

  const runPreview = useCallback(async (searchFilters: MarketFilterState) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchMarketListings(searchFilters);
      const parsedMax = maxPrice.trim() === '' ? null : Number(maxPrice);
      const priced =
        parsedMax !== null && Number.isFinite(parsedMax)
          ? data.filter((listing) => (listing.price_per_unit ?? listing.price) <= parsedMax)
          : data;
      setListings(priced);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [maxPrice]);

  async function handleCreate() {
    const itemName = filters.itemName.trim();
    const parsedMax = maxPrice.trim() === '' ? null : Number(maxPrice);

    if (atLimit) {
      setError(`You can watch up to ${maxWatchers ?? 'unlimited'} items at a time. Delete one first.`);
      return;
    }
    if (!itemName) {
      setError('Pick an item to watch.');
      return;
    }
    if (!webhookUrl.trim()) {
      setError('Paste a Discord webhook URL.');
      return;
    }
    if (parsedMax !== null && (!Number.isFinite(parsedMax) || parsedMax <= 0)) {
      setError('Max price must be a positive number.');
      return;
    }
    if (parsedMax === null && filters.attributes.length === 0) {
      setError('Set a max price, or add at least one roll filter.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const data = await api.createWatcher({
        itemName,
        rarity: filters.rarity,
        gems: filters.gems,
        attributes: filters.attributes,
        maxPrice: parsedMax,
        webhookUrl: webhookUrl.trim(),
      });
      setWatchers(data.watchers);
      setMaxWatchers(data.maxWatchers);
      setWebhookUrl('');
      setNotice(
        data.maxWatchers == null
          ? `Watcher saved (${data.watchers.length}). Discord will ping when a new matching listing appears.`
          : `Watcher saved (${data.watchers.length}/${data.maxWatchers}). Discord will ping when a new matching listing appears.`
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTestWebhook() {
    if (!webhookUrl.trim()) {
      setError('Paste a Discord webhook URL to test.');
      return;
    }

    setTesting(true);
    setError(null);
    setNotice(null);
    try {
      await api.testWatcherWebhook(webhookUrl.trim(), filters.itemName.trim() || undefined);
      setNotice('Test ping sent. Check your Discord channel.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTesting(false);
    }
  }

  async function handleCheckNow(watcher: WatcherPublic) {
    setError(null);
    try {
      const data = await api.checkWatchers(watcher.id);
      setWatchers(data.watchers);
      const result = data.results[0];
      if (result?.error) setError(result.error);
      else if (result?.notifiedListingIds.length) {
        setNotice(
          `Sent ${result.notifiedListingIds.length} Discord ping${result.notifiedListingIds.length === 1 ? '' : 's'}.`
        );
      } else {
        setNotice('No new matching listings right now.');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleToggle(watcher: WatcherPublic) {
    const data = await api.updateWatcher(watcher.id, { enabled: !watcher.enabled });
    setWatchers(data.watchers);
  }

  async function handleDelete(id: string) {
    const data = await api.deleteWatcher(id);
    setWatchers(data.watchers);
  }

  async function handleResetSeen(id: string) {
    const data = await api.updateWatcher(id, { resetSeen: true });
    setWatchers(data.watchers);
    setNotice('Cleared seen listings. The next check can ping current matches.');
  }

  if (sessionLoading) {
    return <p className={gameMutedTextClass}>Checking Discord login…</p>;
  }

  if (!user) {
    return (
      <GamePanel className="p-4 sm:p-6">
        <h2 className={gameTitleClass}>Discord Watchers</h2>
        <p className={cn('mt-2', gameMutedTextClass)}>
          Log in with Discord to watch up to {MAX_WATCHERS_PER_USER} items. We&apos;ll ping your webhook
          when a listing matches your rolls or price.
        </p>
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        <a
          href="/api/auth/discord"
          className={cn(gameButtonPrimaryClass, 'mt-4 inline-flex w-auto items-center justify-center no-underline hover:no-underline')}
        >
          Login with Discord
        </a>
      </GamePanel>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <GamePanel className="hidden p-4 sm:block sm:p-6">
        <h2 className={gameTitleClass}>Discord Watchers</h2>
        <p className={cn('mt-1', gameMutedTextClass)}>
          Signed in as {user.username}.{' '}
          {unlimited
            ? 'No watcher limit on this account.'
            : `Watch up to ${maxWatchers} items.`}{' '}
          Checks run about every 5 minutes.
        </p>
      </GamePanel>

      {error && (
        <div className="border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div className="border border-[#8a7355]/50 bg-[#241c14]/80 px-4 py-3 text-sm text-[#e5b56e]">
          {notice}
        </div>
      )}

      <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-[280px_1fr]">
        <div className={cn('space-y-4', gameSidebarClass)}>
          <MarketFilters
            filters={filters}
            onChange={setFilters}
            onSearch={runPreview}
            loading={loading}
            submitLabel="Preview matches"
            showAd={false}
          />

          <GamePanel className="p-3 sm:p-4">
            <h3 className={gameHeadingClass}>Notify</h3>
            <GameDivider className="px-0" />

            <label className="flex flex-col gap-1.5">
              <span className={gameLabelClass}>Max unit price</span>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="Optional gold cap"
                className={gameInputClass}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={gameLabelClass}>Discord webhook URL</span>
              <input
                type="password"
                autoComplete="off"
                placeholder="https://discord.com/api/webhooks/…"
                className={gameInputClass}
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
              <span className="text-[11px] text-[#8a7f72]">
                Channel Settings → Integrations → Webhooks. Stored on your BisLoot account.
              </span>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={gameButtonClass}
                disabled={testing}
                onClick={() => void handleTestWebhook()}
              >
                {testing ? 'Sending…' : 'Test ping'}
              </button>
              <button
                type="button"
                className={cn(gameButtonPrimaryClass, 'w-auto px-3')}
                disabled={saving || atLimit}
                onClick={() => void handleCreate()}
              >
                {saving ? 'Saving…' : atLimit ? 'Limit reached' : 'Create watcher'}
              </button>
            </div>
          </GamePanel>
        </div>

        <div className="min-w-0 space-y-4 sm:space-y-6">
          <GamePanel className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className={gameHeadingClass}>Active watchers</h3>
              <span className="text-xs text-[#8a7f72]">
                {unlimited ? watchers.length : `${watchers.length} / ${maxWatchers}`}
              </span>
            </div>
            <GameDivider className="px-0" />

            {watchers.length === 0 ? (
              <p className={gameMutedTextClass}>
                No watchers yet. Set an item, rolls and/or a max price, paste a webhook, then create
                one.
              </p>
            ) : (
              <ul className="space-y-3">
                {watchers.map((watcher) => (
                  <li key={watcher.id} className="border border-[#3a342c] bg-[#0a0908] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={cn('font-[Cinzel] font-semibold', itemCardRarityClass(watcher.rarity || 'Common'))}>
                          {watcher.itemName}
                        </p>
                        <p className="mt-1 text-xs text-[#8a7f72]">{summarizeWatcher(watcher)}</p>
                        <p className="mt-1 text-[11px] text-[#6b6258]">{watcher.webhookMasked}</p>
                      </div>
                      <span
                        className={cn(
                          'text-[10px] font-semibold uppercase tracking-wide',
                          watcher.enabled ? 'text-[#71AD31]' : 'text-[#8a7f72]'
                        )}
                      >
                        {watcher.enabled ? 'On' : 'Off'}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] text-[#6b6258]">
                      Last check {formatTimestamp(watcher.lastCheckedAt)}
                      {watcher.lastNotifiedAt ? ` · Last ping ${formatTimestamp(watcher.lastNotifiedAt)}` : ''}
                    </p>
                    {watcher.lastError ? (
                      <p className="mt-1 text-xs text-red-300">{watcher.lastError}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className={gameButtonClass} onClick={() => void handleToggle(watcher)}>
                        {watcher.enabled ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        type="button"
                        className={gameButtonClass}
                        onClick={() => void handleCheckNow(watcher)}
                      >
                        Check now
                      </button>
                      <button type="button" className={gameButtonClass} onClick={() => void handleResetSeen(watcher.id)}>
                        Re-alert current
                      </button>
                      <button
                        type="button"
                        className={cn(gameButtonClass, 'text-red-300 hover:text-red-200')}
                        onClick={() => void handleDelete(watcher.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </GamePanel>

          {listings.length > 0 && (
            <div className="space-y-3">
              <h3 className={gameHeadingClass}>Preview · {listings.length} match{listings.length === 1 ? '' : 'es'}</h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {listings.map((listing) => (
                  <MarketListingCard
                    key={listing.id}
                    listing={listing}
                    attributeLabels={attributeLabels}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
