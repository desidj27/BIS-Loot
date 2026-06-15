'use client';

import Link from 'next/link';
import { CraftableGearItem, rarityClass } from '@/api/client';
import { Spotlight } from '@/components/ui/spotlight';
import { cn } from '@/lib/utils';

interface ItemCardProps {
  item: CraftableGearItem;
}

export default function ItemCard({ item }: ItemCardProps) {
  const subType = item.type === 'Armor' ? item.armor_type : item.hand_type;

  return (
    <Link href={`/item/${item.id}`} className="block no-underline hover:no-underline">
      <Spotlight
        className="h-full overflow-hidden transition-transform hover:scale-[1.02]"
        contentClassName="h-full gap-0"
      >
        <div className="flex h-[120px] items-center justify-center border-b border-neutral-800 bg-neutral-900/50 p-3">
          <img
            src={item.iconUrl}
            alt={item.name}
            loading="lazy"
            className="max-h-full max-w-full object-contain [image-rendering:pixelated]"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <span className="hidden text-3xl text-neutral-600">⚔</span>
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <span className={cn('text-[10px] font-medium uppercase tracking-wide', rarityClass(item.rarity))}>
            {item.rarity}
          </span>
          <h4 className="text-sm font-semibold text-white">{item.name}</h4>
          <p className="text-xs text-neutral-500">{subType ?? item.type}</p>
          <p className="mt-auto text-[11px] text-neutral-600">{item.merchant}</p>
        </div>
      </Spotlight>
    </Link>
  );
}
