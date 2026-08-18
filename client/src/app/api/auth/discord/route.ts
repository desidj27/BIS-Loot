import { NextResponse } from 'next/server';
import {
  cookieOptions,
  createOAuthState,
  discordAuthorizeUrl,
  discordRedirectUri,
  OAUTH_STATE_COOKIE,
} from '@/lib/server/session';

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const fail = (message: string) =>
    NextResponse.redirect(`${origin}/watchers?loginError=${encodeURIComponent(message)}`);

  try {
    if (!process.env.DISCORD_CLIENT_ID?.trim() || !process.env.DISCORD_CLIENT_SECRET?.trim()) {
      return fail(
        'Add DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET to client/.env.local, then restart the server.'
      );
    }

    const state = createOAuthState();
    const redirectUri = discordRedirectUri(request.url);
    const authorizeUrl = discordAuthorizeUrl(state, redirectUri);
    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(OAUTH_STATE_COOKIE, state, cookieOptions(10 * 60));
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Discord login failed';
    return fail(message);
  }
}
