# Dark and Darker Market Tracker

A Next.js web app for tracking Dark and Darker marketplace prices, finding underpriced listings, and calculating craft costs.

Built on the [DarkerDB API](https://darkerdb.com/documentation/items) for live market data and price history.

## Features

- **Live Market Feed** — Browse active marketplace listings
- **Price Charts** — Historical price graphs (15m, 1h, 4h, 1d, 1w intervals)
- **Deal Alerts** — Finds listings priced below fair market value (configurable)
- **Crafting Calculator** — Vendor craft recipes with ingredient costs at current market prices

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
MarketTracker/
├── client/                 # Next.js app (App Router)
│   ├── src/app/            # Pages + API route handlers
│   ├── src/components/     # UI components
│   ├── src/lib/server/     # DarkerDB + analytics logic
│   └── data/merchant.json  # Craft recipes (wiki data)
└── package.json            # npm workspaces root
```

## API Endpoints

All API routes live under `/api/*` as Next.js Route Handlers:

| Endpoint | Description |
|---|---|
| `GET /api/market` | Active marketplace listings |
| `GET /api/market/search` | Filtered market search |
| `GET /api/items/search?q=` | Search items by name |
| `GET /api/prices/:archetype/history` | Price history chart data |
| `GET /api/alerts?minProfit=30` | Underpriced listing alerts |
| `GET /api/crafting` | All craft recipes with costs |

## Environment Variables

Optional AdSense (copy `client/.env.example` to `client/.env.local`):

```
NEXT_PUBLIC_ADSENSE_CLIENT=
NEXT_PUBLIC_AD_SLOT_FOOTER=
NEXT_PUBLIC_AD_SLOT_MARKET_SIDEBAR=
```

## Credits

- Market data: [DarkerDB](https://darkerdb.com)
- Craft recipes: [Dark and Darker Wiki](https://darkanddarker.wiki.spellsandguns.com/)
