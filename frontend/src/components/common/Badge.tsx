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
  low: 'badge-severity-low bg-blue-500/20 text-blue-300 border-blue-500/30',
  medium: 'badge-severity-medium bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  breaking: 'badge-severity-breaking bg-red-500/20 text-red-300 border-red-500/30',
};

const statusStyles: Record<BadgeStatus, string> = {
  active: 'badge-status-active bg-green-500/20 text-green-300 border-green-500/30',
  deprecated: 'badge-status-deprecated bg-orange-500/20 text-orange-300 border-orange-500/30',
  inactive: 'badge-status-inactive bg-gray-500/20 text-gray-300 border-gray-500/30',
};

const dotColors: Record<BadgeSeverity | BadgeStatus, string> = {
  low: 'bg-blue-400',
  medium: 'bg-yellow-400',
  breaking: 'bg-red-400',
  active: 'bg-green-400',
  deprecated: 'bg-orange-400',
  inactive: 'bg-gray-400',
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
        'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border',
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
