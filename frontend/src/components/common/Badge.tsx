import { type HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export type BadgeSeverity = 'low' | 'medium' | 'breaking';
export type BadgeStatus = 'active' | 'deprecated' | 'inactive';
export type BadgeVariant = 'severity' | 'status' | 'dot';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  severity?: BadgeSeverity;
  status?: BadgeStatus;
  showDot?: boolean;
}

const severityStyles: Record<BadgeSeverity, string> = {
  low: 'badge-severity-low bg-green-50 dark:bg-primary-500/12 text-green-700 dark:text-primary-400 border-green-200 dark:border-primary-500/20',
  medium: 'badge-severity-medium bg-amber-50 dark:bg-yellow-500/12 text-amber-700 dark:text-yellow-400 border-amber-200 dark:border-yellow-500/20',
  breaking: 'badge-severity-breaking bg-red-50 dark:bg-red-500/12 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20',
};

const statusStyles: Record<BadgeStatus, string> = {
  active: 'badge-status-active bg-green-50 dark:bg-primary-500/12 text-green-700 dark:text-primary-400 border-green-200 dark:border-primary-500/20',
  deprecated: 'badge-status-deprecated bg-orange-50 dark:bg-orange-500/12 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/20',
  inactive: 'badge-status-inactive bg-white dark:bg-white/8 text-neutral-500 dark:text-white/50 border-neutral-200 dark:border-white/10',
};

const dotColors: Record<BadgeSeverity | BadgeStatus, string> = {
  low: 'bg-primary-400',
  medium: 'bg-yellow-400',
  breaking: 'bg-red-400',
  active: 'bg-primary-400',
  deprecated: 'bg-orange-400',
  inactive: 'bg-white/30',
};

export function Badge({
  variant = 'severity',
  severity = 'low',
  status = 'active',
  showDot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  const getVariantClass = () => {
    if (variant === 'dot') return 'bg-transparent';
    return variant === 'severity' ? severityStyles[severity] : statusStyles[status];
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-full border',
        getVariantClass(),
        className
      )}
      {...props}
    >
      {showDot && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full', dotColors[variant === 'dot' ? severity : variant === 'severity' ? severity : status])}
        />
      )}
      {children}
    </span>
  );
}
