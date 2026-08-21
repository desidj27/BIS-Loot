import { api, type MarketTrendsResponse } from '@/api/client';

type TrendsWindow = '1d' | '1w';

const CLIENT_TTL_MS = 10 * 60 * 1000;
const CACHE_VERSION = 4;
const cache = new Map<string, { data: MarketTrendsResponse; expiresAt: number }>();
const inflight = new Map<string, Promise<MarketTrendsResponse>>();

function cacheKey(window: TrendsWindow): string {
  return `${CACHE_VERSION}:${window}`;
}

export function getCachedMarketPopular(window: TrendsWindow): MarketTrendsResponse | null {
  const entry = cache.get(cacheKey(window));
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(cacheKey(window));
    return null;
  }
  return entry.data;
}

function store(window: TrendsWindow, data: MarketTrendsResponse) {
  cache.set(cacheKey(window), { data, expiresAt: Date.now() + CLIENT_TTL_MS });
}

export async function fetchMarketPopular(window: TrendsWindow): Promise<MarketTrendsResponse> {
  const cached = getCachedMarketPopular(window);
  if (cached) return cached;

  const key = cacheKey(window);
  const pending = inflight.get(key);
  if (pending) return pending;

  const request = api
    .marketPopular(window)
    .then((data) => {
      store(window, data);

      // Server builds day+week together; warm the other window from cache next.
      const other: TrendsWindow = window === '1d' ? '1w' : '1d';
      if (!getCachedMarketPopular(other) && !inflight.has(cacheKey(other))) {
        void fetchMarketPopular(other).catch(() => {});
      }

      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, request);
  return request;
}

/** Kick off Popular while the user is still on Live. */
export function preloadMarketPopular(window: TrendsWindow = '1d'): void {
  void fetchMarketPopular(window).catch(() => {});
}
