import type { AttributeFilter, MarketListing } from '../darkerdb';
import { listingSocketIds } from '../darkerdb';

function listingAttributeValues(listing: MarketListing, field: string): number[] {
  const values: number[] = [];
  const primary = listing[`primary_${field}`];
  const secondary = listing[`secondary_${field}`];

  if (typeof primary === 'number') values.push(primary);
  if (typeof secondary === 'number') values.push(secondary);

  return values;
}

export function filterListingsByAttributes(
  listings: MarketListing[],
  filters: AttributeFilter[]
): MarketListing[] {
  if (filters.length === 0) return listings;

  return listings.filter((listing) =>
    filters.every((filter) => {
      const values = listingAttributeValues(listing, filter.field);
      if (values.length === 0) return false;
      if (filter.min === undefined) return true;
      return values.some((value) => value >= filter.min!);
    })
  );
}

export function sortListingsByPrice(listings: MarketListing[]): MarketListing[] {
  return [...listings].sort((a, b) => {
    const aUnit = a.price_per_unit ?? a.price;
    const bUnit = b.price_per_unit ?? b.price;
    if (aUnit !== bUnit) return aUnit - bUnit;
    return a.price - b.price;
  });
}

export function listingHasGems(listing: MarketListing): boolean {
  return listingSocketIds(listing).length > 0;
}
