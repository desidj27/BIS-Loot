import type { AttributeFilter, MarketListing } from '../darkerdb.js';

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
    const byUnit = a.price_per_unit - b.price_per_unit;
    if (byUnit !== 0) return byUnit;
    return a.price - b.price;
  });
}

export function listingHasGems(listing: MarketListing): boolean {
  return [listing.socket_1, listing.socket_2, listing.socket_3, listing.socket_4, listing.socket_5].some(
    (socket) => socket != null && socket !== ''
  );
}
