import { NextResponse } from 'next/server';

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(error: unknown, status = 500) {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Request failed';
  const inferred =
    error instanceof Error && typeof (error as Error & { status?: number }).status === 'number'
      ? (error as Error & { status: number }).status
      : status;
  return NextResponse.json({ error: message }, { status: inferred });
}
