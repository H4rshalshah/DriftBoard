import { useEffect, useCallback, type HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';
import { X } from 'lucide-react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  size?: ModalSize;
  className?: string;
  children?: React.ReactNode;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
}

const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.97, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0 },
};

export function Modal({
  isOpen,
  onClose,
  size = 'md',
  className,
  children,
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
}: ModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-5 sm:py-8">
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={backdropVariants}
            transition={{ duration: 0.15 }}
            className="modal-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeOnBackdrop ? onClose : undefined}
          />
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={modalVariants}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              'modal-surface relative flex max-h-[calc(100vh-2.5rem)] w-full flex-col overflow-hidden rounded-xl border border-white/[0.06] shadow-2xl backdrop-blur-xl sm:max-h-[calc(100vh-4rem)]',
              sizeStyles[size],
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {showCloseButton && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

interface ModalHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function ModalHeader({ className, children, ...props }: ModalHeaderProps) {
  return (
    <div className={cn('shrink-0 px-6 pt-6 pb-4 sm:px-8', className)} {...props}>
      {children}
    </div>
  );
}

interface ModalBodyProps extends HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function ModalBody({ className, children, ...props }: ModalBodyProps) {
  return (
    <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 pb-6 sm:px-8', className)} {...props}>
      {children}
    </div>
  );
}

interface ModalFooterProps extends HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function ModalFooter({ className, children, ...props }: ModalFooterProps) {
  return (
    <div
      className={cn('shrink-0 border-t border-white/[0.06] px-6 py-5 sm:px-8 flex justify-end gap-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}
