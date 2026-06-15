import { cn } from '@/lib/utils';

export function GridBackground({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative min-h-screen w-full bg-[#080706]', className)}>
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 0%, rgba(196,123,26,0.06), transparent 45%), linear-gradient(180deg, rgba(255,255,255,0.02), transparent 20%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="#080706"/><path d="M0 4h1v-1H0zM4 0v1h-1V0z" fill="#11100e" fill-opacity="0.5"/></svg>'
          )}")`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
