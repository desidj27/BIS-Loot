import cors from 'cors';
import express from 'express';
import {
  getAllItemsPaginated,
  getFairPrice,
  getItem,
  getItemAttributes,
  getLowestListingPrice,
  getMarketListings,
  getPriceHistory,
  searchItems,
  searchMarketListings,
} from './darkerdb.js';
import { filterListingsByAttributes, sortListingsByPrice } from './services/marketFilters.js';
import { getAttributeRangesForItem } from './services/itemAttributes.js';
import { findArbitrageOpportunities, getMarketSummary } from './services/arbitrage.js';
import { getCraftableGear } from './services/craftableGear.js';
import { getCraftingCosts, getCraftingCostForItem, getCraftingCostForItemId } from './services/crafting.js';
import { sortGearItems } from './services/items.js';
import { getCraftMerchants } from './recipes.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

let itemsCache: { data: ReturnType<typeof sortGearItems>; expiresAt: number } | null = null;
let craftableCache = new Map<
  string,
  { data: Awaited<ReturnType<typeof getCraftableGear>>; expiresAt: number }
>();
const ITEMS_CACHE_TTL_MS = 60 * 60 * 1000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', source: 'DarkerDB', api: 'https://api.darkerdb.com' });
});

app.get('/api/market', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const archetype = req.query.archetype as string | undefined;
    const listings = await getMarketListings({ limit, archetype, order: 'desc' });
    res.json(listings.filter((l) => !l.has_sold && !l.has_expired));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/market/search', async (req, res) => {
  try {
    const item = req.query.item as string | undefined;
    const rarity = req.query.rarity as string | undefined;
    const gems = (req.query.gems as 'any' | 'gemmed' | 'no_gems') || 'any';
    const limit = Number(req.query.limit) || 100;
    const attributesRaw = req.query.attributes as string | undefined;

    let listings = await searchMarketListings({ item, rarity, gems, limit });

    if (attributesRaw) {
      const attributeFilters = JSON.parse(attributesRaw) as Array<{
        field: string;
        display: string;
        min?: number;
      }>;
      listings = filterListingsByAttributes(listings, attributeFilters);
    }

    res.json(sortListingsByPrice(listings));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/items/attributes', async (req, res) => {
  try {
    const item = req.query.item as string | undefined;
    const rarity = req.query.rarity as string | undefined;

    if (item?.trim()) {
      const ranges = await getAttributeRangesForItem(item, rarity);
      res.json(ranges);
      return;
    }

    const attributes = await getItemAttributes();
    res.json(attributes);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/market/summary', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const summary = await getMarketSummary(limit);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/items/search', async (req, res) => {
  try {
    const q = String(req.query.q || '');
    if (!q) {
      res.json([]);
      return;
    }
    const items = await searchItems(q);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/items/craftable', async (req, res) => {
  try {
    const merchant = req.query.merchant as string | undefined;
    const includeCosts = req.query.costs !== 'false';
    const cacheKey = `${merchant ?? '__all__'}:${includeCosts ? 'full' : 'fast'}`;

    if (includeCosts) {
      const cached = craftableCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        res.json(cached.data);
        return;
      }
    }

    const data = await getCraftableGear(merchant, includeCosts);
    if (includeCosts) {
      craftableCache.set(cacheKey, { data, expiresAt: Date.now() + ITEMS_CACHE_TTL_MS });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/items/gear', async (_req, res) => {
  try {
    if (itemsCache && itemsCache.expiresAt > Date.now()) {
      res.json(itemsCache.data);
      return;
    }

    const allItems = await getAllItemsPaginated();
    const data = sortGearItems(allItems);
    itemsCache = { data, expiresAt: Date.now() + ITEMS_CACHE_TTL_MS };
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/items/:id/craft-cost', async (req, res) => {
  try {
    const cost = await getCraftingCostForItemId(req.params.id);
    if (!cost) {
      res.status(404).json({ error: 'No craft recipe found for this item' });
      return;
    }
    res.json(cost);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/items/:id', async (req, res) => {
  try {
    const item = await getItem(req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/prices/:archetype/history', async (req, res) => {
  try {
    const interval = String(req.query.interval || '1h');
    const history = await getPriceHistory(req.params.archetype, interval);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/prices/:archetype', async (req, res) => {
  try {
    const { archetype } = req.params;
    const [fairPrice, lowestPrice, listings] = await Promise.all([
      getFairPrice(archetype),
      getLowestListingPrice(archetype),
      getMarketListings({ archetype, limit: 10, order: 'asc', has_sold: false }),
    ]);

    res.json({
      archetype,
      fairPrice,
      lowestPrice,
      activeListings: listings.filter((l) => !l.has_sold && !l.has_expired).length,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/alerts', async (req, res) => {
  try {
    const minProfit = Number(req.query.minProfit) || 30;
    const limit = Number(req.query.limit) || 200;
    const opportunities = await findArbitrageOpportunities(minProfit, limit);
    res.json(opportunities);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/crafting/merchants', (_req, res) => {
  res.json(getCraftMerchants());
});

app.get('/api/crafting', async (req, res) => {
  try {
    const merchant = req.query.merchant as string | undefined;
    const costs = await getCraftingCosts(merchant);
    res.json(costs);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/crafting/:itemName', async (req, res) => {
  try {
    const costs = await getCraftingCostForItem(req.params.itemName);
    res.json(costs);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`Market Tracker API running on http://localhost:${PORT}`);
});
