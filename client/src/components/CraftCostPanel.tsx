import { CraftCostResult, formatGold } from '@/api/client';
import CraftBreakdown from '@/components/CraftBreakdown';
import { GamePanel } from '@/components/ui/game-panel';
import { cn } from '@/lib/utils';
import { gameHeadingClass, gameMutedTextClass } from '@/lib/gameTheme';

interface CraftCostPanelProps {
  craftCost: CraftCostResult | null;
  loading?: boolean;
  embedded?: boolean;
  className?: string;
}

export default function CraftCostPanel({
  craftCost,
  loading,
  embedded,
  className,
}: CraftCostPanelProps) {
  if (!loading && !craftCost) return null;

  const content = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={gameHeadingClass}>Craft Cost</h3>
          <p className={cn('mt-1', gameMutedTextClass)}>
            {craftCost
              ? `${craftCost.merchant} · ${craftCost.outputRarityName}`
              : 'Loading recipe costs…'}
          </p>
        </div>
        {craftCost && !embedded && (
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#8a7f72]">Total craft</p>
              <p className="mt-1 font-[Cinzel] font-semibold text-[#e5b56e]">{formatGold(craftCost.craftCost)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#8a7f72]">Market</p>
              <p className="mt-1 font-[Cinzel] font-semibold text-[#e5b56e]">{formatGold(craftCost.marketPrice)}</p>
            </div>
          </div>
        )}
      </div>

      <CraftBreakdown
        ingredients={craftCost?.ingredients}
        loading={loading}
        className={cn(embedded ? 'mt-3' : 'mt-4 border-t border-[#3a342c] pt-4')}
      />
    </>
  );

  if (embedded) {
    return <div className={className}>{content}</div>;
  }

  return <GamePanel className={cn('p-6', className)}>{content}</GamePanel>;
}
