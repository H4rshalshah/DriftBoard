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
        'bg-white/5 border border-white/10 backdrop-blur-md',
        className
      )}
    >
      {isConnected ? (
        <>
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="relative"
          >
            <span className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-75" />
            <span className="relative w-2 h-2 bg-green-400 rounded-full" />
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
