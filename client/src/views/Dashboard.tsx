'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, CraftCostResult, MarketListing, type MarketFreshness } from '@/api/client';
import CraftCostPanel from '@/components/CraftCostPanel';
import MarketFilters from '@/components/MarketFilters';
import MarketListingRow from '@/components/MarketListingRow';
import PopularTrendsPanel from '@/components/PopularTrendsPanel';
import { GameDivider, GamePanel } from '@/components/ui/game-panel';
import { cn } from '@/lib/utils';
import {
  gameButtonClass,
  gameHeadingClass,
  gameMutedTextClass,
  gameSidebarClass,
  gameTitleClass,
} from '@/lib/gameTheme';
import { fetchCraftCostsForLookup } from '@/lib/craftCost';
import {
  defaultMarketFilters,
  fetchMarketListings,
  MarketFilterState,
} from '@/lib/marketFilters';
import { buildAttributeLabelMap, type AttributeLabelMap } from '@/lib/listingStats';
import { preloadMarketPopular } from '@/lib/popularCache';

type FeedTab = 'live' | 'popular';

export default function Dashboard() {
  const [feedTab, setFeedTab] = useState<FeedTab>('live');
  const [filters, setFilters] = useState<MarketFilterState>(defaultMarketFilters);
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [marketMeta, setMarketMeta] = useState<{
    total?: number;
    freshness?: MarketFreshness;
  } | null>(null);
  const [attributeLabels, setAttributeLabels] = useState<AttributeLabelMap>(new Map());
  const [craftCosts, setCraftCosts] = useState<CraftCostResult[]>([]);
  const [craftLoading, setCraftLoading] = useState(false);
  const [craftRequested, setCraftRequested] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchGenerationRef = useRef(0);

  useEffect(() => {
    api.itemAttributes().then((attrs) => setAttributeLabels(buildAttributeLabelMap(attrs))).catch(() => {});
  }, []);

  useEffect(() => {
    const warm = () => preloadMarketPopular('1d');
    const idle =
      typeof window !== 'undefined' && 'requestIdleCallback' in window
        ? window.requestIdleCallback(warm, { timeout: 2500 })
        : null;
    const fallback = window.setTimeout(warm, idle == null ? 800 : 4000);

    return () => {
      if (idle != null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idle);
      }
      window.clearTimeout(fallback);
    };
  }, []);

  const runSearch = useCallback(async (searchFilters: MarketFilterState, silent = false) => {
    const generation = ++searchGenerationRef.current;

    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setListings([]);
      }
      setError(null);

      const { listings: results, meta } = await fetchMarketListings(searchFilters);
      if (generation !== searchGenerationRef.current) return;

      setListings(results);
      setMarketMeta(meta ?? null);
    } catch (err) {
      if (generation !== searchGenerationRef.current) return;
      setError((err as Error).message);
    } finally {
      if (generation !== searchGenerationRef.current) return;
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    runSearch(defaultMarketFilters);
  }, [runSearch]);

  useEffect(() => {
    setCraftCosts([]);
    setCraftRequested(false);
    setCraftLoading(false);
  }, [filters.itemName, filters.rarity]);

  async function loadCraftCosts() {
    const itemName = filters.itemName.trim();
    if (!itemName) return;

    setCraftRequested(true);
    setCraftLoading(true);
    try {
      const costs = await fetchCraftCostsForLookup(itemName, filters.rarity || undefined);
      setCraftCosts(costs);
    } catch {
      setCraftCosts([]);
    } finally {
      setCraftLoading(false);
    }
  }

  function handleSearch(searchFilters: MarketFilterState) {
    setFeedTab('live');
    setFilters(searchFilters);
    runSearch(searchFilters);
  }

  function handleRefresh() {
    runSearch(filters, true);
  }

  const showCraftPanel = craftLoading || craftCosts.length > 0;
  const showSearchLoading = loading && !refreshing;
  const itemSearch = filters.itemName.trim();
  const marketNotice =
    itemSearch && marketMeta?.freshness?.status === 'stale'
      ? `DarkerDB only has ${marketMeta.total ?? listings.length} active listing${
          (marketMeta.total ?? listings.length) === 1 ? '' : 's'
        } indexed for this item right now, and their scan is stale${
          marketMeta.freshness.age_seconds
            ? ` (about ${Math.max(1, Math.round(marketMeta.freshness.age_seconds / 60))} min old)`
            : ''
        }. BisLoot shows everything DarkerDB returns — the in-game market can have many more until DarkerDB rescans.`
      : null;
  const listingCountLabel =
    marketMeta?.total != null && marketMeta.total > listings.length
      ? `${listings.length} / ${marketMeta.total} listings`
      : `${listings.length} listings`;

  return (
    <div className="space-y-4 sm:space-y-6">
      <GamePanel className="hidden p-4 sm:block sm:p-6">
        <h2 className={gameTitleClass}>Live Market Feed</h2>
        <p className={cn('mt-1', gameMutedTextClass)}>
          Browse active listings, or check Popular for the most traded items and biggest movers.
        </p>
      </GamePanel>

      <div className="grid grid-cols-2 gap-1 border border-[#4a4338] bg-[#0a0908] p-1 sm:inline-flex">
        {(
          [
            { value: 'live', label: 'Live' },
            { value: 'popular', label: 'Popular' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={cn(
              'min-h-10 border px-4 py-2 font-[Cinzel] text-xs tracking-wide transition-colors sm:min-h-0',
              feedTab === tab.value
                ? 'border-[#8a7355] bg-[linear-gradient(180deg,#3d3020_0%,#241c14_100%)] text-[#f5d492]'
                : 'border-transparent text-[#8a7f72] hover:text-[#ddd6cb]'
            )}
            onClick={() => setFeedTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {feedTab === 'popular' ? (
        <PopularTrendsPanel />
      ) : (
        <>
          {marketNotice && (
            <div className="border border-[#8a7355]/50 bg-[#241c14]/80 px-4 py-3 text-sm text-[#e5b56e]">
              {marketNotice}
            </div>
          )}

          {error && (
            <div className="border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-[280px_1fr]">
            <div className={gameSidebarClass}>
              <MarketFilters
                filters={filters}
                onChange={setFilters}
                onSearch={handleSearch}
                loading={loading}
              />
            </div>

            <div className="min-w-0 space-y-4 sm:space-y-6">
              {filters.itemName.trim() && !craftRequested ? (
                <button
                  type="button"
                  className={cn(gameButtonClass, 'w-full sm:w-auto')}
                  onClick={() => void loadCraftCosts()}
                >
                  Load craft cost
                </button>
              ) : null}

              {showCraftPanel && (
                <div className="space-y-4">
                  {craftLoading && craftCosts.length === 0 ? (
                    <CraftCostPanel craftCost={null} loading={craftLoading} />
                  ) : craftRequested && !craftLoading && craftCosts.length === 0 ? (
                    <p className={gameMutedTextClass}>No craft recipe for this item.</p>
                  ) : (
                    craftCosts.map((cost) => (
                      <CraftCostPanel key={cost.id} craftCost={cost} loading={craftLoading} />
                    ))
                  )}
                </div>
              )}

              <GamePanel contentClassName="gap-0">
                <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                  <h3 className={gameHeadingClass}>
                    {filters.itemName.trim() ? 'Search Results' : 'Recent Listings'}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRefresh}
                      disabled={refreshing || loading}
                      className={cn(gameButtonClass, 'min-w-[5.5rem] flex-1 sm:flex-none')}
                    >
                      {refreshing ? 'Refreshing…' : 'Refresh'}
                    </button>
                    <span className="shrink-0 border border-[#4a4338] bg-[#0a0908] px-3 py-1 text-xs text-[#8a7f72] sm:py-0.5">
                      {listingCountLabel}
                    </span>
                  </div>
                </div>
                <GameDivider />

                {showSearchLoading ? (
                  <div className="px-4 py-12 text-center text-sm text-[#8a7f72]">
                    Searching marketplace…
                  </div>
                ) : listings.length === 0 ? (
                  <div className="px-4 py-12 text-center text-sm text-[#8a7f72]">
                    No listings match your filters.
                  </div>
                ) : (
                  <div className={cn(refreshing && 'opacity-60')}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-3">
                      <div className="flex items-center gap-3 border-b border-[#3a342c] bg-[#171411]/80 px-3 py-2 text-[10px] uppercase tracking-wider text-[#8a7f72] sm:gap-4 sm:px-4">
                        <span className="w-12 shrink-0" />
                        <span className="flex-1">Item</span>
                        <span className="shrink-0 text-right">Price</span>
                      </div>
                      <div className="hidden items-center gap-3 border-b border-[#3a342c] bg-[#171411]/80 px-3 py-2 text-[10px] uppercase tracking-wider text-[#8a7f72] sm:gap-4 sm:px-4 lg:flex">
                        <span className="w-12 shrink-0" />
                        <span className="flex-1">Item</span>
                        <span className="shrink-0 text-right">Price</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-3">
                      {listings.map((listing) => (
                        <MarketListingRow
                          key={listing.id}
                          listing={listing}
                          attributeLabels={attributeLabels}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </GamePanel>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
