"use client";

import { MotionConfig } from "motion/react";

/** Client-side providers. `reducedMotion="user"` disables transform animations for users who prefer reduced motion. */
export function Providers({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
