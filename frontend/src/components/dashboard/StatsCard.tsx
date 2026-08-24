import { motion } from 'framer-motion';
import { createElement, isValidElement } from 'react';
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { cn } from '../../utils/cn';

interface StatsCardProps {
  icon: React.ReactElement | LucideIcon;
  label?: string;
  title?: string;
  value: number | string;
  trend?: {
    direction?: 'up' | 'down';
    percentage?: number;
    value?: number;
    positive?: boolean;
  };
  sparklineData?: { value: number }[];
  loading?: boolean;
  severity?: 'success' | 'warning' | 'danger';
  className?: string;
}

export function StatsCard({
  icon,
  label,
  title,
  value,
  trend,
  sparklineData,
  loading = false,
  className,
}: StatsCardProps) {
  const renderedIcon = isValidElement(icon)
    ? icon
    : createElement(icon as LucideIcon, { className: 'w-5 h-5 text-white/60' });
  const trendDirection = trend?.direction ?? (trend?.positive === false ? 'down' : 'up');
  const trendValue = trend?.percentage ?? trend?.value;
  const trendIsPositive = trend?.positive ?? trendDirection === 'up';
  const displayLabel = label ?? title ?? '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-white dark:bg-[#0a0a0a] border border-neutral-200 dark:border-white/[0.06] rounded-xl p-4',
        'transition-all duration-200 hover:border-neutral-200 dark:border-white/[0.1]',
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg bg-white/[0.04]">{renderedIcon}</div>
        {trend && trendValue !== undefined && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              trendIsPositive ? 'text-primary-400' : 'text-red-400'
            )}
          >
            {trendDirection === 'up' ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span>{trendValue}%</span>
          </div>
        )}
      </div>

      <div className="mb-2">
        <span className="text-3xl font-bold text-white dark:text-white">
          {loading ? '...' : typeof value === 'number' ? value.toLocaleString() : value}
        </span>
      </div>

      <p className="text-sm text-white/40 mb-3">{displayLabel}</p>

      {sparklineData && sparklineData.length > 0 && (
        <div className="h-10 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData}>
              <defs>
                <linearGradient id={`sparkline-${displayLabel}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(34, 197, 94, 0.2)" />
                  <stop offset="100%" stopColor="rgba(34, 197, 94, 0)" />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="rgba(34, 197, 94, 0.4)"
                strokeWidth={1.5}
                fill={`url(#sparkline-${displayLabel})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}
