import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { WatcherRule } from '@/lib/watchers';
import { capSeenListingIds, maxWatchersForUser } from '@/lib/watchers';

type StoreShape = Record<string, WatcherRule[]>;

const UPSTASH_PREFIX = 'bisloot:watchers:';
const UPSTASH_USER_INDEX = 'bisloot:watcher-users';

function fileStorePath(): string {
  if (process.env.WATCHER_STORE_PATH?.trim()) {
    return process.env.WATCHER_STORE_PATH.trim();
  }
  if (process.env.VERCEL) {
    return join('/tmp', 'bisloot-user-watchers.json');
  }
  return join(process.cwd(), 'data', 'user-watchers.json');
}

function upstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

export type WatcherStorageMode = 'redis' | 'local' | 'ephemeral';

export function watcherStorageMode(): WatcherStorageMode {
  if (upstashConfig()) return 'redis';
  if (process.env.VERCEL) return 'ephemeral';
  return 'local';
}

async function upstashCommand(command: unknown[]): Promise<unknown> {
  const config = upstashConfig();
  if (!config) return null;

  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!response.ok) {
    throw new Error('Watcher store unavailable');
  }
  const body = (await response.json()) as { result?: unknown };
  return body.result ?? null;
}

let fileWriteChain = Promise.resolve();

function withFileLock<T>(work: () => Promise<T>): Promise<T> {
  const next = fileWriteChain.then(work, work);
  fileWriteChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function readFileStore(): Promise<StoreShape> {
  try {
    const raw = await readFile(fileStorePath(), 'utf8');
    const parsed = JSON.parse(raw) as StoreShape;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeFileStore(data: StoreShape): Promise<void> {
  const path = fileStorePath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data), 'utf8');
}

function sanitizeWatchers(watchers: WatcherRule[], userId: string): WatcherRule[] {
  const cap = maxWatchersForUser(userId);
  const limited = cap == null ? watchers : watchers.slice(0, cap);
  return limited.map((watcher) => ({
    ...watcher,
    seenListingIds: capSeenListingIds(watcher.seenListingIds ?? []),
  }));
}

export async function getUserWatchers(userId: string): Promise<WatcherRule[]> {
  const redis = upstashConfig();
  if (redis) {
    const raw = await upstashCommand(['GET', `${UPSTASH_PREFIX}${userId}`]);
    if (typeof raw !== 'string' || !raw) return [];
    try {
      const parsed = JSON.parse(raw) as WatcherRule[];
      return Array.isArray(parsed) ? sanitizeWatchers(parsed, userId) : [];
    } catch {
      return [];
    }
  }

  const all = await readFileStore();
  return sanitizeWatchers(all[userId] ?? [], userId);
}

export async function listWatcherUserIds(): Promise<string[]> {
  const redis = upstashConfig();
  if (redis) {
    const members = await upstashCommand(['SMEMBERS', UPSTASH_USER_INDEX]);
    if (Array.isArray(members) && members.length > 0) {
      return members.map((id) => String(id));
    }

    const ids = new Set<string>();
    let cursor = '0';
    for (let i = 0; i < 50; i++) {
      const scanned = await upstashCommand([
        'SCAN',
        cursor,
        'MATCH',
        `${UPSTASH_PREFIX}*`,
        'COUNT',
        100,
      ]);
      if (!Array.isArray(scanned) || scanned.length < 2) break;
      cursor = String(scanned[0] ?? '0');
      const keys = Array.isArray(scanned[1]) ? scanned[1] : [];
      for (const key of keys) {
        const id = String(key).slice(UPSTASH_PREFIX.length);
        if (id) ids.add(id);
      }
      if (cursor === '0') break;
    }

    const listed = [...ids];
    if (listed.length > 0) {
      await upstashCommand(['SADD', UPSTASH_USER_INDEX, ...listed]);
    }
    return listed;
  }

  return Object.keys(await readFileStore());
}

export async function setUserWatchers(userId: string, watchers: WatcherRule[]): Promise<WatcherRule[]> {
  const next = sanitizeWatchers(watchers, userId);

  if (upstashConfig()) {
    await upstashCommand(['SET', `${UPSTASH_PREFIX}${userId}`, JSON.stringify(next)]);
    if (next.length === 0) {
      await upstashCommand(['SREM', UPSTASH_USER_INDEX, userId]);
    } else {
      await upstashCommand(['SADD', UPSTASH_USER_INDEX, userId]);
    }
    return next;
  }

  await withFileLock(async () => {
    const all = await readFileStore();
    all[userId] = next;
    await writeFileStore(all);
  });

  return next;
}
