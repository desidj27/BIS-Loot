'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  api,
  averageVolume,
  CraftCostResult,
  formatGold,
  formatVolume,
  PriceHistoryPoint,
  PriceSummary,
  volumePeriodLabel,
} from '@/api/client';
import CraftCostPanel from '@/components/CraftCostPanel';
import ItemSearchBar from '@/components/ItemSearchBar';
import PriceChart from '@/components/PriceChart';
import { GameDivider, GamePanel } from '@/components/ui/game-panel';
import {
  gameHeadingClass,
  gameLabelClass,
  gameMutedTextClass,
  gameTitleClass,
  itemCardRarityClass,
} from '@/lib/gameTheme';
import { cn } from '@/lib/utils';

const INTERVALS = [
  { value: '15m', label: '15 min' },
  { value: '1h', label: '1 hour' },
  { value: '4h', label: '4 hours' },
  { value: '1d', label: '1 day' },
  { value: '1w', label: '1 week' },
];

export default function ItemDetail() {
  const params = useParams();
  const itemId = typeof params?.itemId === 'string' ? params.itemId : undefined;
  const [history, setHistory] = useState<PriceHistoryPoint[]>([]);
  const [summary, setSummary] = useState<PriceSummary | null>(null);
  const [interval, setInterval] = useState('1h');
  const [itemName, setItemName] = useState('');
  const [itemMeta, setItemMeta] = useState<{ archetype: string; rarity: string } | null>(null);
  const [craftCost, setCraftCost] = useState<CraftCostResult | null>(null);
  const [craftLoading, setCraftLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!itemId) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const itemData = await api.getItem(itemId!).catch(() => null);
        const lookupId = itemData?.archetype ?? itemId!;

        const [historyData, summaryData] = await Promise.all([
          api.priceHistory(itemId!, interval),
          api.priceSummary(lookupId),
        ]);

        if (!cancelled) {
          setHistory(historyData);
          setSummary(summaryData);
          setItemName(itemData?.name ?? itemId!);
          setItemMeta(
            itemData ? { archetype: itemData.archetype, rarity: itemData.rarity } : null
          );
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [itemId, interval]);

  useEffect(() => {
    if (!itemId) return;

    let cancelled = false;

    async function loadCraftCost() {
      try {
        setCraftLoading(true);
        const data = await api.craftCostForItem(itemId!);
        if (!cancelled) setCraftCost(data);
      } catch {
        if (!cancelled) setCraftCost(null);
      } finally {
        if (!cancelled) setCraftLoading(false);
      }
    }

    loadCraftCost();
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const latest = [...history].reverse().find((point) => point.avg != null && point.avg > 0);
  const avgVol = averageVolume(history);

  const marketStats = [
    { label: 'Fair Price (24h avg)', value: formatGold(summary?.fairPrice) },
    { label: 'Lowest Listing', value: formatGold(summary?.lowestPrice) },
    { label: 'Active Listings', value: summary?.activeListings ?? '—' },
    {
      label: `Avg Volume (per ${volumePeriodLabel(interval)})`,
      value: formatVolume(avgVol),
    },
    ...(latest
      ? [
          { label: 'Latest Avg Price', value: formatGold(latest.avg) },
          { label: 'Latest Volume', value: formatVolume(latest.volume) },
        ]
      : []),
    ...(craftCost
      ? [{ label: 'Craft Cost', value: formatGold(craftCost.craftCost) }]
      : craftLoading
        ? [{ label: 'Craft Cost', value: '…' }]
        : []),
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
        <ItemSearchBar className="w-full sm:max-w-md" />
        <Link
          href="/"
          className="inline-block font-[Cinzel] text-sm tracking-wide text-[#8a7f72] no-underline hover:text-[#e5b56e] hover:no-underline"
        >
          ← Back to market
        </Link>
      </div>

      <GamePanel className="p-4 sm:p-6">
        <h2 className={cn(gameTitleClass, itemMeta && itemCardRarityClass(itemMeta.rarity))}>
          {itemName}
        </h2>
        <p className={cn('mt-1', gameMutedTextClass)}>
          {itemMeta ? (
            <>
              <span className={itemCardRarityClass(itemMeta.rarity)}>{itemMeta.rarity}</span>
              {' · '}
              {itemMeta.archetype}
            </>
          ) : (
            itemId
          )}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(140px,1fr))] sm:gap-3">
          {marketStats.map((stat) => (
            <div key={stat.label} className="border border-[#3a342c] bg-[#0a0908] px-3 py-2.5 sm:px-4 sm:py-3">
              <p className={gameLabelClass}>{stat.label}</p>
              <p className="mt-1 font-[Cinzel] text-base font-semibold text-[#e5b56e] sm:text-lg">{stat.value}</p>
            </div>
          ))}
        </div>
      </GamePanel>

      {error && (
        <div className="border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {(craftLoading || craftCost) && (
        <CraftCostPanel craftCost={craftCost} loading={craftLoading} />
      )}

      <GamePanel contentClassName="gap-0">
        <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
          <h3 className={gameHeadingClass}>Price History</h3>
          <div className="grid grid-cols-3 gap-1 border border-[#4a4338] bg-[#0a0908] p-1 sm:flex sm:flex-wrap">
            {INTERVALS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={cn(
                  'min-h-10 border px-2 py-2 font-[Cinzel] text-xs tracking-wide transition-colors sm:min-h-0 sm:px-3 sm:py-1',
                  interval === opt.value
                    ? 'border-[#8a7355] bg-[linear-gradient(180deg,#3d3020_0%,#241c14_100%)] text-[#f5d492] shadow-[0_0_10px_rgba(196,123,26,0.15)]'
                    : 'border-transparent text-[#8a7f72] hover:text-[#ddd6cb]'
                )}
                onClick={() => setInterval(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <GameDivider />
        <PriceChart data={history} loading={loading} interval={interval} />
      </GamePanel>
    </div>
  );
}
