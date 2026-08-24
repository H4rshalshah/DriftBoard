import { motion } from 'framer-motion';
import { Wifi, WifiOff } from 'lucide-react';
import { cn } from '../../utils/cn';

interface LiveIndicatorProps {
  isConnected?: boolean;
  label?: string;
  className?: string;
}

export function LiveIndicator({ isConnected = false, label, className }: LiveIndicatorProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full',
        'bg-white dark:bg-white/[0.03] border border-white/[0.06]',
        className
      )}
    >
      {isConnected ? (
        <>
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
            className="relative"
          >
            <span className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-50" />
            <span className="relative w-2 h-2 bg-green-500 rounded-full shadow-[0_0_6px_rgba(34,197,94,0.4)]" />
          </motion.div>
          <span className="text-xs font-medium text-green-400 flex items-center gap-1">
            <Wifi className="w-3 h-3" />
            {label || 'Connected'}
          </span>
        </>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 0.5 }}
            className="w-2 h-2 bg-red-400 rounded-full"
          />
          <span className="text-xs font-medium text-red-400 flex items-center gap-1">
            <WifiOff className="w-3 h-3" />
            {label || 'Disconnected'}
          </span>
        </>
      )}
    </div>
  );
}
