'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusScreen } from '@/components/ui/status-screen';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global Application Error Caught by Boundary:', error);
  }, [error]);

  return (
    <StatusScreen
      tone="danger"
      icon={<AlertTriangle />}
      title="Something went wrong"
      description={
        <>
          <p>This view failed to load. Your session and saved data are unaffected.</p>
          {error.message ? (
            <pre className="mt-4 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-subtle p-3 text-left font-mono text-xs text-red-700">
              {error.message}
              {error.digest ? `\nRef: ${error.digest}` : ''}
            </pre>
          ) : null}
        </>
      }
    >
      <Button onClick={() => reset()}>
        <RotateCcw />
        Try again
      </Button>
      <Button variant="outline" asChild>
        <Link href="/">Go to my workspace</Link>
      </Button>
    </StatusScreen>
  );
}
