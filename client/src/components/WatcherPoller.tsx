'use client';

import { useCallback, useEffect, useRef } from 'react';
import { api } from '@/api/client';
import { useSessionUser } from '@/lib/sessionClient';
import { WATCHER_CHECK_INTERVAL_MS } from '@/lib/watchers';

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
    const interval = window.setInterval(() => void runCheck(), WATCHER_CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [user, runCheck]);

  return null;
}
