import { useState } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, Check, ChevronRight, Plus, Minus, PenLine } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from '../common/Button';
import type { DriftEvent, DriftSeverity } from '../../store/driftStore';

interface DriftCardProps {
  event: DriftEvent;
  onAcknowledge?: (id: string) => void;
  onClick?: (event: DriftEvent) => void;
  className?: string;
}

const severityColors: Record<DriftSeverity, string> = {
  low: 'border-l-yellow-400',
  medium: 'border-l-orange-400',
  high: 'border-l-red-400',
  critical: 'border-l-red-600',
};

const severityBgColors: Record<DriftSeverity, string> = {
  low: 'bg-yellow-400/10 text-yellow-400',
  medium: 'bg-orange-400/10 text-orange-400',
  high: 'bg-red-400/10 text-red-400',
  critical: 'bg-red-600/10 text-red-500',
};

export function DriftCard({ event, onAcknowledge, onClick, className }: DriftCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const addedCount = event.changes.filter((c) => c.expected === undefined).length;
  const removedCount = event.changes.filter((c) => c.actual === undefined).length;
  const modifiedCount = event.changes.filter(
    (c) => c.expected !== undefined && c.actual !== undefined
  ).length;

  const handleAcknowledge = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAcknowledge?.(event.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      onClick={() => onClick?.(event)}
      className={cn(
        'bg-white/5 backdrop-blur-md border border-white/10 rounded-xl',
        'border-l-4 cursor-pointer transition-all duration-300',
        'hover:border-white/20 hover:shadow-lg hover:shadow-white/5',
        severityColors[event.severity],
        className
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={cn(
                  'px-2 py-0.5 text-xs font-medium rounded-md',
                  severityBgColors[event.severity]
                )}
              >
                {event.severity.toUpperCase()}
              </span>
              <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-white/10 text-white/80">
                {event.endpointName}
              </span>
            </div>
            <p className="text-sm text-white/70 mb-1 truncate">
              {event.message || `Detected drift on ${event.endpointName}`}
            </p>
            <p className="text-xs text-white/40">
              {formatDistanceToNow(new Date(event.detectedAt), { addSuffix: true })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!event.acknowledgedAt && onAcknowledge && (
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<PenLine className="w-3 h-3" />}
                onClick={handleAcknowledge}
              >
                Ack
              </Button>
            )}
            <ChevronRight className="w-4 h-4 text-white/40" />
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/10">
          <div className="flex items-center gap-1.5 text-xs text-green-400">
            <Plus className="w-3 h-3" />
            <span>{addedCount}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-red-400">
            <Minus className="w-3 h-3" />
            <span>{removedCount}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-yellow-400">
            <AlertTriangle className="w-3 h-3" />
            <span>{modifiedCount}</span>
          </div>
          {event.acknowledgedAt && (
            <div className="flex items-center gap-1.5 text-xs text-white/50 ml-auto">
              <Check className="w-3 h-3" />
              <span>Acknowledged</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}