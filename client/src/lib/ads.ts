const DEFAULT_ADSENSE_CLIENT = 'ca-pub-6977571958869287';

export const adsConfig = {
  clientId: process.env.NEXT_PUBLIC_ADSENSE_CLIENT || DEFAULT_ADSENSE_CLIENT,
  slots: {
    footer: process.env.NEXT_PUBLIC_AD_SLOT_FOOTER,
    marketSidebar: process.env.NEXT_PUBLIC_AD_SLOT_MARKET_SIDEBAR,
  },
} as const;

export type AdPlacement = keyof typeof adsConfig.slots;

export function isAdClientConfigured(): boolean {
  return Boolean(adsConfig.clientId);
}

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
