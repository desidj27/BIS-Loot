'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  formatGold,
  formatPercent,
  formatVolume,
  MarketTrendItem,
  MarketTrendsResponse,
} from '@/api/client';
import { GameDivider, GamePanel } from '@/components/ui/game-panel';
import {
  gameHeadingClass,
  gameMutedTextClass,
  itemCardRarityClass,
} from '@/lib/gameTheme';
import { listingIconUrl } from '@/lib/listingStats';
import { fetchMarketPopular, getCachedMarketPopular } from '@/lib/popularCache';
import { cn } from '@/lib/utils';

type TrendsWindow = '1d' | '1w';

function TrendIcon({ itemId }: { itemId: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-[#4a4338] bg-[#0a0908]">
      {!failed ? (
        <img
          src={listingIconUrl(itemId, 128)}
          alt=""
          loading="lazy"
          className="max-h-[88%] max-w-[88%] object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-sm text-[#5c534a]">?</span>
      )}
    </div>
  );
}

function formatChangePct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return formatPercent(Math.round(value * 10) / 10);
}

function TrendRow({
  item,
  rank,
  mode,
}: {
  item: MarketTrendItem;
  rank: number;
  mode: 'volume' | 'mover';
}) {
  const changeClass =
    item.changePct == null
      ? 'text-[#8a7f72]'
      : item.changePct > 0
        ? 'text-[#71AD31]'
        : item.changePct < 0
          ? 'text-[#E60505]'
          : 'text-[#8a7f72]';

  return (
    <Link
      href={`/item/${encodeURIComponent(item.itemId)}`}
      className="flex items-center gap-3 border-b border-[#2a241c] bg-[#0a0908]/40 px-3 py-2.5 no-underline transition-colors hover:bg-[#171411]/90 sm:gap-4 sm:px-4"
    >
      <span className="w-6 shrink-0 text-right font-[Cinzel] text-sm text-[#8a7f72]">{rank}</span>
      <TrendIcon itemId={item.itemId} />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate font-[Cinzel] text-[15px] font-semibold tracking-wide',
            itemCardRarityClass(item.rarity)
          )}
        >
          {item.name}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-[#8a7f72]">
          {mode === 'volume'
            ? `${formatVolume(item.volume)} vol · ${formatVolume(item.tradeCount)} sales`
            : `${formatGold(item.previousAvg)} → ${formatGold(item.latestAvg)}`}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {mode === 'volume' ? (
          <>
            <p className="font-[Cinzel] text-base font-semibold text-[#d4a054]">
              {formatGold(item.avgSoldPrice)}
            </p>
            <p className={cn('text-[11px]', changeClass)}>{formatChangePct(item.changePct)}</p>
          </>
        ) : (
          <>
            <p className={cn('font-[Cinzel] text-base font-semibold', changeClass)}>
              {formatChangePct(item.changePct)}
            </p>
            <p className="text-[11px] text-[#8a7f72]">{formatGold(item.latestAvg)}</p>
          </>
        )}
      </div>
    </Link>
  );
}

function TrendList({
  title,
  items,
  mode,
  empty,
  columns = 1,
}: {
  title: string;
  items: MarketTrendItem[];
  mode: 'volume' | 'mover';
  empty: string;
  columns?: 1 | 2;
}) {
  const leftColumn =
    columns === 2 ? items.slice(0, Math.ceil(items.length / 2)) : items;
  const rightColumn = columns === 2 ? items.slice(Math.ceil(items.length / 2)) : [];

  return (
    <GamePanel contentClassName="gap-0">
      <div className="px-3 py-3 sm:px-4">
        <h3 className={gameHeadingClass}>{title}</h3>
      </div>
      <GameDivider />
      {items.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-[#8a7f72]">{empty}</div>
      ) : columns === 2 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-3">
          <div>
            {leftColumn.map((item, index) => (
              <TrendRow key={item.itemId} item={item} rank={index + 1} mode={mode} />
            ))}
          </div>
          <div>
            {rightColumn.map((item, index) => (
              <TrendRow
                key={item.itemId}
                item={item}
                rank={leftColumn.length + index + 1}
                mode={mode}
              />
            ))}
          </div>
        </div>
      ) : (
        <div>
          {items.map((item, index) => (
            <TrendRow key={item.itemId} item={item} rank={index + 1} mode={mode} />
          ))}
        </div>
      )}
    </GamePanel>
  );
}

export default function PopularTrendsPanel() {
  const [window, setWindow] = useState<TrendsWindow>('1d');
  const [data, setData] = useState<MarketTrendsResponse | null>(
    () => getCachedMarketPopular('1d')
  );
  const [loading, setLoading] = useState(() => !getCachedMarketPopular('1d'));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const cached = getCachedMarketPopular(window);
      if (cached) {
        setData(cached);
        setLoading(false);
        setError(null);
      } else {
        setLoading(true);
      }

      try {
        const trends = await fetchMarketPopular(window);
        if (!cancelled) {
          setData(trends);
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
  }, [window]);

  const windowLabel = window === '1w' ? 'week' : 'day';

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className={cn('text-sm', gameMutedTextClass)}>
          Ranked by DarkerDB trade volume for the selected window, from items that have been
          trading recently.
        </p>
        <div className="grid grid-cols-2 gap-1 border border-[#4a4338] bg-[#0a0908] p-1 sm:flex">
          {(
            [
              { value: '1d', label: 'Day' },
              { value: '1w', label: 'Week' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={cn(
                'min-h-10 border px-3 py-2 font-[Cinzel] text-xs tracking-wide transition-colors sm:min-h-0',
                window === opt.value
                  ? 'border-[#8a7355] bg-[linear-gradient(180deg,#3d3020_0%,#241c14_100%)] text-[#f5d492]'
                  : 'border-transparent text-[#8a7f72] hover:text-[#ddd6cb]'
              )}
              onClick={() => setWindow(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="border border-[#3a342c] bg-[#12100e] px-4 py-12 text-center text-sm text-[#8a7f72]">
          Loading popular market activity…
        </div>
      ) : data ? (
        <div className={cn('space-y-4 sm:space-y-6', loading && 'opacity-60')}>
          <TrendList
            title={`Most traded (${windowLabel})`}
            items={data.popular}
            mode="volume"
            columns={2}
            empty="No trade activity found in the recent sample."
          />

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <TrendList
              title={`Biggest ups (${windowLabel})`}
              items={data.gainers}
              mode="mover"
              empty="No rising items in this window."
            />
            <TrendList
              title={`Biggest downs (${windowLabel})`}
              items={data.losers}
              mode="mover"
              empty="No falling items in this window."
            />
          </div>

          <p className={cn('text-xs', gameMutedTextClass)}>
            Based on {formatVolume(data.sampleSize)} recent trades · cached about 10 minutes
            {data.generatedAt ? ` · ${new Date(data.generatedAt).toLocaleTimeString()}` : ''}
          </p>
        </div>
      ) : null}
    </div>
  );
}
