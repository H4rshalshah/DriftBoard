import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface Breadcrumb {
  label: string;
  path?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  breadcrumbs?: Breadcrumb[];
  className?: string;
}

export default function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  breadcrumbs,
  className,
}: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn('mb-6', className)}
    >
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-sm mb-3">
          {breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center gap-1.5">
              {index > 0 && <ChevronRight className="w-4 h-4 text-gray-600" />}
              {crumb.path ? (
                <Link
                  to={crumb.path}
                  className="text-gray-400 hover:text-white transition-colors duration-200"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-gray-500">{crumb.label}</span>
              )}
            </div>
          ))}
        </nav>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
              <Icon className="w-5 h-5 text-primary-400" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-white truncate">{title}</h1>
            {description && (
              <p className="text-sm text-gray-400 mt-1 line-clamp-2">{description}</p>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-3 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </motion.div>
  );
}