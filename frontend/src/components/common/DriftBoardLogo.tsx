import { ShieldCheck } from 'lucide-react';
import { cn } from '../../utils/cn';

interface DriftBoardLogoProps {
  compact?: boolean;
  className?: string;
}

export function DriftBoardLogo({ compact = false, className }: DriftBoardLogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        className={cn(
          'drift-logo-mark relative grid place-items-center overflow-hidden border border-primary-500/20',
          compact ? 'h-8 w-8 rounded-lg' : 'h-9 w-9 rounded-xl'
        )}
      >
        <div className="drift-logo-gradient absolute inset-0 bg-gradient-to-br from-primary-500/80 to-primary-700/60 opacity-70" />
        <div className={cn('drift-logo-core absolute inset-[2px]', compact ? 'rounded-md' : 'rounded-[10px]')} />
        <ShieldCheck className={cn('relative text-primary-200', compact ? 'h-4 w-4' : 'h-5 w-5')} />
      </div>
      {!compact && (
        <div className="leading-none">
          <span className="block text-lg font-bold tracking-tight text-white">DriftBoard</span>
          <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-white/30">
            Contract Radar
          </span>
        </div>
      )}
    </div>
  );
}
