import type { AttributeFilter, MarketListing } from '../darkerdb';
import { darkerdbItemIconUrl, searchMarketListings } from '../darkerdb';
import {
  extractListingStats,
  formatPrimaryStatLine,
  formatSecondaryStatLine,
} from '@/lib/listingStats';
import {
  filterListingsByAttributes,
  filterListingsByMaxUnitPrice,
  listingUnitPrice,
  sortListingsByPrice,
} from './marketFilters';

export interface WatcherMatchInput {
  id: string;
  itemName: string;
  rarity?: string;
  gems?: 'any' | 'gemmed' | 'no_gems';
  attributes?: AttributeFilter[];
  maxPrice?: number | null;
  webhookUrl: string;
  seenListingIds?: number[];
}

const DISCORD_WEBHOOK_PATH = /^\/api\/webhooks\/\d+\/[\w-]+\/?$/;
const DISCORD_SNOWFLAKE = /^\d{17,20}$/;
const MAX_NOTIFY_PER_WATCHER = 3;
const RARITY_COLORS: Record<string, number> = {
  Poor: 0x9d9d9d,
  Common: 0xffffff,
  Uncommon: 0x71ad31,
  Rare: 0x0070dd,
  Epic: 0xa335ee,
  Legendary: 0xff8000,
  Unique: 0xecd99a,
  Artifact: 0xe60505,
};

function siteOrigin(): string {
  return (process.env.DARKERDB_ORIGIN?.trim() || 'https://www.bisloot.website').replace(/\/$/, '');
}

export function isDiscordWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.hostname !== 'discord.com' && parsed.hostname !== 'discordapp.com') return false;
    return DISCORD_WEBHOOK_PATH.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function listingMatchesWatcher(
  listing: MarketListing,
  watcher: Pick<WatcherMatchInput, 'attributes' | 'maxPrice'>
): boolean {
  const byRolls = filterListingsByAttributes([listing], watcher.attributes ?? []);
  if (byRolls.length === 0) return false;
  return filterListingsByMaxUnitPrice(byRolls, watcher.maxPrice).length > 0;
}

export async function findWatcherMatches(watcher: WatcherMatchInput): Promise<MarketListing[]> {
  const itemName = watcher.itemName.trim();
  if (!itemName) return [];

  const listings = await searchMarketListings({
    item: itemName,
    rarity: watcher.rarity?.trim() || undefined,
    gems: watcher.gems ?? 'any',
    limit: 100,
  });

  return sortListingsByPrice(
    filterListingsByMaxUnitPrice(
      filterListingsByAttributes(listings, watcher.attributes ?? []),
      watcher.maxPrice
    )
  );
}

function formatGold(value: number): string {
  return `${value.toLocaleString()}G`;
}

function rollLines(listing: MarketListing): string[] {
  return extractListingStats(listing)
    .slice(0, 8)
    .map((stat) =>
      stat.slot === 'primary' ? formatPrimaryStatLine(stat) : formatSecondaryStatLine(stat)
    );
}

function watcherConditionLine(watcher: WatcherMatchInput): string {
  const parts: string[] = [];
  if (watcher.rarity?.trim()) parts.push(watcher.rarity.trim());
  if (watcher.maxPrice != null && watcher.maxPrice > 0) {
    parts.push(`≤ ${formatGold(watcher.maxPrice)} ea`);
  }
  for (const attr of watcher.attributes ?? []) {
    if (attr.min === undefined) parts.push(attr.display);
    else parts.push(`${attr.display} ≥ ${attr.min}`);
  }
  return parts.join(' · ') || 'Any matching listing';
}

export function buildWatcherEmbed(listing: MarketListing, watcher: WatcherMatchInput) {
  const unit = listingUnitPrice(listing);
  const rarityKey = listing.rarity
    ? listing.rarity.charAt(0).toUpperCase() + listing.rarity.slice(1).toLowerCase()
    : '';
  const rolls = rollLines(listing);

  const fields: Array<{ name: string; value: string; inline: boolean }> = [
    {
      name: 'Price',
      value:
        listing.quantity > 1
          ? `${formatGold(listing.price)} · ${formatGold(unit)} ea`
          : formatGold(unit),
      inline: true,
    },
    { name: 'Qty', value: String(listing.quantity), inline: true },
    { name: 'Rarity', value: listing.rarity || 'Unknown', inline: true },
  ];

  if (rolls.length > 0) {
    fields.push({ name: 'Rolls', value: rolls.join('\n').slice(0, 1024), inline: false });
  }

  return {
    title: listing.item,
    url: `${siteOrigin()}/item/${encodeURIComponent(listing.item_id)}`,
    color: RARITY_COLORS[rarityKey] ?? 0xc9a86a,
    thumbnail: listing.item_id ? { url: darkerdbItemIconUrl(listing.item_id) } : undefined,
    fields,
    footer: { text: `BisLoot watcher · ${watcherConditionLine(watcher)}` },
  };
}

function discordUserPing(discordUserId: string): {
  content?: string;
  allowed_mentions?: { parse: string[]; users: string[] };
} {
  if (!DISCORD_SNOWFLAKE.test(discordUserId)) return {};
  return {
    content: `<@${discordUserId}>`,
    allowed_mentions: { parse: [], users: [discordUserId] },
  };
}

export async function postDiscordWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (!isDiscordWebhookUrl(webhookUrl)) {
    throw new Error('Invalid Discord webhook URL');
  }

  const response = await fetch(`${webhookUrl}?wait=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook failed (${response.status})`);
  }
}

export async function notifyWatcherMatches(
  watcher: WatcherMatchInput,
  listings: MarketListing[],
  discordUserId: string
): Promise<number[]> {
  const seen = new Set(watcher.seenListingIds ?? []);
  const fresh = listings.filter((listing) => !seen.has(listing.id)).slice(0, MAX_NOTIFY_PER_WATCHER);
  const notified: number[] = [];
  const ping = discordUserPing(discordUserId);

  for (const listing of fresh) {
    await postDiscordWebhook(watcher.webhookUrl, {
      username: 'BisLoot',
      ...ping,
      embeds: [buildWatcherEmbed(listing, watcher)],
    });
    notified.push(listing.id);
  }

  return notified;
}

export async function sendWatcherTestPing(
  webhookUrl: string,
  itemName?: string,
  discordUserId?: string
): Promise<void> {
  await postDiscordWebhook(webhookUrl, {
    username: 'BisLoot',
    ...discordUserPing(discordUserId ?? ''),
    embeds: [
      {
        title: 'Watcher connected',
        description: itemName?.trim()
          ? `This webhook will ping you when **${itemName.trim()}** matches your rolls or price.`
          : 'This webhook will ping you when a watched item matches your rolls or price.',
        color: 0xe5b56e,
        footer: { text: 'BisLoot · Discord watcher test' },
      },
    ],
  });
}
