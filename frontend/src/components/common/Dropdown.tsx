import { useState, useRef, useEffect, type HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';
import { ChevronDown } from 'lucide-react';

export interface DropdownItem {
  label: string;
  value?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  divider?: boolean;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  className?: string;
  align?: 'start' | 'center' | 'end';
}

export function Dropdown({ trigger, items, className, align = 'end' }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, minWidth: 180 });
  const dropdownRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    const triggerRect = triggerRef.current?.getBoundingClientRect();
    if (!triggerRect) return;

    const minWidth = Math.max(180, triggerRect.width);
    const left =
      align === 'start'
        ? triggerRect.left
        : align === 'center'
        ? triggerRect.left + triggerRect.width / 2 - minWidth / 2
        : triggerRect.right - minWidth;

    setPosition({
      top: triggerRect.bottom + 8,
      left: Math.max(12, Math.min(left, window.innerWidth - minWidth - 12)),
      minWidth,
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, align]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <div className={cn('relative inline-block', className)} ref={triggerRef}>
      <div
        onClick={() => {
          updatePosition();
          setIsOpen((open) => !open);
        }}
      >
        {trigger}
      </div>
      {createPortal(
        <AnimatePresence>
          {isOpen && (
          <motion.ul
            ref={dropdownRef}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'fixed z-[9999] py-1 bg-[#0D0D0D]/95 backdrop-blur-xl border border-[#202020] rounded-lg shadow-2xl shadow-black/30'
            )}
            style={{
              top: position.top,
              left: position.left,
              minWidth: position.minWidth,
              transformOrigin: align === 'end' ? 'top right' : 'top left',
            }}
          >
            {items.map((item, index) =>
              item.divider ? (
                <li key={`divider-${index}`} className="my-1 border-t border-[#202020]" />
              ) : (
                <li key={item.value || index}>
                  <button
                    onClick={() => {
                      item.onClick?.();
                      setIsOpen(false);
                    }}
                    disabled={item.disabled}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors',
                      'focus:outline-none focus:bg-white/5',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {item.icon && <span className="w-4 h-4">{item.icon}</span>}
                    {item.label}
                  </button>
                </li>
              )
            )}
          </motion.ul>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

interface DropdownTriggerProps extends HTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  open?: boolean;
}

export function DropdownTrigger({
  children,
  open,
  className,
  ...props
}: DropdownTriggerProps) {
  return (
    <button
      className={cn(
        'inline-flex h-10 items-center gap-2 px-3 py-2 text-sm text-white/70 bg-white/5 border border-[#242424] rounded-lg',
        'hover:-translate-y-0.5 hover:bg-white/10 hover:border-[#2A2A2A] transition-all',
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown
        className={cn('w-4 h-4 transition-transform', open && 'rotate-180')}
      />
    </button>
  );
}
