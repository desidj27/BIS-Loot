import { cn } from '@/lib/utils';
import { gamePanelClass } from '@/lib/gameTheme';

export function GameDivider({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 px-4', className)}>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#5c4a32]/70 to-transparent" />
      <span className="text-[8px] text-[#6b5a42]">◆</span>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#5c4a32]/70 to-transparent" />
    </div>
  );
}

export function GamePanel({
  children,
  className,
  contentClassName,
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div className={cn(gamePanelClass, className)}>
      <div className={cn('flex flex-col gap-4', contentClassName)}>{children}</div>
    </div>
  );
}