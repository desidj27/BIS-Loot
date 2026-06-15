import { cn } from '@/lib/utils';

export function MovingBorder({
  children,
  borderRadius = '0.75rem',
  className,
  containerClassName,
  duration = 3000,
  ...otherProps
}: {
  children: React.ReactNode;
  borderRadius?: string;
  className?: string;
  containerClassName?: string;
  duration?: number;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'relative isolate overflow-hidden bg-transparent p-px text-neutral-100',
        containerClassName
      )}
      style={{ borderRadius }}
      {...otherProps}
    >
      <div className="absolute inset-0" style={{ borderRadius }}>
        <div
          className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite]"
          style={{
            background:
              'conic-gradient(from 90deg at 50% 50%, #404040 0%, #a3a3a3 50%, #404040 100%)',
            animationDuration: `${duration}ms`,
          }}
        />
      </div>
      <div
        className={cn(
          'relative flex h-full w-full items-center justify-center bg-neutral-950 px-6 py-2.5 text-sm font-semibold tracking-wide backdrop-blur-xl transition-colors hover:bg-neutral-900 disabled:opacity-50',
          className
        )}
        style={{ borderRadius }}
      >
        {children}
      </div>
    </button>
  );
}
