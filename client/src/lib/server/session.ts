import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'bisloot_session';
export const OAUTH_STATE_COOKIE = 'bisloot_oauth_state';
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;

export interface SessionUser {
  id: string;
  username: string;
  avatarUrl: string | null;
}

function authSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error('AUTH_SECRET is not set. Add a random string to client/.env.local');
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac('sha256', authSecret()).update(payload).digest('base64url');
}

function verify(payload: string, signature: string): boolean {
  const expected = sign(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function encodeSession(user: SessionUser): string {
  const payload = Buffer.from(
    JSON.stringify({ ...user, exp: Date.now() + SESSION_MAX_AGE_SEC * 1000 })
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !verify(payload, signature)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionUser & {
      exp?: number;
    };
    if (!data.id || (data.exp != null && data.exp < Date.now())) return null;
    return {
      id: String(data.id),
      username: String(data.username ?? 'Discord'),
      avatarUrl: data.avatarUrl ?? null,
    };
  } catch {
    return null;
  }
}

export function createOAuthState(): string {
  return randomBytes(16).toString('hex');
}

export function cookieOptions(maxAge = SESSION_MAX_AGE_SEC) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return decodeSession(jar.get(SESSION_COOKIE)?.value);
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const error = new Error('Log in with Discord to use watchers');
    (error as Error & { status?: number }).status = 401;
    throw error;
  }
  return user;
}

export function discordRedirectUri(requestUrl: string): string {
  if (process.env.DISCORD_REDIRECT_URI?.trim()) {
    return process.env.DISCORD_REDIRECT_URI.trim();
  }
  return `${new URL(requestUrl).origin}/api/auth/callback/discord`;
}

export function discordAuthorizeUrl(state: string, redirectUri: string): string {
  const clientId = process.env.DISCORD_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error('DISCORD_CLIENT_ID is not set');
  }

  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'identify');
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'consent');
  return url.toString();
}

interface DiscordTokenResponse {
  access_token?: string;
}

interface DiscordUserResponse {
  id?: string;
  username?: string;
  global_name?: string | null;
  avatar?: string | null;
}

export async function exchangeDiscordCode(code: string, redirectUri: string): Promise<SessionUser> {
  const clientId = process.env.DISCORD_CLIENT_ID?.trim();
  const clientSecret = process.env.DISCORD_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error('DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET must be set');
  }

  const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Discord login failed');
  }

  const tokenBody = (await tokenResponse.json()) as DiscordTokenResponse;
  if (!tokenBody.access_token) {
    throw new Error('Discord login failed');
  }

  const userResponse = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenBody.access_token}` },
  });
  if (!userResponse.ok) {
    throw new Error('Could not read Discord profile');
  }

  const profile = (await userResponse.json()) as DiscordUserResponse;
  if (!profile.id) {
    throw new Error('Could not read Discord profile');
  }

  return {
    id: profile.id,
    username: profile.global_name || profile.username || 'Discord',
    avatarUrl: profile.avatar
      ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
      : null,
  };
}
