'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, CraftCostResult } from '@/api/client';
import CraftCostPanel from '@/components/CraftCostPanel';
import MarketFilters from '@/components/MarketFilters';
import MarketListingCard from '@/components/MarketListingCard';
import { GameDivider, GamePanel } from '@/components/ui/game-panel';
import { cn } from '@/lib/utils';
import {
  gameButtonClass,
  gameHeadingClass,
  gameMutedTextClass,
  gameTitleClass,
} from '@/lib/gameTheme';
import { fetchCraftCostsForLookup } from '@/lib/craftCost';
import {
  defaultMarketFilters,
  fetchMarketListings,
  MarketFilterState,
} from '@/lib/marketFilters';
import { buildAttributeLabelMap, type AttributeLabelMap } from '@/lib/listingStats';

export default function Dashboard() {
  const [filters, setFilters] = useState<MarketFilterState>(defaultMarketFilters);
  const [listings, setListings] = useState<Awaited<ReturnType<typeof fetchMarketListings>>>([]);
  const [attributeLabels, setAttributeLabels] = useState<AttributeLabelMap>(new Map());
  const [craftCosts, setCraftCosts] = useState<CraftCostResult[]>([]);
  const [craftLoading, setCraftLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const searchGenerationRef = useRef(0);

  useEffect(() => {
    api.itemAttributes().then((attrs) => setAttributeLabels(buildAttributeLabelMap(attrs))).catch(() => {});
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

      const itemName = searchFilters.itemName.trim();
      const listingsPromise = fetchMarketListings(searchFilters);
      const craftPromise = itemName
        ? fetchCraftCostsForLookup(itemName, searchFilters.rarity || undefined)
        : Promise.resolve([] as CraftCostResult[]);

      if (itemName) {
        setCraftLoading(true);
      } else {
        setCraftCosts([]);
        setCraftLoading(false);
      }

      const [data, costs] = await Promise.all([
        listingsPromise,
        craftPromise.catch(() => [] as CraftCostResult[]),
      ]);
      if (generation !== searchGenerationRef.current) return;

      setListings(data);
      setHasSearched(true);
      setCraftCosts(costs);
      setCraftLoading(false);
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

  function handleSearch(searchFilters: MarketFilterState) {
    setFilters(searchFilters);
    runSearch(searchFilters);
  }

  function handleRefresh() {
    runSearch(filters, true);
  }

  const showCraftPanel = craftLoading || craftCosts.length > 0;
  const showSearchLoading = loading && !refreshing;

  return (
    <div className="space-y-4 sm:space-y-6">
      <GamePanel className="hidden p-4 sm:block sm:p-6">
        <h2 className={gameTitleClass}>Live Market Feed</h2>
        <p className={cn('mt-1', gameMutedTextClass)}>
          Browse and filter active marketplace listings from DarkerDB.
        </p>
      </GamePanel>

      {error && (
        <div className="border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-[280px_1fr]">
        <MarketFilters
          filters={filters}
          onChange={setFilters}
          onSearch={handleSearch}
          loading={loading}
        />

        <div className="min-w-0 space-y-4 sm:space-y-6">
          {showCraftPanel && (
            <div className="space-y-4">
              {craftLoading && craftCosts.length === 0 ? (
                <CraftCostPanel craftCost={null} loading={craftLoading} />
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
                {hasSearched ? 'Search Results' : 'Recent Listings'}
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
                  {listings.length} listings
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
              <div
                className={cn(
                  'columns-1 gap-3 p-3 sm:columns-2 sm:gap-4 sm:p-4 lg:columns-5',
                  refreshing && 'opacity-60'
                )}
              >
                {listings.map((listing) => (
                  <div key={listing.id} className="mb-3 break-inside-avoid sm:mb-4">
                    <MarketListingCard
                      listing={listing}
                      attributeLabels={attributeLabels}
                    />
                  </div>
                ))}
              </div>
            )}
          </GamePanel>
        </div>
      </div>
    </div>
  );
}
