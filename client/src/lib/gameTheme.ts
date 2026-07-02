export const gamePanelClass =
  'border border-[#4a4338] bg-[linear-gradient(180deg,#171411_0%,#0c0a09_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_30px_rgba(0,0,0,0.35)]';

export const gameLabelClass =
  'text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a7f72]';

export const gameInputClass =
  'w-full min-h-11 border border-[#3a342c] bg-[#0a0908] px-3 py-2.5 text-base text-[#ddd6cb] placeholder:text-[#5c534a] focus:border-[#8a7355] focus:outline-none sm:text-sm';

export const gameButtonClass =
  'min-h-10 border border-[#5c534a] bg-[linear-gradient(180deg,#2a241c_0%,#171411_100%)] px-3 py-2 text-sm font-medium text-[#c9bfb0] transition-colors hover:border-[#8a7355] hover:text-[#f0e6d8] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:py-1.5 sm:text-xs';

export const gameButtonPrimaryClass =
  'w-full min-h-11 border border-[#8a7355] bg-[linear-gradient(180deg,#3d3020_0%,#241c14_100%)] px-4 py-3 font-[Cinzel] text-sm font-semibold tracking-wide text-[#e5b56e] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_14px_rgba(196,123,26,0.12)] transition-colors hover:border-[#c47b1a] hover:text-[#f5d492] disabled:cursor-not-allowed disabled:opacity-50';

export const gameHeadingClass =
  'font-[Cinzel] text-sm uppercase tracking-[0.22em] text-[#c9a86a]';

export const gameTitleClass =
  'font-[Cinzel] text-xl font-semibold tracking-wide text-[#e5b56e]';

export const gameMutedTextClass = 'text-sm text-[#8a7f72]';

export function itemCardRarityClass(rarity: string): string {
  const map: Record<string, string> = {
    Poor: 'text-[#9d9d9d]',
    Common: 'text-[#ffffff]',
    Uncommon: 'text-[#71AD31]',
    Rare: 'text-[#0070dd]',
    Epic: 'text-[#A335EE]',
    Legendary: 'text-[#FF8000] font-semibold',
    Unique: 'text-[#ECD99A] font-semibold',
    Artifact: 'text-[#E60505] font-semibold',
  };
  return map[rarity] ?? 'text-[#c9bfb0]';
}

export function itemCardRarityBarClass(rarity: string): string {
  const map: Record<string, string> = {
    Poor: 'bg-[#6b6b6b]',
    Common: 'bg-[#cccccc]',
    Uncommon: 'bg-[#71AD31]',
    Rare: 'bg-[#0070dd]',
    Epic: 'bg-[#A335EE]',
    Legendary: 'bg-[#FF8000]',
    Unique: 'bg-[#ECD99A]',
    Artifact: 'bg-[#E60505]',
  };
  return map[rarity] ?? 'bg-[#5c534a]';
}
