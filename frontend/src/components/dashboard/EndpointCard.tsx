import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, CheckCircle, Clock, Code2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { Endpoint } from '../../store/endpointStore';

interface EndpointCardProps {
  endpoint: Endpoint;
  hasDrift?: boolean;
  onClick?: (endpoint: Endpoint) => void;
  className?: string;
}

const methodColors: Record<Endpoint['method'], string> = {
  GET: 'bg-primary-500/12 text-primary-400 border-primary-500/20',
  POST: 'bg-primary-500/10 text-primary-300 border-primary-500/15',
  PUT: 'bg-orange-500/12 text-orange-400 border-orange-500/20',
  PATCH: 'bg-yellow-500/12 text-yellow-400 border-yellow-500/20',
  DELETE: 'bg-red-500/12 text-red-400 border-red-500/20',
};

export function EndpointCard({ endpoint, hasDrift = false, onClick, className }: EndpointCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.005 }}
      onClick={() => onClick?.(endpoint)}
      className={cn(
        'bg-white dark:bg-[#0a0a0a] border border-neutral-200 dark:border-white/[0.06] rounded-xl p-4',
        'cursor-pointer transition-all duration-200',
        'hover:border-neutral-200 dark:border-white/[0.1]',
        hasDrift && 'border-orange-500/20',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={cn(
                'px-2 py-0.5 text-[11px] font-medium rounded-md border',
                methodColors[endpoint.method]
              )}
            >
              {endpoint.method}
            </span>
            <span className="text-[11px] text-white/30 flex items-center gap-1">
              <Code2 className="w-3 h-3" />
              v{endpoint.currentSchemaVersion}
            </span>
            {hasDrift && (
              <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-orange-500/12 text-orange-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Drift
              </span>
            )}
            {!hasDrift && endpoint.lastCheckedAt && (
              <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-primary-500/12 text-primary-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Clean
              </span>
            )}
          </div>
          <p className="text-sm text-white/80 font-mono truncate mb-1">{endpoint.url}</p>
          <p className="text-xs text-white/40 truncate">{endpoint.name}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-neutral-200 dark:border-white/[0.06]">
        {endpoint.lastCheckedAt && (
          <div className="flex items-center gap-1.5 text-xs text-white/30">
            <Clock className="w-3 h-3" />
            <span>
              Checked {formatDistanceToNow(new Date(endpoint.lastCheckedAt), { addSuffix: true })}
            </span>
          </div>
        )}
        {endpoint.lastDriftAt && (
          <div className="flex items-center gap-1.5 text-xs text-orange-400/70 ml-auto">
            <AlertTriangle className="w-3 h-3" />
            <span>
              Last drift {formatDistanceToNow(new Date(endpoint.lastDriftAt), { addSuffix: true })}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
