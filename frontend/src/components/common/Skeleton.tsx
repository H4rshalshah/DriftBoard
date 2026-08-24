import { type HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export type SkeletonVariant = 'text' | 'card' | 'image' | 'avatar';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  lines?: number;
}

const variantStyles: Record<SkeletonVariant, string> = {
  text: 'rounded bg-gray-100 dark:bg-white/[0.04]',
  card: 'rounded-xl bg-gray-100 dark:bg-white/[0.04]',
  image: 'rounded-lg bg-gray-100 dark:bg-white/[0.04]',
  avatar: 'rounded-full bg-gray-100 dark:bg-white/[0.04]',
};

export function Skeleton({
  variant = 'text',
  width,
  height,
  lines,
  className,
  ...props
}: SkeletonProps) {
  if (variant === 'text' && lines && lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-4 bg-gray-100 dark:bg-white/[0.04] rounded relative overflow-hidden',
              i === lines - 1 && 'w-3/4',
              className
            )}
            style={{ width: i === lines - 1 ? '75%' : width, height }}
            {...props}
          >
            <div className="skeleton-shimmer absolute inset-0" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-gray-100 dark:bg-white/[0.04] relative overflow-hidden',
        variantStyles[variant],
        className
      )}
      style={{ width, height }}
      {...props}
    >
      <div className="skeleton-shimmer absolute inset-0" />
    </div>
  );
}

function SkeletonCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-white/[0.03] border border-neutral-200 dark:border-white/[0.06] rounded-xl p-4',
        className
      )}
      {...props}
    >
      <Skeleton variant="text" height={20} width="60%" className="mb-4" />
      <Skeleton variant="text" lines={3} />
    </div>
  );
}

Skeleton.Card = SkeletonCard;
