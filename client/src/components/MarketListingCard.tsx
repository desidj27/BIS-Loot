'use client';

import Link from 'next/link';
import { MarketListing } from '@/api/client';
import { cn } from '@/lib/utils';
import { itemCardRarityClass } from '@/lib/gameTheme';
import {
  AttributeLabelMap,
  extractListingGems,
  extractListingStats,
  formatPrimaryStatLine,
  formatSecondaryStatLine,
  gemIconUrl,
  listingIconUrl,
} from '@/lib/listingStats';

interface MarketListingCardProps {
  listing: MarketListing;
  attributeLabels?: AttributeLabelMap;
}

function ItemDivider() {
  return (
    <div className="flex items-center gap-2 px-3">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#5c4a32]/80 to-transparent" />
      <span className="text-[8px] text-[#6b5a42]">◆</span>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#5c4a32]/80 to-transparent" />
    </div>
  );
}

function TitleDivider() {
  return (
    <div className="mx-auto mt-2 h-px w-[85%] bg-gradient-to-r from-transparent via-[#c47b1a]/70 to-transparent shadow-[0_0_8px_rgba(196,123,26,0.35)]" />
  );
}

export default function MarketListingCard({ listing, attributeLabels }: MarketListingCardProps) {
  const stats = extractListingStats(listing, attributeLabels);
  const primaryStats = stats.filter((stat) => stat.slot === 'primary');
  const secondaryStats = stats.filter((stat) => stat.slot === 'secondary');
  const gemsByStat = new Map(extractListingGems(listing, attributeLabels).map((gem) => [gem.statKey, gem]));

  return (
    <article
      className={cn(
        'relative overflow-hidden border border-[#4a4338]',
        'bg-[linear-gradient(180deg,#14110f_0%,#0d0b0a_55%,#12100e_100%)]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_6px_18px_rgba(0,0,0,0.4)]'
      )}
    >
      <div className="border-b border-[#2a241c] bg-[#171411]/90 px-3 pb-3 pt-3 text-center sm:px-4 sm:pb-3 sm:pt-4">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center border border-[#4a4338] bg-[#0a0908] p-1.5 sm:mb-3 sm:h-14 sm:w-14">
          <img
            src={listingIconUrl(listing.item_id)}
            alt={listing.item}
            loading="lazy"
            className="max-h-full max-w-full object-contain [image-rendering:pixelated]"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <span className="hidden text-xl text-neutral-600">⚔</span>
        </div>

        <Link
          href={`/item/${listing.item_id}`}
          className={cn(
            'block truncate font-[Cinzel] text-[15px] font-semibold tracking-wide no-underline hover:no-underline sm:text-base',
            itemCardRarityClass(listing.rarity)
          )}
        >
          {listing.item}
        </Link>
        <TitleDivider />
      </div>

      {(primaryStats.length > 0 || secondaryStats.length > 0) && (
        <div className="flex flex-col gap-1 px-3 py-3 text-center">
          {primaryStats.map((stat) => (
            <p key={stat.key} className="text-xs leading-relaxed text-[#ddd6cb] sm:text-[11px]">
              <span className="text-[#6b6258]">- </span>
              {formatPrimaryStatLine(stat)}
              <span className="text-[#6b6258]"> -</span>
            </p>
          ))}

          {primaryStats.length > 0 && secondaryStats.length > 0 && <ItemDivider />}

          {secondaryStats.map((stat) => {
            const gem = gemsByStat.get(stat.key);
            return (
              <p
                key={stat.key}
                className={cn(
                  'flex items-center justify-center gap-1.5 text-xs leading-relaxed sm:text-[11px]',
                  gem ? 'text-[#7eb8e8]' : 'text-[#8ec4ef]/85'
                )}
              >
                {gem && (
                  <img
                    src={gemIconUrl(gem.gemId)}
                    alt={gem.gemName}
                    title={gem.gemName}
                    loading="lazy"
                    className="h-3.5 w-3.5 shrink-0 object-contain [image-rendering:pixelated]"
                  />
                )}
                {formatSecondaryStatLine(stat)}
              </p>
            );
          })}
        </div>
      )}

      <div className="border-t border-[#2a241c] px-3 py-3 text-center sm:px-4">
        <p className="font-[Cinzel] text-xl font-semibold text-[#d4a054] sm:text-lg">
          {listing.price.toLocaleString()}G
        </p>
        {listing.quantity > 1 && (
          <p className="mt-0.5 text-xs text-[#8a7f72] sm:text-[10px]">
            {(listing.price_per_unit ?? listing.price).toLocaleString()}g each · qty {listing.quantity}
          </p>
        )}
        <p className={cn('mt-1 text-xs uppercase tracking-wider sm:text-[10px]', itemCardRarityClass(listing.rarity))}>
          {listing.rarity}
        </p>
        <p className="mt-2 font-[Cinzel] text-xs italic text-[#b8944f]/80 sm:text-[10px]">
          Expires {new Date(listing.expires_at).toLocaleDateString()}
        </p>
      </div>
    </article>
  );
}
