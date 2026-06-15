import type { PriceHistoryPoint } from '../darkerdb.js';

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Upper price bound above which individual bucket values are treated as bogus listings. */
export function computePriceOutlierUpperBound(points: PriceHistoryPoint[]): number | null {
  if (points.length < 3) return null;

  const avgs = points.map((p) => p.avg).filter((v): v is number => v != null && v > 0);
  if (avgs.length < 3) return null;

  const med = median(avgs);
  if (med === null || med <= 0) return null;

  const deviations = avgs.map((v) => Math.abs(v - med));
  const mad = median(deviations) ?? 0;
  const scaledMad = mad * 1.4826;
  return med + Math.max(5 * scaledMad, med * 4, 500);
}

function sanitizePriceField(value: number | null, upperBound: number): number | null {
  if (value == null || value <= 0) return value;
  return value > upperBound ? null : value;
}

/** Strip bogus price values per field so a bad max does not erase a valid average. */
export function sanitizePriceHistoryOutliers(points: PriceHistoryPoint[]): PriceHistoryPoint[] {
  const upperBound = computePriceOutlierUpperBound(points);
  if (upperBound === null) return points;

  return points.map((point) => ({
    ...point,
    avg: sanitizePriceField(point.avg, upperBound),
    min: sanitizePriceField(point.min, upperBound),
    max: sanitizePriceField(point.max, upperBound),
  }));
}

function weekStartUtc(timestamp: string): string {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

export function aggregateToWeekly(points: PriceHistoryPoint[]): PriceHistoryPoint[] {
  if (points.length === 0) return [];

  const buckets = new Map<string, PriceHistoryPoint[]>();

  for (const point of points) {
    const key = weekStartUtc(point.timestamp);
    const bucket = buckets.get(key) ?? [];
    bucket.push(point);
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([timestamp, bucket]) => {
      const totalVolume = bucket.reduce((sum, p) => sum + p.volume, 0);
      const priced = bucket.filter((p) => p.avg != null && p.avg > 0);
      const avg =
        totalVolume > 0
          ? bucket.reduce((sum, p) => sum + (p.avg ?? 0) * p.volume, 0) / totalVolume
          : priced.length > 0
            ? priced.reduce((sum, p) => sum + (p.avg as number), 0) / priced.length
            : null;

      const mins = bucket.map((p) => p.min).filter((v): v is number => v != null && v > 0);
      const maxs = bucket.map((p) => p.max).filter((v): v is number => v != null && v > 0);

      return {
        timestamp,
        item_id: bucket[0].item_id,
        avg: avg === null ? null : Math.round(avg * 100) / 100,
        min: mins.length > 0 ? Math.min(...mins) : null,
        max: maxs.length > 0 ? Math.max(...maxs) : null,
        volume: totalVolume,
      };
    });
}
