import { motion } from 'framer-motion';
import { LucideIcon, FileX, Inbox, Search, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type EmptyStateVariant = 'default' | 'search' | 'error' | 'no-data';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: EmptyStateVariant;
  className?: string;
}

const variantIcons: Record<EmptyStateVariant, LucideIcon> = {
  default: Inbox,
  search: Search,
  error: AlertCircle,
  'no-data': FileX,
};

export default function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const Icon = icon || variantIcons[variant];

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.4,
        ease: 'easeOut',
      },
    },
  };

  const iconVariants = {
    hidden: { opacity: 0, scale: 0.5 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        delay: 0.1,
        duration: 0.4,
        type: 'spring',
        stiffness: 200,
        damping: 15,
      },
    },
  };

  const contentVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.2,
        duration: 0.3,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        'flex flex-col items-center justify-center py-16 px-4',
        'text-center',
        className
      )}
    >
      <motion.div
        variants={iconVariants}
        className={cn(
          'w-16 h-16 rounded-2xl flex items-center justify-center mb-4',
          variant === 'error'
            ? 'bg-red-500/20'
            : variant === 'search'
            ? 'bg-amber-500/20'
            : 'bg-primary-500/20'
        )}
      >
        <Icon
          className={cn(
            'w-8 h-8',
            variant === 'error'
              ? 'text-red-400'
              : variant === 'search'
              ? 'text-amber-400'
              : 'text-primary-400'
          )}
        />
      </motion.div>

      <motion.div variants={contentVariants}>
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        {description && (
          <p className="text-sm text-gray-400 max-w-md mb-6">{description}</p>
        )}

        {action && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={action.onClick}
            className={cn(
              'px-4 py-2 rounded-lg font-medium text-sm',
              'bg-gradient-primary text-white',
              'hover:shadow-glow-primary transition-all duration-300'
            )}
          >
            {action.label}
          </motion.button>
        )}
      </motion.div>
    </motion.div>
  );
}