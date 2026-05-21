import { useState, useRef, type HTMLAttributes } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'content'> {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: TooltipPosition;
  delay?: number;
}

const positionStyles: Record<TooltipPosition, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

const arrowPositionStyles: Record<TooltipPosition, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 border-t-white/20',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-white/20',
  left: 'left-full top-1/2 -translate-y-1/2 border-l-white/20',
  right: 'right-full top-1/2 -translate-y-1/2 border-r-white/20',
};

export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 300,
  className,
  ...props
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<number>();

  const handleMouseEnter = () => {
    timeoutRef.current = window.setTimeout(() => setIsVisible(true), delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.span
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute z-50 px-3 py-1.5 text-xs font-medium text-white bg-gray-800/95 backdrop-blur-sm rounded-lg border border-white/10 whitespace-nowrap',
              positionStyles[position],
              className
            )}
          >
            {content}
            <span
              className={cn(
                'absolute w-2 h-2 bg-gray-800/95 border-white/10 rotate-45',
                arrowPositionStyles[position]
              )}
            />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
