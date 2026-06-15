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
import { fetchCraftCostForLookup } from '@/lib/craftCost';
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
  const [craftCost, setCraftCost] = useState<CraftCostResult | null>(null);
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
      const data = await fetchMarketListings(searchFilters);
      if (generation !== searchGenerationRef.current) return;

      setListings(data);
      setHasSearched(true);

      const itemName = searchFilters.itemName.trim();
      if (itemName) {
        setCraftLoading(true);
        fetchCraftCostForLookup(itemName, searchFilters.rarity || undefined)
          .then((cost) => {
            if (generation !== searchGenerationRef.current) return;
            setCraftCost(cost);
          })
          .catch(() => {
            if (generation !== searchGenerationRef.current) return;
            setCraftCost(null);
          })
          .finally(() => {
            if (generation !== searchGenerationRef.current) return;
            setCraftLoading(false);
          });
      } else {
        setCraftCost(null);
        setCraftLoading(false);
      }
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

  const showCraftPanel = craftLoading || craftCost !== null;
  const showSearchLoading = loading && !refreshing;

  return (
    <div className="space-y-6">
      <GamePanel className="p-6">
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

      <div className="grid items-start gap-6 lg:grid-cols-[280px_1fr]">
        <MarketFilters
          filters={filters}
          onChange={setFilters}
          onSearch={handleSearch}
          loading={loading}
        />

        <div className="min-w-0 space-y-6">
          {showCraftPanel && (
            <CraftCostPanel craftCost={craftCost} loading={craftLoading} />
          )}

          <GamePanel contentClassName="gap-0">
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className={gameHeadingClass}>
                {hasSearched ? 'Search Results' : 'Recent Listings'}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshing || loading}
                  className={cn(gameButtonClass, 'min-w-[5.5rem]')}
                >
                  {refreshing ? 'Refreshing…' : 'Refresh'}
                </button>
                <span className="border border-[#4a4338] bg-[#0a0908] px-3 py-0.5 text-xs text-[#8a7f72]">
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
                  'columns-1 gap-4 p-4 sm:columns-2 lg:columns-5',
                  refreshing && 'opacity-60'
                )}
              >
                {listings.map((listing) => (
                  <div key={listing.id} className="mb-4 break-inside-avoid">
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
