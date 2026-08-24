import { type HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';

interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: SpinnerSize;
  text?: string;
}

const sizeStyles: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
  xl: 'w-10 h-10',
};

const textSizes: Record<SpinnerSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
};

export function Spinner({ size = 'md', text, className, ...props }: SpinnerProps) {
  return (
    <div className={cn('inline-flex items-center gap-2', className)} {...props}>
      <svg
        className={cn('animate-spin text-primary-500', sizeStyles[size])}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-20"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          className="opacity-80"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {text && (
        <span className={cn('text-neutral-500 dark:text-white/50', textSizes[size])}>{text}</span>
      )}
    </div>
  );
}
