import type React from 'react';

/** Keyboard activation for non-button elements that act as buttons (Enter / Space). */
export function onActivateKey(event: React.KeyboardEvent<HTMLElement>) {
  if (event.target !== event.currentTarget) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    event.currentTarget.click();
  }
}
