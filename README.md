# Dark and Darker Market Tracker

A web app for tracking Dark and Darker marketplace prices, finding underpriced listings, and calculating craft costs.

Built on the [DarkerDB API](https://darkerdb.com/documentation/items) for live market data and price history.

## Features

- **Live Market Feed** — Browse active marketplace listings
- **Price Charts** — Historical price graphs (15m, 1h, 4h, 1d intervals) via DarkerDB analytics
- **Deal Alerts** — Finds listings priced ≥30% below fair market value (configurable)
- **Crafting Calculator** — All vendor craft recipes with ingredient costs at current market prices

## Quick Start

```bash
# Install dependencies
npm install

# Run both server (port 3001) and client (port 5173)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Project Structure

```
MarketTracker/
├── client/          # React + Vite frontend
├── server/          # Express API (proxies DarkerDB, adds analytics)
│   └── data/
│       └── merchant.json   # Craft recipes (from Dark and Darker Wiki)
└── package.json     # npm workspaces root
```

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/market` | Active marketplace listings |
| `GET /api/items/search?q=` | Search items by name |
| `GET /api/prices/:archetype/history` | Price history chart data |
| `GET /api/alerts?minProfit=30` | Underpriced listing alerts |
| `GET /api/crafting` | All craft recipes with costs |
| `GET /api/crafting?merchant=Leathersmith` | Filter by vendor |

## How Deal Alerts Work

For each active listing, the app compares the listing price against a **fair price** calculated from the last 24 hours of weighted average trade data. If the listing is at least 30% below fair value, it appears in the Deals tab.

## Craft Recipes

Recipe data is sourced from the [Dark and Darker Wiki](https://darkanddarker.wiki.spellsandguns.com/Data:Merchant.json) (not available via DarkerDB). Ingredient costs use the lowest active listing price, falling back to recent average if no listings exist.

## Credits

- Market data: [DarkerDB](https://darkerdb.com)
- Craft recipes: [Dark and Darker Wiki](https://darkanddarker.wiki.spellsandguns.com/)
