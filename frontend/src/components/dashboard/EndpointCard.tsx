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
  GET: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  POST: 'bg-green-500/20 text-green-400 border-green-500/30',
  PUT: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  PATCH: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export function EndpointCard({ endpoint, hasDrift = false, onClick, className }: EndpointCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      onClick={() => onClick?.(endpoint)}
      className={cn(
        'bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4',
        'cursor-pointer transition-all duration-300',
        'hover:border-white/20 hover:shadow-lg hover:shadow-white/5',
        hasDrift && 'border-orange-500/30',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={cn(
                'px-2 py-0.5 text-xs font-medium rounded-md border',
                methodColors[endpoint.method]
              )}
            >
              {endpoint.method}
            </span>
            <span className="text-xs text-white/40 flex items-center gap-1">
              <Code2 className="w-3 h-3" />
              v{endpoint.currentSchemaVersion}
            </span>
            {hasDrift && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-orange-500/20 text-orange-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Drift
              </span>
            )}
            {!hasDrift && endpoint.lastCheckedAt && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-green-500/20 text-green-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Clean
              </span>
            )}
          </div>
          <p className="text-sm text-white/90 font-mono truncate mb-1">{endpoint.url}</p>
          <p className="text-xs text-white/50 truncate">{endpoint.name}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10">
        {endpoint.lastCheckedAt && (
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <Clock className="w-3 h-3" />
            <span>
              Checked {formatDistanceToNow(new Date(endpoint.lastCheckedAt), { addSuffix: true })}
            </span>
          </div>
        )}
        {endpoint.lastDriftAt && (
          <div className="flex items-center gap-1.5 text-xs text-orange-400/80 ml-auto">
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