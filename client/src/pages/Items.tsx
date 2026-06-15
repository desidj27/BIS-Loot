import { useEffect, useMemo, useState } from 'react';
import { api, CraftableGearItem } from '@/api/client';
import ItemCard from '@/components/ItemCard';
import { Spotlight } from '@/components/ui/spotlight';
import { cn } from '@/lib/utils';

const inputClass =
  'rounded-lg border border-neutral-800 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-200 focus:border-neutral-600 focus:outline-none';

function ItemGrid({ items }: { items: CraftableGearItem[] }) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-neutral-500">
        No craftable items match your filter.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4 p-4">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}

export default function Items() {
  const [armor, setArmor] = useState<CraftableGearItem[]>([]);
  const [weapons, setWeapons] = useState<CraftableGearItem[]>([]);
  const [merchants, setMerchants] = useState<string[]>([]);
  const [merchant, setMerchant] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.craftingMerchants().then(setMerchants).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await api.craftableGear(merchant || undefined, false);
        if (!cancelled) {
          setArmor(data.armor);
          setWeapons(data.weapons);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [merchant]);

  const filter = (items: CraftableGearItem[]) =>
    items.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));

  const filteredArmor = useMemo(() => filter(armor), [armor, search]);
  const filteredWeapons = useMemo(() => filter(weapons), [weapons, search]);

  return (
    <div className="space-y-6">
      <Spotlight className="p-6">
        <h2 className="text-xl font-semibold text-white">Craftable Gear</h2>
        <p className="mt-1 text-sm text-neutral-400">
          All craftable armor and weapons from vendor recipes, sorted by rarity then type. Search an
          item on the Market page to see craft costs and ingredient breakdown.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <select className={inputClass} value={merchant} onChange={(e) => setMerchant(e.target.value)}>
            <option value="">All Merchants</option>
            {merchants.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <input
            type="search"
            placeholder="Filter by item name…"
            className={cn(inputClass, 'min-w-[200px] flex-1')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Spotlight>

      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-neutral-500">Loading craftable gear…</div>
      ) : (
        <>
          <Spotlight contentClassName="gap-0">
            <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">Armor</h3>
              <span className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-0.5 text-xs text-neutral-400">
                {filteredArmor.length} items
              </span>
            </div>
            <ItemGrid items={filteredArmor} />
          </Spotlight>

          <Spotlight contentClassName="gap-0">
            <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">Weapons</h3>
              <span className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-0.5 text-xs text-neutral-400">
                {filteredWeapons.length} items
              </span>
            </div>
            <ItemGrid items={filteredWeapons} />
          </Spotlight>
        </>
      )}
    </div>
  );
}
