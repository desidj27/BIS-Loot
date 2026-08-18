import { NextResponse } from 'next/server';
import {
  appOrigin,
  cookieOptions,
  createOAuthState,
  discordAuthorizeUrl,
  discordRedirectUri,
  OAUTH_STATE_COOKIE,
  requestOrigin,
} from '@/lib/server/session';

export async function GET(request: Request) {
  const origin = appOrigin(request);
  const fail = (message: string) =>
    NextResponse.redirect(`${origin}/watchers?loginError=${encodeURIComponent(message)}`);

  try {
    if (requestOrigin(request) !== origin) {
      return NextResponse.redirect(`${origin}/api/auth/discord`);
    }

    if (!process.env.DISCORD_CLIENT_ID?.trim() || !process.env.DISCORD_CLIENT_SECRET?.trim()) {
      return fail(
        process.env.VERCEL
          ? 'Add DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET in Vercel → Settings → Environment Variables, then redeploy.'
          : 'Add DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET to client/.env.local, then restart the server.'
      );
    }

    const state = createOAuthState();
    const redirectUri = discordRedirectUri(request);
    const authorizeUrl = discordAuthorizeUrl(state, redirectUri);
    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(OAUTH_STATE_COOKIE, state, cookieOptions(10 * 60));
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Discord login failed';
    return fail(message);
  }
}
