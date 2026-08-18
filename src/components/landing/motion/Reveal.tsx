import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { useReducedMotion } from './useReducedMotion';

const MOTION_TAGS = {
  div: motion.div,
  section: motion.section,
  article: motion.article,
  span: motion.span,
  h2: motion.h2,
  h3: motion.h3,
  p: motion.p,
  li: motion.li,
} as const;

type RevealTag = keyof typeof MOTION_TAGS;

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  once?: boolean;
  className?: string;
  as?: RevealTag;
}

// The one scroll-reveal primitive for anything new added in this pass.
// Under reduced motion this renders a PLAIN host element — no motion.*
// component, no IntersectionObserver — so "no observers running" holds
// literally, not just visually.
export function Reveal({ children, delay = 0, y = 24, once = true, className, as = 'div' }: RevealProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return React.createElement(as, { className }, children);
  }

  const MotionTag = MOTION_TAGS[as];
  const variants: Variants = {
    hidden: { opacity: 0, y },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.32, delay: delay / 1000, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount: 0.15, margin: '0px 0px -10% 0px' }}
      variants={variants}
    >
      {children}
    </MotionTag>
  );
}
