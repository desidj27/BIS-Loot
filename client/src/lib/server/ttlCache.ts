const memory = new Map<string, { value: unknown; expiresAt: number }>();
const PREFIX = 'bisloot:cache:';

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
  if (!response.ok) return null;
  const body = (await response.json()) as { result?: unknown };
  return body.result ?? null;
}

export async function withTtlCache<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const local = memory.get(key);
  if (local && local.expiresAt > now) {
    return local.value as T;
  }

  const redisKey = `${PREFIX}${key}`;
  const raw = await upstashCommand(['GET', redisKey]);
  if (typeof raw === 'string' && raw) {
    try {
      const parsed = JSON.parse(raw) as T;
      memory.set(key, { value: parsed, expiresAt: now + ttlMs });
      return parsed;
    } catch {
      // fall through to reload
    }
  }

  const value = await load();
  memory.set(key, { value, expiresAt: now + ttlMs });
  const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
  void upstashCommand(['SET', redisKey, JSON.stringify(value), 'EX', ttlSec]);
  return value;
}
