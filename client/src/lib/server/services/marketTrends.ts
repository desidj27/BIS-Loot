import {
  getMarketListings,
  getPriceHistory,
  type MarketListing,
  type PriceHistoryPoint,
} from '../darkerdb';
import { withTtlCache } from '../ttlCache';

const TRENDS_CACHE_TTL_MS = 10 * 60 * 1000;
/** Recent disappeared listings used to discover active trade candidates. */
const TRADE_SAMPLE_LIMIT = 300;
/** How many distinct items get price-history volume (must be >= POPULAR_LIMIT). */
const HISTORY_CANDIDATE_LIMIT = 40;
const HISTORY_CONCURRENCY = 10;
const POPULAR_LIMIT = 20;
const MOVER_LIMIT = 10;
const MIN_MOVER_PREVIOUS_AVG = 25;
const MIN_MOVER_VOLUME = 8;
const MAX_RELIABLE_CHANGE_PCT = 250;

export type MarketTrendsWindow = '1d' | '1w';

export interface MarketTrendItem {
  itemId: string;
  name: string;
  rarity: string;
  archetype: string;
  tradeCount: number;
  unitsTraded: number;
  avgSoldPrice: number | null;
  volume: number;
  latestAvg: number | null;
  previousAvg: number | null;
  changePct: number | null;
  changeAbs: number | null;
}

export interface MarketTrendsResult {
  window: MarketTrendsWindow;
  generatedAt: string;
  sampleSize: number;
  popular: MarketTrendItem[];
  gainers: MarketTrendItem[];
  losers: MarketTrendItem[];
}

interface TradeAggregate {
  itemId: string;
  name: string;
  rarity: string;
  archetype: string;
  tradeCount: number;
  unitsTraded: number;
  priceSum: number;
  priceSamples: number;
}

interface HistoryMetrics {
  volume: number;
  latestAvg: number | null;
  previousAvg: number | null;
  changePct: number | null;
  changeAbs: number | null;
}

function displayName(listing: MarketListing): string {
  if (listing.item?.trim()) return listing.item.trim();
  if (typeof listing.name === 'string' && listing.name.trim()) return listing.name.trim();
  return listing.item_id;
}

function avgPrice(listing: MarketListing): number {
  return listing.price_per_unit || listing.price || 0;
}

function aggregateTrades(listings: MarketListing[]): TradeAggregate[] {
  const byId = new Map<string, TradeAggregate>();

  for (const listing of listings) {
    const itemId = listing.item_id;
    if (!itemId) continue;

    const existing = byId.get(itemId);
    const qty = Math.max(1, Number(listing.quantity) || 1);
    const unit = avgPrice(listing);

    if (!existing) {
      byId.set(itemId, {
        itemId,
        name: displayName(listing),
        rarity: listing.rarity || 'Common',
        archetype: listing.archetype || itemId,
        tradeCount: 1,
        unitsTraded: qty,
        priceSum: unit > 0 ? unit * qty : 0,
        priceSamples: unit > 0 ? qty : 0,
      });
      continue;
    }

    existing.tradeCount += 1;
    existing.unitsTraded += qty;
    if (unit > 0) {
      existing.priceSum += unit * qty;
      existing.priceSamples += qty;
    }
    if (!existing.name || existing.name === itemId) {
      existing.name = displayName(listing);
    }
  }

  return [...byId.values()].sort((a, b) => {
    if (b.unitsTraded !== a.unitsTraded) return b.unitsTraded - a.unitsTraded;
    return b.tradeCount - a.tradeCount;
  });
}

function pricedPoints(history: PriceHistoryPoint[]): PriceHistoryPoint[] {
  return history.filter((point) => point.avg != null && point.avg > 0);
}

function metricsFromHistory(
  history: PriceHistoryPoint[],
  window: MarketTrendsWindow
): HistoryMetrics {
  const priced = pricedPoints(history);
  if (priced.length === 0) {
    return {
      volume: history.reduce((sum, point) => sum + (point.volume || 0), 0),
      latestAvg: null,
      previousAvg: null,
      changePct: null,
      changeAbs: null,
    };
  }

  const latest = priced[priced.length - 1];
  const previous =
    window === '1d'
      ? priced.length >= 2
        ? priced[priced.length - 2]
        : null
      : priced[0];

  const latestAvg = latest.avg as number;
  const previousAvg = previous?.avg ?? null;
  const changeAbs = previousAvg != null ? latestAvg - previousAvg : null;
  const changePct =
    previousAvg != null && previousAvg > 0 ? ((latestAvg - previousAvg) / previousAvg) * 100 : null;

  const volume =
    window === '1d'
      ? latest.volume || 0
      : history.reduce((sum, point) => sum + (point.volume || 0), 0);

  return {
    volume,
    latestAvg,
    previousAvg,
    changePct,
    changeAbs,
  };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await mapper(items[index]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function toTrendItem(agg: TradeAggregate, metrics: HistoryMetrics): MarketTrendItem {
  return {
    itemId: agg.itemId,
    name: agg.name,
    rarity: agg.rarity,
    archetype: agg.archetype,
    tradeCount: agg.tradeCount,
    unitsTraded: agg.unitsTraded,
    avgSoldPrice:
      agg.priceSamples > 0 ? Math.round(agg.priceSum / agg.priceSamples) : metrics.latestAvg,
    volume: metrics.volume > 0 ? metrics.volume : agg.unitsTraded,
    latestAvg: metrics.latestAvg,
    previousAvg: metrics.previousAvg,
    changePct: metrics.changePct,
    changeAbs: metrics.changeAbs,
  };
}

function isReliableMover(item: MarketTrendItem): boolean {
  if (item.changePct == null || item.previousAvg == null || item.latestAvg == null) return false;
  if (item.previousAvg < MIN_MOVER_PREVIOUS_AVG) return false;
  if (item.volume < MIN_MOVER_VOLUME) return false;
  if (Math.abs(item.changePct) > MAX_RELIABLE_CHANGE_PCT) return false;
  return true;
}

function rankWindow(
  aggregates: TradeAggregate[],
  histories: PriceHistoryPoint[][],
  window: MarketTrendsWindow,
  sampleSize: number,
  generatedAt: string
): MarketTrendsResult {
  const items = aggregates.map((agg, index) =>
    toTrendItem(agg, metricsFromHistory(histories[index] ?? [], window))
  );

  const popular = [...items]
    .sort((a, b) => {
      // Prefer DarkerDB day/week history volume; fall back to recent sample units.
      if (b.volume !== a.volume) return b.volume - a.volume;
      if (b.unitsTraded !== a.unitsTraded) return b.unitsTraded - a.unitsTraded;
      return b.tradeCount - a.tradeCount;
    })
    .slice(0, POPULAR_LIMIT);

  const withChange = items.filter(isReliableMover);

  const gainers = [...withChange]
    .filter((item) => (item.changePct as number) > 0)
    .sort((a, b) => (b.changePct as number) - (a.changePct as number))
    .slice(0, MOVER_LIMIT);

  const losers = [...withChange]
    .filter((item) => (item.changePct as number) < 0)
    .sort((a, b) => (a.changePct as number) - (b.changePct as number))
    .slice(0, MOVER_LIMIT);

  return {
    window,
    generatedAt,
    sampleSize,
    popular,
    gainers,
    losers,
  };
}

async function buildMarketTrendsBundle(): Promise<Record<MarketTrendsWindow, MarketTrendsResult>> {
  const traded = await getMarketListings({
    listing_state: 'missing',
    limit: TRADE_SAMPLE_LIMIT,
    order: 'desc',
  });

  const aggregates = aggregateTrades(traded).slice(0, HISTORY_CANDIDATE_LIMIT);
  const histories = await mapPool(aggregates, HISTORY_CONCURRENCY, async (agg) => {
    try {
      return await getPriceHistory(agg.itemId, '1d');
    } catch {
      return [] as PriceHistoryPoint[];
    }
  });

  const generatedAt = new Date().toISOString();
  return {
    '1d': rankWindow(aggregates, histories, '1d', traded.length, generatedAt),
    '1w': rankWindow(aggregates, histories, '1w', traded.length, generatedAt),
  };
}

export async function getMarketTrends(window: MarketTrendsWindow = '1d'): Promise<MarketTrendsResult> {
  const normalized: MarketTrendsWindow = window === '1w' ? '1w' : '1d';
  const bundle = await withTtlCache('market:trends:v4:both', TRENDS_CACHE_TTL_MS, () =>
    buildMarketTrendsBundle()
  );
  return bundle[normalized];
}

/** Warm the shared day+week cache without waiting for a Popular tab click. */
export async function preloadMarketTrends(): Promise<void> {
  await getMarketTrends('1d');
}
