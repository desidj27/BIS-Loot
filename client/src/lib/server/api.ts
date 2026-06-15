import { NextResponse } from 'next/server';

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : 'Request failed';
  return NextResponse.json({ error: message }, { status });
}
