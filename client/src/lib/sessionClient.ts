'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, SessionUser } from '@/api/client';

type Listener = (user: SessionUser | null) => void;
const listeners = new Set<Listener>();
let cachedUser: SessionUser | null | undefined;

function emit(user: SessionUser | null) {
  cachedUser = user;
  for (const listener of listeners) listener(user);
}

export async function refreshSession(): Promise<SessionUser | null> {
  try {
    const data = await api.session();
    emit(data.user);
    return data.user;
  } catch {
    emit(null);
    return null;
  }
}

export async function logoutSession(): Promise<void> {
  await api.logout();
  emit(null);
}

export function useSessionUser() {
  const [user, setUser] = useState<SessionUser | null>(cachedUser ?? null);
  const [loading, setLoading] = useState(cachedUser === undefined);

  useEffect(() => {
    listeners.add(setUser);
    if (cachedUser === undefined) {
      void refreshSession().finally(() => setLoading(false));
    } else {
      setUser(cachedUser);
      setLoading(false);
    }
    return () => {
      listeners.delete(setUser);
    };
  }, []);

  const logout = useCallback(async () => {
    await logoutSession();
  }, []);

  return { user, loading, logout, refresh: refreshSession };
}
