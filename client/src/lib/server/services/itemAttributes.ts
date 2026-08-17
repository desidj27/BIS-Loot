import type { ItemAttribute } from '../darkerdb';
import { getItem, getItemAttributes, searchItems } from '../darkerdb';

export interface ItemAttributeRange {
  field: string;
  display: string;
  is_percentage?: boolean;
  min: number;
  max: number;
}

interface V2ItemAttribute {
  attribute?: string;
  min?: number;
  max?: number;
  enchanted_min?: number;
  enchanted_max?: number;
}

function humanizeAttributeField(field: string): string {
  return field
    .replace(/^id\.attribute\./i, '')
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function normalizeAttributeField(field: string): string {
  return field.replace(/^id\.attribute\./i, '');
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

function rangesFromNestedAttributes(
  item: Record<string, unknown>,
  catalog: ItemAttribute[]
): ItemAttributeRange[] {
  const labelByField = new Map<string, Pick<ItemAttribute, 'display' | 'is_percentage'>>();
  for (const attr of catalog) {
    const short = normalizeAttributeField(attr.field);
    labelByField.set(short, { display: attr.display, is_percentage: attr.is_percentage });
    labelByField.set(attr.field, { display: attr.display, is_percentage: attr.is_percentage });
  }

  const byField = new Map<string, ItemAttributeRange>();

  for (const prefix of ['primary_attributes', 'secondary_attributes'] as const) {
    const list = item[prefix];
    if (!Array.isArray(list)) continue;

    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue;
      const entry = raw as V2ItemAttribute;
      if (typeof entry.attribute !== 'string') continue;
      if (typeof entry.min !== 'number' || typeof entry.max !== 'number') continue;
      if (entry.min === entry.max) continue;

      const field = normalizeAttributeField(entry.attribute);
      const meta = labelByField.get(field) ?? labelByField.get(entry.attribute);
      const existing = byField.get(field);

      if (!existing) {
        byField.set(field, {
          field,
          display: meta?.display ?? humanizeAttributeField(field),
          is_percentage: meta?.is_percentage,
          min: entry.min,
          max: entry.max,
        });
        continue;
      }

      existing.min = Math.min(existing.min, entry.min);
      existing.max = Math.max(existing.max, entry.max);
    }
  }

  return Array.from(byField.values());
}

function rangesFromLegacyFlatFields(
  item: Record<string, unknown>,
  catalog: ItemAttribute[]
): ItemAttributeRange[] {
  const ranges: ItemAttributeRange[] = [];

  for (const attr of catalog) {
    const field = normalizeAttributeField(attr.field);
    const primary = readSlotRange(item, 'primary', field);
    const secondary = readSlotRange(item, 'secondary', field);

    const mins = [primary.min, secondary.min].filter((v): v is number => v !== undefined);
    const maxs = [primary.max, secondary.max].filter((v): v is number => v !== undefined);

    if (mins.length === 0 || maxs.length === 0) continue;

    const min = Math.min(...mins);
    const max = Math.max(...maxs);
    if (min === max) continue;

    ranges.push({
      field,
      display: attr.display,
      is_percentage: attr.is_percentage,
      min,
      max,
    });
  }

  return ranges;
}

export function parseItemAttributeRanges(
  item: Record<string, unknown>,
  catalog: ItemAttribute[]
): ItemAttributeRange[] {
  const nested = rangesFromNestedAttributes(item, catalog);
  if (nested.length > 0) return nested;
  return rangesFromLegacyFlatFields(item, catalog);
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
    const rarityName = rarity.trim();
    variants = variants.filter(
      (item) => item.rarity.toLowerCase() === rarityName.toLowerCase()
    );
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
