import { NextResponse } from 'next/server';
import { cookieOptions, OAUTH_STATE_COOKIE, SESSION_COOKIE } from '@/lib/server/session';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', { ...cookieOptions(0), maxAge: 0 });
  response.cookies.set(OAUTH_STATE_COOKIE, '', { ...cookieOptions(0), maxAge: 0 });
  return response;
}
