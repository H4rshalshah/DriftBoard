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
  text: 'rounded',
  card: 'rounded-xl',
  image: 'rounded-lg',
  avatar: 'rounded-full',
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
              'h-4 bg-white/[0.04] rounded relative overflow-hidden',
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
        'bg-white/[0.04] relative overflow-hidden',
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
        'bg-white/[0.03] border border-white/[0.06] rounded-xl p-4',
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
