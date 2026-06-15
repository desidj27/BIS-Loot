export const adsConfig = {
  clientId: import.meta.env.VITE_ADSENSE_CLIENT as string | undefined,
  slots: {
    footer: import.meta.env.VITE_AD_SLOT_FOOTER as string | undefined,
    marketSidebar: import.meta.env.VITE_AD_SLOT_MARKET_SIDEBAR as string | undefined,
  },
} as const;

export type AdPlacement = keyof typeof adsConfig.slots;

export function isAdConfigured(placement: AdPlacement): boolean {
  return Boolean(adsConfig.clientId && adsConfig.slots[placement]);
}

let adsenseScriptPromise: Promise<void> | null = null;

export function loadAdSenseScript(clientId: string): Promise<void> {
  if (adsenseScriptPromise) return adsenseScriptPromise;

  adsenseScriptPromise = new Promise((resolve, reject) => {
    if (document.querySelector('script[data-adsense="true"]')) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`;
    script.crossOrigin = 'anonymous';
    script.dataset.adsense = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load AdSense script'));
    document.head.appendChild(script);
  });

  return adsenseScriptPromise;
}
