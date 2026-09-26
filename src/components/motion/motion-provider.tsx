'use client';

import React from 'react';
import { MotionConfig } from 'framer-motion';

/**
 * App-wide framer-motion defaults. `reducedMotion="user"` drops transform and
 * layout animations (keeping opacity fades) for people who ask the OS for less motion.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
