"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Fades + lifts content in when it scrolls into view. Transforms are skipped
 * for users who prefer reduced motion (see <MotionConfig reducedMotion="user">),
 * and a <noscript> rule in the root layout keeps content visible without JS.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 18,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  return (
    <motion.div
      data-reveal=""
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
