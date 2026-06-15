import type { ItemAttribute, MarketListing } from '../api/client';
import { itemCardRarityClass } from './gameTheme';

export { itemCardRarityClass };

export interface ListingStat {
  key: string;
  label: string;
  value: number;
  slot: 'primary' | 'secondary';
  isPercentage?: boolean;
}

export type AttributeLabelMap = Map<string, Pick<ItemAttribute, 'display' | 'is_percentage'>>;

function formatFieldName(field: string): string {
  return field
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function buildAttributeLabelMap(attributes: ItemAttribute[]): AttributeLabelMap {
  return new Map(attributes.map((attr) => [attr.field, attr]));
}

export function extractListingStats(
  listing: MarketListing,
  labelMap?: AttributeLabelMap
): ListingStat[] {
  const stats: ListingStat[] = [];

  for (const [key, raw] of Object.entries(listing)) {
    if (typeof raw !== 'number') continue;

    const primaryMatch = key.match(/^primary_(.+)$/);
    const secondaryMatch = key.match(/^secondary_(.+)$/);
    if (!primaryMatch && !secondaryMatch) continue;

    const field = (primaryMatch?.[1] ?? secondaryMatch![1]) as string;
    const slot = primaryMatch ? ('primary' as const) : ('secondary' as const);
    const meta = labelMap?.get(field);

    stats.push({
      key,
      label: meta?.display ?? formatFieldName(field),
      value: raw,
      slot,
      isPercentage: meta?.is_percentage,
    });
  }

  return stats.sort((a, b) => {
    if (a.slot !== b.slot) return a.slot === 'primary' ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

export function formatStatValue(value: number, isPercentage?: boolean): string {
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
  if (isPercentage) return `${formatted}%`;
  if (value > 0) return `+${formatted}`;
  return formatted;
}

export interface ListingGem {
  socket: number;
  statKey: string;
  gemId: string;
  gemName: string;
  statLabel: string;
}

function formatGemName(raw: string): string {
  const base = raw.split('_')[0] ?? raw;
  return base.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function formatPrimaryStatLine(stat: ListingStat): string {
  const value = Number.isInteger(stat.value) ? String(stat.value) : stat.value.toFixed(1);
  if (stat.isPercentage) {
    const pct = stat.value > 0 ? `+${value}%` : `${value}%`;
    return `${pct} ${stat.label}`;
  }
  return `${stat.label} ${value}`;
}

export function formatSecondaryStatLine(stat: ListingStat): string {
  const value = Number.isInteger(stat.value) ? String(stat.value) : stat.value.toFixed(1);
  if (stat.isPercentage) {
    const pct = stat.value > 0 ? `+${value}%` : `${value}%`;
    return `${pct} ${stat.label}`;
  }
  if (stat.value > 0) return `+${value} ${stat.label}`;
  return `${value} ${stat.label}`;
}

export function listingCanBeGemmed(listing: MarketListing): boolean {
  return Object.keys(listing).some(
    (key) => key.startsWith('secondary_') && typeof listing[key] === 'number'
  );
}

export function extractListingGems(
  listing: MarketListing,
  labelMap?: AttributeLabelMap
): ListingGem[] {
  const secondaryFields = Object.keys(listing)
    .filter((key) => key.startsWith('secondary_') && typeof listing[key] === 'number')
    .sort();

  const gems: ListingGem[] = [];

  for (let socket = 1; socket <= 5; socket++) {
    const raw = listing[`socket_${socket}` as keyof MarketListing];
    if (typeof raw !== 'string' || !raw) continue;

    const statField = secondaryFields[socket - 1];
    if (!statField) continue;

    const field = statField.replace(/^secondary_/, '');
    const meta = labelMap?.get(field);

    gems.push({
      socket,
      statKey: statField,
      gemId: raw,
      gemName: formatGemName(raw),
      statLabel: meta?.display ?? formatFieldName(field),
    });
  }

  return gems;
}

export function listingIconUrl(itemId: string): string {
  return `https://api.darkerdb.com/v1/items/${encodeURIComponent(itemId)}/icon`;
}

export function gemIconUrl(gemId: string): string {
  return listingIconUrl(gemId);
}
