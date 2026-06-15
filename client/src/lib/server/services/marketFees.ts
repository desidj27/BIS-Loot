const LISTING_FEE_RATE = 0.05;
const LISTING_FEE_MIN = 15;

export function calculateListingFee(sellingPrice: number): number {
  if (sellingPrice <= 0) return LISTING_FEE_MIN;
  return Math.max(LISTING_FEE_MIN, Math.round(sellingPrice * LISTING_FEE_RATE));
}

export function calculateFlipProfit(buyPrice: number, sellPrice: number): number {
  return sellPrice - calculateListingFee(sellPrice) - buyPrice;
}

export function calculateFlipMargin(buyPrice: number, sellPrice: number): number {
  if (buyPrice <= 0) return 0;
  return (calculateFlipProfit(buyPrice, sellPrice) / buyPrice) * 100;
}
