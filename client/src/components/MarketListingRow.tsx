'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

interface MarketListingRowProps {
  listing: MarketListing;
  attributeLabels?: AttributeLabelMap;
}

function listingDisplayName(listing: MarketListing): string {
  if (listing.item?.trim()) return listing.item.trim();
  if (typeof listing.name === 'string' && listing.name.trim()) return listing.name.trim();
  const id = listing.item_id || '';
  const slug = id
    .replace(/^id\.item\./i, '')
    .replace(/_\d{3,4}$/, '')
    .replace(/_/g, ' ')
    .trim();
  if (!slug) return 'Unknown item';
  return slug.replace(/\b([a-z])/g, (_, c: string) => c.toUpperCase());
}

function ListingIcon({ itemId, size = 56 }: { itemId: string; size?: number }) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className="flex shrink-0 items-center justify-center border border-[#4a4338] bg-[#0a0908]"
      style={{ width: size, height: size }}
    >
      {!failed && itemId ? (
        <img
          src={listingIconUrl(itemId, 128)}
          alt=""
          loading="lazy"
          className="max-h-[88%] max-w-[88%] object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-sm text-[#5c534a]">?</span>
      )}
    </div>
  );
}

function ListingHoverPanel({
  listing,
  attributeLabels,
  title,
  top,
  left,
}: {
  listing: MarketListing;
  attributeLabels?: AttributeLabelMap;
  title: string;
  top: number;
  left: number;
}) {
  const stats = extractListingStats(listing, attributeLabels);
  const primaryStats = stats.filter((stat) => stat.slot === 'primary');
  const secondaryStats = stats.filter((stat) => stat.slot === 'secondary');
  const gemsByStat = new Map(
    extractListingGems(listing, attributeLabels).map((gem) => [gem.statKey, gem])
  );

  return (
    <div
      className={cn(
        'pointer-events-none z-[80] w-[300px] border border-[#8a7355] bg-[#0c0a09]',
        'shadow-[0_12px_40px_rgba(0,0,0,0.65)]'
      )}
      style={{ position: 'fixed', top, left }}
    >
      <div className="flex items-start gap-3 border-b border-[#2a241c] px-3 py-3">
        <ListingIcon itemId={listing.item_id} size={56} />
        <div className="min-w-0">
          <p
            className={cn(
              'font-[Cinzel] text-sm font-semibold leading-snug tracking-wide',
              itemCardRarityClass(listing.rarity)
            )}
          >
            {title}
          </p>
          <p className={cn('mt-0.5 text-[10px] uppercase tracking-wider', itemCardRarityClass(listing.rarity))}>
            {listing.rarity || 'Unknown'}
          </p>
          <p className="mt-1 font-[Cinzel] text-base font-semibold text-[#d4a054]">
            {listing.price.toLocaleString()}G
          </p>
          {listing.quantity > 1 && (
            <p className="text-[10px] text-[#8a7f72]">
              {(listing.price_per_unit ?? listing.price).toLocaleString()}g each · qty {listing.quantity}
            </p>
          )}
        </div>
      </div>

      {(primaryStats.length > 0 || secondaryStats.length > 0) && (
        <div className="max-h-56 space-y-1 overflow-y-auto px-3 py-2.5">
          {primaryStats.map((stat) => (
            <p key={stat.key} className="text-[11px] leading-snug text-[#ddd6cb]">
              {formatPrimaryStatLine(stat)}
            </p>
          ))}
          {primaryStats.length > 0 && secondaryStats.length > 0 && (
            <div className="my-1.5 h-px bg-[#2a241c]" />
          )}
          {secondaryStats.map((stat) => {
            const gem = gemsByStat.get(stat.key);
            return (
              <p
                key={stat.key}
                className={cn(
                  'flex items-center gap-1.5 text-[11px] leading-snug',
                  gem ? 'text-[#7eb8e8]' : 'text-[#8ec4ef]/85'
                )}
              >
                {gem && (
                  <img
                    src={gemIconUrl(gem.gemId)}
                    alt=""
                    className="h-3.5 w-3.5 shrink-0 object-contain [image-rendering:pixelated]"
                  />
                )}
                {formatSecondaryStatLine(stat)}
              </p>
            );
          })}
        </div>
      )}

      {primaryStats.length === 0 && secondaryStats.length === 0 && (
        <p className="px-3 py-2.5 text-[11px] text-[#8a7f72]">No rolled attributes</p>
      )}

      <div className="border-t border-[#2a241c] px-3 py-2 text-[10px] text-[#8a7f72]">
        Expires {new Date(listing.expires_at).toLocaleString()}
      </div>
    </div>
  );
}

export default function MarketListingRow({ listing, attributeLabels }: MarketListingRowProps) {
  const rowRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const title = listingDisplayName(listing);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onScroll = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [open]);

  function placePanel() {
    const el = rowRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const panelW = 308;
    const panelH = 320;
    const spaceRight = window.innerWidth - rect.right;
    const left =
      spaceRight > panelW + 12
        ? rect.right + 10
        : Math.max(8, Math.min(rect.left, window.innerWidth - panelW - 8));
    const top = Math.max(8, Math.min(rect.top, window.innerHeight - panelH - 8));
    setPos({ top, left });
  }

  function show() {
    placePanel();
    setOpen(true);
  }

  function hide() {
    setOpen(false);
  }

  function toggleFromTap(event: React.MouseEvent | React.TouchEvent) {
    if ((event.target as HTMLElement).closest('a')) return;
    if (open) {
      hide();
      return;
    }
    show();
  }

  return (
    <>
      <article
        ref={rowRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onClick={toggleFromTap}
        className={cn(
          'flex items-center gap-3 border-b border-[#2a241c] px-3 py-3',
          'bg-[#0a0908]/40 transition-colors hover:bg-[#171411]/90 sm:gap-4 sm:px-4'
        )}
      >
        <ListingIcon itemId={listing.item_id} size={56} />

        <div className="min-w-0 flex-1">
          <Link
            href={listing.item_id ? `/item/${listing.item_id}` : '#'}
            className={cn(
              'block truncate font-[Cinzel] text-base font-semibold tracking-wide no-underline hover:underline',
              itemCardRarityClass(listing.rarity)
            )}
          >
            {title}
          </Link>
          <p className="mt-0.5 truncate text-xs text-[#8a7f72]">
            <span className={cn('uppercase tracking-wider', itemCardRarityClass(listing.rarity))}>
              {listing.rarity || 'Unknown'}
            </span>
            <span className="mx-1.5 text-[#3a342c]">·</span>
            Expires {new Date(listing.expires_at).toLocaleDateString()}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-[Cinzel] text-lg font-semibold text-[#d4a054]">
            {listing.price.toLocaleString()}G
          </p>
          {listing.quantity > 1 && (
            <p className="text-[11px] text-[#8a7f72]">
              {(listing.price_per_unit ?? listing.price).toLocaleString()}g · ×{listing.quantity}
            </p>
          )}
        </div>
      </article>

      {mounted &&
        open &&
        createPortal(
          <ListingHoverPanel
            listing={listing}
            attributeLabels={attributeLabels}
            title={title}
            top={pos.top}
            left={pos.left}
          />,
          document.body
        )}
    </>
  );
}
