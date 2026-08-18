import React, { Children, isValidElement } from 'react';
import { Reveal } from './Reveal';

interface StaggerProps {
  children: React.ReactNode;
  step?: number;
  y?: number;
  className?: string;
  itemClassName?: string;
}

const MAX_TOTAL_STAGGER_MS = 400;

// Wraps a list and reveals each item with delay = index * step, capped so
// long grids don't crawl in over multiple seconds.
export function Stagger({ children, step = 60, y = 24, className, itemClassName }: StaggerProps) {
  const items = Children.toArray(children);
  return (
    <div className={className}>
      {items.map((child, index) => (
        <Reveal
          key={isValidElement(child) && child.key != null ? child.key : index}
          delay={Math.min(index * step, MAX_TOTAL_STAGGER_MS)}
          y={y}
          className={itemClassName}
        >
          {child}
        </Reveal>
      ))}
    </div>
  );
}
