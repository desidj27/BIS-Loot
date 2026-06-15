import type { Metadata } from 'next';
import { Cinzel, Inter } from 'next/font/google';
import { GridBackground } from '@/components/ui/grid-background';
import { GameDivider } from '@/components/ui/game-panel';
import AdSlot from '@/components/AdSlot';
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
  title: 'Market Tracker',
  description: 'Dark and Darker marketplace prices, deals, and craft costs',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${cinzel.variable}`}>
      <body className="font-sans">
        <GridBackground className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-50 border-b border-[#4a4338] bg-[#0c0a09]/95 backdrop-blur-sm">
            <div className="flex w-full flex-wrap items-center justify-between gap-4 px-6 py-4 md:px-12 lg:px-16 xl:px-24">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center border border-[#5c534a] bg-[#171411] font-[Cinzel] text-lg text-[#e5b56e]">
                  ⚔
                </span>
                <div>
                  <h1 className="font-[Cinzel] text-lg font-semibold tracking-wide text-[#e5b56e]">
                    Market Tracker
                  </h1>
                  <p className="text-xs text-[#8a7f72]">Dark and Darker · Powered by DarkerDB</p>
                </div>
              </div>
              <SiteNav />
            </div>
            <GameDivider className="pb-0" />
          </header>

          <main className="w-full flex-1 px-6 py-6 md:px-12 lg:px-16 xl:px-24">
            {children}
          </main>

          <footer className="border-t border-[#4a4338]">
            <div className="px-6 py-4 md:px-12 lg:px-16 xl:px-24">
              <AdSlot placement="footer" format="horizontal" className="mx-auto max-w-4xl" />
            </div>
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
