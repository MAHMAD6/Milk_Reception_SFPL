'use client';

import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    position="top-right"
    closeButton
    richColors
    visibleToasts={4}
    offset={16}
    toastOptions={{
      classNames: {
        toast: 'group font-sans !rounded-lg !border !shadow-lg !text-sm',
        title: '!font-semibold',
        description: '!text-[13px] !opacity-90',
        closeButton: '!bg-card !border-border',
      },
    }}
    {...props}
  />
);

export { Toaster };
