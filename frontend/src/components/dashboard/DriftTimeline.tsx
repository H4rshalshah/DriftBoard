import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from '../common/Button';
import type { DriftEvent, DriftSeverity } from '../../store/driftStore';

interface DriftTimelineProps {
  events: DriftEvent[];
  onEventClick?: (event: DriftEvent) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  className?: string;
}

const severityDotColors: Record<DriftSeverity, string> = {
  low: 'bg-yellow-400',
  medium: 'bg-orange-400',
  high: 'bg-red-400',
  critical: 'bg-red-600',
};

interface GroupedEvents {
  [date: string]: DriftEvent[];
}

function groupEventsByDate(events: DriftEvent[]): GroupedEvents {
  return events.reduce((acc, event) => {
    const date = format(parseISO(event.detectedAt), 'yyyy-MM-dd');
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(event);
    return acc;
  }, {} as GroupedEvents);
}

function formatDateLabel(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d, yyyy');
}

export function DriftTimeline({
  events,
  onEventClick,
  onLoadMore,
  hasMore = false,
  className,
}: DriftTimelineProps) {
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set(Object.keys(groupEventsByDate(events))));
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const groupedEvents = groupEventsByDate(events);
  const sortedDates = Object.keys(groupedEvents).sort((a, b) => b.localeCompare(a));

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const toggleEvent = (eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  if (events.length === 0) {
    return (
      <div className={cn('text-center py-8 text-white/40', className)}>
        No drift events to display
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {sortedDates.map((date) => {
        const dateEvents = groupedEvents[date];
        const isExpanded = expandedDates.has(date);

        return (
          <div key={date}>
            <button
              onClick={() => toggleDate(date)}
              className="flex items-center gap-2 w-full text-left py-2"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-white/40" />
              ) : (
                <ChevronRight className="w-4 h-4 text-white/40" />
              )}
              <span className="text-sm font-medium text-white/80">
                {formatDateLabel(date)}
              </span>
              <span className="text-xs text-white/40">({dateEvents.length})</span>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="relative ml-4 pl-6 border-l border-white/10"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-white/20 to-transparent" />

                  {dateEvents.map((event) => {
                    const isEventExpanded = expandedEvents.has(event.id);

                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="relative py-3"
                      >
                        <div
                          className={cn(
                            'absolute left-[-21px] top-4 w-2.5 h-2.5 rounded-full',
                            severityDotColors[event.severity]
                          )}
                        />

                        <div
                          onClick={() => toggleEvent(event.id)}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-white/40">
                              {format(parseISO(event.detectedAt), 'HH:mm')}
                            </span>
                            <span className="text-sm text-white/70 truncate">
                              {event.endpointName}
                            </span>
                            <span
                              className={cn(
                                'px-1.5 py-0.5 text-[10px] rounded',
                                event.severity === 'critical' && 'bg-red-600/20 text-red-500',
                                event.severity === 'high' && 'bg-red-400/20 text-red-400',
                                event.severity === 'medium' && 'bg-orange-400/20 text-orange-400',
                                event.severity === 'low' && 'bg-yellow-400/20 text-yellow-400'
                              )}
                            >
                              {event.severity}
                            </span>
                          </div>

                          <AnimatePresence>
                            {isEventExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mt-2 p-3 bg-white/5 rounded-lg"
                              >
                                <p className="text-xs text-white/60 mb-2">
                                  {event.message || `${event.changes.length} changes detected`}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {event.changes.slice(0, 3).map((change, idx) => (
                                    <span
                                      key={idx}
                                      className="text-xs px-2 py-1 bg-white/10 rounded text-white/70"
                                    >
                                      {change.path}
                                    </span>
                                  ))}
                                  {event.changes.length > 3 && (
                                    <span className="text-xs text-white/40">
                                      +{event.changes.length - 3} more
                                    </span>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {hasMore && onLoadMore && (
        <div className="flex justify-center pt-4">
          <Button variant="secondary" size="sm" onClick={onLoadMore}>
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}