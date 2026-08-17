'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { adsConfig, isAdConfigured, loadAdSenseScript, type AdPlacement } from '@/lib/ads';

interface AdSlotProps {
  placement: AdPlacement;
  className?: string;
  /** AdSense ad format. Sidebar uses vertical; footer uses horizontal. */
  format?: 'auto' | 'rectangle' | 'horizontal' | 'vertical';
}

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

export default function AdSlot({
  placement,
  className,
  format = 'auto',
}: AdSlotProps) {
  const insRef = useRef<HTMLModElement>(null);
  const configured = isAdConfigured(placement);
  const slotId = adsConfig.slots[placement];

  useEffect(() => {
    if (!configured || !adsConfig.clientId || !slotId || !insRef.current) return;

    let cancelled = false;

    loadAdSenseScript(adsConfig.clientId)
      .then(() => {
        if (cancelled || !insRef.current) return;
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch {
          // Ad blockers or script errors — leave the slot empty.
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [configured, placement, slotId]);

  if (!configured) {
    return null;
  }

  return (
    <aside className={cn('overflow-hidden', className)} aria-label="Advertisement">
      <ins
        ref={insRef}
        className="adsbygoogle block"
        style={{ display: 'block' }}
        data-ad-client={adsConfig.clientId}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-full-width-responsive={format === 'auto' || format === 'horizontal' ? 'true' : undefined}
      />
    </aside>
  );
}
