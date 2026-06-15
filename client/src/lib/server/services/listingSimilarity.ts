import type { MarketListing } from '../darkerdb';

export interface RollProfile {
  stats: Map<string, number>;
  gems: string[];
}

function gemBaseName(socketId: string): string {
  const base = socketId.split('_')[0] ?? socketId;
  return base.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function extractRollProfile(listing: MarketListing): RollProfile {
  const stats = new Map<string, number>();

  for (const [key, raw] of Object.entries(listing)) {
    if (typeof raw !== 'number') continue;
    if (!key.startsWith('secondary_')) continue;
    stats.set(key.replace(/^secondary_/, ''), raw);
  }

  const gems: string[] = [];
  for (let socket = 1; socket <= 5; socket++) {
    const raw = listing[`socket_${socket}` as keyof MarketListing];
    if (typeof raw === 'string' && raw) {
      gems.push(gemBaseName(raw));
    }
  }

  return { stats, gems };
}

function statValuesClose(a: number, b: number): boolean {
  if (a === b) return true;
  const diff = Math.abs(a - b);
  if (Number.isInteger(a) && Number.isInteger(b)) return diff <= 1;
  return diff <= 0.5;
}

export function areRollProfilesSimilar(a: RollProfile, b: RollProfile): boolean {
  if (a.stats.size !== b.stats.size) return false;

  for (const [field, valueA] of a.stats) {
    const valueB = b.stats.get(field);
    if (valueB === undefined || !statValuesClose(valueA, valueB)) return false;
  }

  if (a.gems.length !== b.gems.length) return false;
  const sortedA = [...a.gems].sort();
  const sortedB = [...b.gems].sort();
  return sortedA.every((gem, index) => gem === sortedB[index]);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  }
  return Math.round(sorted[mid]!);
}

export function countSimilarSold(listing: MarketListing, soldListings: MarketListing[]): number {
  const profile = extractRollProfile(listing);
  let count = 0;

  for (const sold of soldListings) {
    if (!sold.has_sold) continue;
    if (sold.item !== listing.item || sold.rarity !== listing.rarity) continue;
    if (areRollProfilesSimilar(profile, extractRollProfile(sold))) count++;
  }

  return count;
}

export function fairPriceFromSimilarSold(
  listing: MarketListing,
  soldListings: MarketListing[],
  minComps = 2
): number | null {
  const profile = extractRollProfile(listing);
  const prices: number[] = [];

  for (const sold of soldListings) {
    if (!sold.has_sold) continue;
    if (sold.item !== listing.item || sold.rarity !== listing.rarity) continue;

    if (!areRollProfilesSimilar(profile, extractRollProfile(sold))) continue;

    const unitPrice = sold.price_per_unit ?? sold.price;
    if (unitPrice > 0) prices.push(unitPrice);
  }

  if (prices.length < minComps) return null;
  return median(prices);
}
