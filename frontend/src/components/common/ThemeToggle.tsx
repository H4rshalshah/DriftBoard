import { motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useUIStore } from '@/store';
import { cn } from '../../utils/cn';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useUIStore();
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <button
      type="button"
      aria-label="Toggle color theme"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        'theme-toggle relative inline-flex h-9 w-[68px] items-center rounded-full border p-1 transition-colors',
        isDark ? 'justify-start' : 'justify-end',
        className
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="grid h-7 w-7 place-items-center rounded-full bg-white text-black shadow-lg shadow-black/10"
      >
        {isDark ? <Moon className="h-4 w-4 text-primary-500" /> : <Sun className="h-4 w-4 text-amber-500" />}
      </motion.span>
    </button>
  );
}
