import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin text-muted-foreground', className)} aria-hidden="true" />;
}

/** Full-area loading state used while a workspace resolves its session. */
export function PageLoader({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex min-h-[60vh] w-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground', className)}
    >
      <Spinner className="h-5 w-5 text-primary" />
      <span>{label}</span>
    </div>
  );
}
