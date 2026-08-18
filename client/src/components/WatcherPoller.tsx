'use client';

import { useCallback, useEffect, useRef } from 'react';
import { api } from '@/api/client';
import { useSessionUser } from '@/lib/sessionClient';

const POLL_MS = 90_000;

export default function WatcherPoller() {
  const { user } = useSessionUser();
  const inFlight = useRef(false);

  const runCheck = useCallback(async () => {
    if (!user || inFlight.current || document.visibilityState === 'hidden') return;

    inFlight.current = true;
    try {
      await api.checkWatchers();
    } catch {
      // Watchers page shows per-watcher errors after a manual refresh.
    } finally {
      inFlight.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;

    void runCheck();
    const interval = window.setInterval(() => void runCheck(), POLL_MS);

    function onVisible() {
      if (document.visibilityState === 'visible') void runCheck();
    }

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [user, runCheck]);

  return null;
}
