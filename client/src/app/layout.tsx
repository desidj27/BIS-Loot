import type { Metadata } from 'next';
import { Cinzel, Inter } from 'next/font/google';
import { GridBackground } from '@/components/ui/grid-background';
import { GameDivider } from '@/components/ui/game-panel';
import AdSlot from '@/components/AdSlot';
import { isAdClientConfigured } from '@/lib/ads';
import BisLootLogo from '@/components/BisLootLogo';
import SiteNav from '@/components/SiteNav';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-cinzel',
});

export const metadata: Metadata = {
  title: 'BisLoot',
  description: 'Dark and Darker marketplace prices, deals, and craft costs',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${cinzel.variable}`}>
      <head>
        <meta name="google-adsense-account" content="ca-pub-6977571958869287" />
      </head>
      <body className="font-sans">
        <GridBackground className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-50 border-b border-[#4a4338] bg-[#0c0a09]/95 backdrop-blur-sm supports-[padding:max(0px)]:pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="flex w-full flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4 md:px-12 lg:px-16 xl:px-24">
              <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                <BisLootLogo size={40} className="shrink-0 sm:hidden" />
                <BisLootLogo size={48} className="hidden shrink-0 sm:block" />
                <div className="min-w-0">
                  <h1 className="truncate font-[Cinzel] text-lg font-semibold tracking-wide text-[#e5b56e] sm:text-xl md:text-2xl">
                    BisLoot
                  </h1>
                  <p className="truncate text-xs text-[#8a7f72] sm:text-sm md:text-base">
                    Dark and Darker · Powered by DarkerDB
                  </p>
                </div>
              </div>
              <SiteNav />
            </div>
            <GameDivider className="pb-0" />
          </header>

          <main className="w-full flex-1 px-3 py-4 supports-[padding:max(0px)]:px-[max(0.75rem,env(safe-area-inset-left))] supports-[padding:max(0px)]:pr-[max(0.75rem,env(safe-area-inset-right))] sm:px-6 sm:py-6 md:px-12 lg:px-16 xl:px-24">
            {children}
          </main>

          <footer className="border-t border-[#4a4338]">
            {isAdClientConfigured() ? (
              <div className="px-3 py-4 sm:px-6 md:px-12 lg:px-16 xl:px-24">
                <AdSlot placement="footer" format="horizontal" className="mx-auto max-w-4xl" />
              </div>
            ) : null}
            <div className="border-t border-[#4a4338]/60 py-4 text-center text-xs text-[#8a7f72]">
              Item data from{' '}
              <a
                href="https://darkerdb.com/documentation/items"
                target="_blank"
                rel="noreferrer"
                className="text-[#c9a86a] underline-offset-2 hover:text-[#e5b56e] hover:underline"
              >
                DarkerDB API
              </a>
            </div>
          </footer>
        </GridBackground>
      </body>
    </html>
  );
}
