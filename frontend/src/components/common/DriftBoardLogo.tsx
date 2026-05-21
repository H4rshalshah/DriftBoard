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
          'drift-logo-mark relative grid place-items-center overflow-hidden border border-indigo-300/25 shadow-lg shadow-indigo-500/25',
          compact ? 'h-8 w-8 rounded-lg' : 'h-9 w-9 rounded-xl'
        )}
      >
        <div className="drift-logo-gradient absolute inset-0 bg-[conic-gradient(from_180deg,#38bdf8,#8b5cf6,#22c55e,#38bdf8)] opacity-80" />
        <div className={cn('drift-logo-core absolute inset-[2px]', compact ? 'rounded-md' : 'rounded-[10px]')} />
        <ShieldCheck className={cn('relative text-indigo-200', compact ? 'h-4 w-4' : 'h-5 w-5')} />
      </div>
      {!compact && (
        <div className="leading-none">
          <span className="block text-lg font-bold tracking-normal text-white">DriftBoard</span>
          <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-indigo-200/70">
            Contract Radar
          </span>
        </div>
      )}
    </div>
  );
}
