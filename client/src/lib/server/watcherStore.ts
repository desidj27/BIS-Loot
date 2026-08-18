import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { WatcherRule } from '@/lib/watchers';
import { capSeenListingIds, MAX_WATCHERS_PER_USER } from '@/lib/watchers';

type StoreShape = Record<string, WatcherRule[]>;

const UPSTASH_PREFIX = 'bisloot:watchers:';

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

function sanitizeWatchers(watchers: WatcherRule[]): WatcherRule[] {
  return watchers.slice(0, MAX_WATCHERS_PER_USER).map((watcher) => ({
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
      return Array.isArray(parsed) ? sanitizeWatchers(parsed) : [];
    } catch {
      return [];
    }
  }

  const all = await readFileStore();
  return sanitizeWatchers(all[userId] ?? []);
}

export async function setUserWatchers(userId: string, watchers: WatcherRule[]): Promise<WatcherRule[]> {
  const next = sanitizeWatchers(watchers);

  if (upstashConfig()) {
    await upstashCommand(['SET', `${UPSTASH_PREFIX}${userId}`, JSON.stringify(next)]);
    return next;
  }

  await withFileLock(async () => {
    const all = await readFileStore();
    all[userId] = next;
    await writeFileStore(all);
  });

  return next;
}
