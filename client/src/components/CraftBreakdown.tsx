import { IngredientCost, formatGold } from '@/api/client';
import { cn } from '@/lib/utils';

interface CraftBreakdownProps {
  ingredients?: IngredientCost[] | null;
  loading?: boolean;
  compact?: boolean;
  className?: string;
}

function ingredientPrice(value: number | null, loading?: boolean) {
  if (value !== null) return formatGold(value);
  if (loading) return '…';
  return 'N/A';
}

export default function CraftBreakdown({
  ingredients,
  loading,
  compact,
  className,
}: CraftBreakdownProps) {
  if (loading && !ingredients?.length) {
    return <p className={cn('text-xs text-[#8a7f72]', className)}>Loading ingredients…</p>;
  }

  if (!ingredients?.length) return null;

  return (
    <div className={cn('space-y-1', className)}>
      {!compact && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a7f72]">
          Ingredient costs
        </p>
      )}
      <ul className="space-y-1">
        {ingredients.map((ingredient) => (
          <li
            key={`${ingredient.name}-${ingredient.rarity}`}
            className={cn(
              'flex flex-col items-start justify-between gap-1 sm:flex-row sm:items-start sm:gap-2',
              compact ? 'text-xs sm:text-[10px]' : 'text-sm sm:text-xs'
            )}
          >
            <span className="min-w-0 text-[#8a7f72]">
              {ingredient.amount}×{' '}
              <span className="text-[#ddd6cb]">
                {ingredient.name}
                {ingredient.rarityName && ingredient.rarityName !== 'Unknown'
                  ? ` (${ingredient.rarityName})`
                  : ''}
              </span>
              {!compact && ingredient.unitPrice !== null && (
                <span className="text-[#6b6258]"> @ {formatGold(ingredient.unitPrice)} ea</span>
              )}
            </span>
            <span className="shrink-0 font-[Cinzel] font-medium text-[#e5b56e]">
              {ingredientPrice(ingredient.totalCost, loading)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
