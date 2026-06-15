import type { getCraftableGear } from './services/craftableGear';
import type { sortGearItems } from './services/items';

const ITEMS_CACHE_TTL_MS = 60 * 60 * 1000;

type GearCache = { data: ReturnType<typeof sortGearItems>; expiresAt: number };

export const serverCache = {
  items: null as GearCache | null,
  craftable: new Map<string, { data: Awaited<ReturnType<typeof getCraftableGear>>; expiresAt: number }>(),
};

export { ITEMS_CACHE_TTL_MS };
