import { cn } from '@/lib/utils';

/** Placeholder block with a soft left-to-right shimmer (static under reduced motion). */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-shimmer rounded-md bg-muted bg-[linear-gradient(90deg,transparent_25%,hsl(var(--card)/0.7)_50%,transparent_75%)] bg-size-[200%_100%]',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
