import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  cookieOptions,
  discordRedirectUri,
  encodeSession,
  exchangeDiscordCode,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
} from '@/lib/server/session';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  const fail = (message: string) =>
    NextResponse.redirect(`${origin}/watchers?loginError=${encodeURIComponent(message)}`);

  if (oauthError) return fail('Discord login was cancelled');
  if (!code || !state) return fail('Discord login failed');

  const jar = await cookies();
  const expected = jar.get(OAUTH_STATE_COOKIE)?.value;
  if (!expected || expected !== state) {
    return fail('Discord login expired. Try again.');
  }

  try {
    const user = await exchangeDiscordCode(code, discordRedirectUri(request.url));
    const response = NextResponse.redirect(`${origin}/watchers`);
    response.cookies.set(SESSION_COOKIE, encodeSession(user), cookieOptions());
    response.cookies.set(OAUTH_STATE_COOKIE, '', { ...cookieOptions(0), maxAge: 0 });
    return response;
  } catch {
    return fail('Discord login failed');
  }
}
