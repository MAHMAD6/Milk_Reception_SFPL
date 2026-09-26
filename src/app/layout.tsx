import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { ToastProvider } from '@/frontend/context/ToastContext';
import { PwaShell } from '@/frontend/modules/pwa/PwaShell';
import { TooltipProvider } from '@/components/ui/tooltip';

export const metadata: Metadata = {
  title: {
    default: 'Milk Reception · SFPL',
    template: '%s · SFPL Milk Reception',
  },
  description: 'Milk reception, quality and supply-chain operations for Shakarganj Food Products Ltd.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#1E3A8A',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased" suppressHydrationWarning>
        <TooltipProvider delayDuration={250}>
          <ToastProvider>
            {children}
            <PwaShell />
          </ToastProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
