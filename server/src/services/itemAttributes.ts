import type { ItemAttribute } from '../darkerdb.js';
import { getItem, getItemAttributes, searchItems } from '../darkerdb.js';

export interface ItemAttributeRange {
  field: string;
  display: string;
  is_percentage?: boolean;
  min: number;
  max: number;
}

function readSlotRange(
  item: Record<string, unknown>,
  prefix: 'primary' | 'secondary',
  field: string
): { min?: number; max?: number } {
  const minVal = item[`${prefix}_min_${field}`];
  const maxVal = item[`${prefix}_max_${field}`];
  return {
    min: typeof minVal === 'number' ? minVal : undefined,
    max: typeof maxVal === 'number' ? maxVal : undefined,
  };
}

export function parseItemAttributeRanges(
  item: Record<string, unknown>,
  catalog: ItemAttribute[]
): ItemAttributeRange[] {
  const ranges: ItemAttributeRange[] = [];

  for (const attr of catalog) {
    const primary = readSlotRange(item, 'primary', attr.field);
    const secondary = readSlotRange(item, 'secondary', attr.field);

    const mins = [primary.min, secondary.min].filter((v): v is number => v !== undefined);
    const maxs = [primary.max, secondary.max].filter((v): v is number => v !== undefined);

    if (mins.length === 0 || maxs.length === 0) continue;

    const min = Math.min(...mins);
    const max = Math.max(...maxs);
    if (min === max) continue;

    ranges.push({
      field: attr.field,
      display: attr.display,
      is_percentage: attr.is_percentage,
      min,
      max,
    });
  }

  return ranges;
}

function mergeAttributeRanges(ranges: ItemAttributeRange[]): ItemAttributeRange[] {
  const byField = new Map<string, ItemAttributeRange>();

  for (const range of ranges) {
    const existing = byField.get(range.field);
    if (!existing) {
      byField.set(range.field, { ...range });
      continue;
    }
    existing.min = Math.min(existing.min, range.min);
    existing.max = Math.max(existing.max, range.max);
  }

  return Array.from(byField.values()).sort((a, b) => a.display.localeCompare(b.display));
}

export async function getAttributeRangesForItem(
  itemName: string,
  rarity?: string
): Promise<ItemAttributeRange[]> {
  const catalog = await getItemAttributes();
  const matches = await searchItems(itemName.trim());
  const normalized = itemName.trim().toLowerCase();

  let variants = matches.filter((item) => item.name.toLowerCase() === normalized);
  if (variants.length === 0) variants = matches;

  if (rarity?.trim()) {
    variants = variants.filter((item) => item.rarity === rarity.trim());
  }

  if (variants.length === 0) return [];

  const allRanges: ItemAttributeRange[] = [];

  for (const variant of variants) {
    const detail = await getItem(variant.id);
    if (!detail) continue;
    allRanges.push(
      ...parseItemAttributeRanges(detail as unknown as Record<string, unknown>, catalog)
    );
  }

  return mergeAttributeRanges(allRanges);
}
