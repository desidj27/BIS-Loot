'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Market', exact: true },
  { href: '/alerts', label: 'Deals', exact: false },
] as const;

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border border-[#4a4338] bg-[#0a0908] p-1">
      {NAV_ITEMS.map(({ href, label, exact }) => {
        const isActive = exact ? pathname === href : (pathname?.startsWith(href) ?? false);

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'relative px-4 py-2 font-[Cinzel] text-sm tracking-wide no-underline hover:no-underline',
              isActive
                ? 'border border-[#8a7355] bg-[linear-gradient(180deg,#3d3020_0%,#241c14_100%)] text-[#f5d492] shadow-[0_0_10px_rgba(196,123,26,0.15)]'
                : 'border border-transparent text-[#8a7f72] hover:text-[#ddd6cb]'
            )}
          >
            {isActive && (
              <span className="absolute -left-2 top-1/2 -translate-y-1/2 text-[10px] text-[#c47b1a]">
                ▶
              </span>
            )}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
