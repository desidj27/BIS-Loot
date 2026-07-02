'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ArbitrageOpportunity, formatGold, formatPercent, rarityClass } from '@/api/client';
import { GameDivider, GamePanel } from '@/components/ui/game-panel';
import {
  gameButtonClass,
  gameHeadingClass,
  gameLabelClass,
  gameMutedTextClass,
  gameTitleClass,
  itemCardRarityClass,
} from '@/lib/gameTheme';
import { cn } from '@/lib/utils';

const rangeSliderClass =
  'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#2a241c] accent-[#c47b1a] [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#e5b56e] [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#e5b56e]';

export default function Alerts() {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [minProfit, setMinProfit] = useState(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOpportunities = useCallback(async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const data = await api.alerts(minProfit);
      setOpportunities(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [minProfit]);

  useEffect(() => {
    loadOpportunities();
    const interval = setInterval(() => loadOpportunities(true), 120_000);
    return () => clearInterval(interval);
  }, [loadOpportunities]);

  const showInitialLoading = loading && opportunities.length === 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <GamePanel className="hidden p-4 sm:block sm:p-6">
        <h2 className={gameTitleClass}>Deal Alerts</h2>
        <p className={cn('mt-1', gameMutedTextClass)}>
          Scans Rare+ gear listed below recent sale prices for matching stat rolls.
        </p>
      </GamePanel>

      {error && (
        <div className="border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-[280px_1fr]">
        <GamePanel className="p-3 sm:sticky sm:top-[4.5rem] sm:p-4 lg:top-20">
          <h3 className={gameHeadingClass}>Deal Settings</h3>
          <GameDivider className="px-0" />

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="minProfit" className={gameLabelClass}>
                Min profit margin
              </label>
              <span className="text-sm font-semibold text-[#ddd6cb]">{minProfit}%</span>
            </div>
            <input
              id="minProfit"
              type="range"
              min={10}
              max={100}
              step={5}
              value={minProfit}
              onChange={(e) => setMinProfit(Number(e.target.value))}
              className={rangeSliderClass}
            />
            <div className="flex justify-between text-[10px] text-[#8a7f72]">
              <span>10%</span>
              <span>100%</span>
            </div>
          </div>

          <GameDivider className="px-0" />

          <div className="space-y-3">
            <p className={gameLabelClass}>How it works</p>

            <div className="space-y-3 border border-[#3a342c] bg-[#0a0908] p-3">
              <div>
                <p className="font-[Cinzel] text-xs font-semibold tracking-wide text-[#e5b56e]">
                  Fair value
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#8a7f72]">
                  Median sale price for the same item, rarity, stats, and gems. Dead rolls only
                  compare to other dead rolls.
                </p>
              </div>
            </div>

            <div className="space-y-3 border border-[#3a342c] bg-[#0a0908] p-3">
              <div>
                <p className="font-[Cinzel] text-xs font-semibold tracking-wide text-[#e5b56e]">
                  Comps
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#8a7f72]">
                  Recent sold listings with matching rolls. At least 2 required for a deal to show.
                </p>
              </div>
            </div>

            <div className="space-y-3 border border-[#3a342c] bg-[#0a0908] p-3">
              <div>
                <p className="font-[Cinzel] text-xs font-semibold tracking-wide text-[#e5b56e]">
                  Profit &amp; margin
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#8a7f72]">
                  Fair value − list price − listing fee (5%, min 15G). Margin is net profit vs buy
                  price.
                </p>
              </div>
            </div>
          </div>
        </GamePanel>

        <div className="min-w-0 space-y-4 sm:space-y-6">
          <GamePanel contentClassName="gap-0">
            <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <h3 className={gameHeadingClass}>Profitable Listings</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadOpportunities(true)}
                  disabled={refreshing || loading}
                  className={cn(gameButtonClass, 'min-w-[5.5rem] flex-1 sm:flex-none')}
                >
                  {refreshing ? 'Refreshing…' : 'Refresh'}
                </button>
                <span className="shrink-0 border border-[#4a4338] bg-[#0a0908] px-3 py-1 text-xs text-[#8a7f72] sm:py-0.5">
                  {opportunities.length} deals
                </span>
              </div>
            </div>
            <GameDivider />

            {showInitialLoading ? (
              <div className="px-4 py-12 text-center text-sm text-[#8a7f72]">
                Scanning marketplace for deals…
              </div>
            ) : opportunities.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-[#8a7f72]">
                No listings found with ≥{minProfit}% profit margin right now. Check back later or
                lower the threshold.
              </div>
            ) : (
              <div className={cn('overflow-x-auto', refreshing && 'opacity-60')}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#2a241c] bg-[#171411]/90 text-left text-[10px] uppercase tracking-wider text-[#8a7f72]">
                      <th className="px-4 py-3 font-semibold">Item</th>
                      <th className="px-4 py-3 font-semibold">Rarity</th>
                      <th className="px-4 py-3 font-semibold">List Price</th>
                      <th
                        className="px-4 py-3 font-semibold"
                        title="Gold received when selling to a vendor"
                      >
                        Vendor
                      </th>
                      <th
                        className="px-4 py-3 font-semibold"
                        title="Median recent sale price for matching stat rolls"
                      >
                        Fair Value
                      </th>
                      <th
                        className="px-4 py-3 font-semibold"
                        title="Fee to re-list at fair value (5%, min 15G)"
                      >
                        List Fee
                      </th>
                      <th
                        className="px-4 py-3 font-semibold"
                        title="Recent sold listings with the same rolls"
                      >
                        Comps
                      </th>
                      <th
                        className="px-4 py-3 font-semibold"
                        title="Fair value minus list price minus listing fee"
                      >
                        Profit
                      </th>
                      <th className="px-4 py-3 font-semibold">Margin</th>
                      <th className="px-4 py-3 font-semibold">Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.map((opp) => (
                      <tr
                        key={opp.listingId}
                        className="border-b border-[#2a241c]/70 transition-colors hover:bg-[#171411]/60"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/item/${opp.archetype}`}
                            className={cn(
                              'font-[Cinzel] font-medium no-underline hover:no-underline',
                              itemCardRarityClass(opp.rarity)
                            )}
                          >
                            {opp.item}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn('text-xs uppercase tracking-wide', rarityClass(opp.rarity))}
                          >
                            {opp.rarity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#c9bfb0]">
                          {formatGold(opp.pricePerUnit)}/unit
                        </td>
                        <td className="px-4 py-3 text-[#8a7f72]">
                          {opp.vendorPrice != null && opp.vendorPrice > 0
                            ? formatGold(opp.vendorPrice)
                            : '—'}
                        </td>
                        <td className="px-4 py-3 font-[Cinzel] font-semibold text-[#d4a054]">
                          {formatGold(opp.fairPrice)}
                        </td>
                        <td className="px-4 py-3 text-[#8a7f72]">{formatGold(opp.listingFee)}</td>
                        <td className="px-4 py-3 text-[#8a7f72]">{opp.compCount}</td>
                        <td className="px-4 py-3 font-[Cinzel] font-semibold text-[#e5b56e]">
                          +{formatGold(opp.profitGold)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="border border-[#4a4338] bg-[#0a0908] px-2 py-0.5 text-xs text-[#e5b56e]">
                            {formatPercent(opp.profitPercent)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-[Cinzel] text-xs italic text-[#b8944f]/80">
                          {new Date(opp.expiresAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GamePanel>
        </div>
      </div>
    </div>
  );
}
