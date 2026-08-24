import { useState, createContext, useContext, type HTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider');
  }
  return context;
}

interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
  onChange?: (value: string) => void;
}

export function Tabs({ defaultValue, children, className, onChange, ...props }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    onChange?.(value);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleTabChange }}>
      <div className={cn('', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

interface TabListProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function TabList({ children, className, ...props }: TabListProps) {
  return (
    <div
      className={cn(
        'flex gap-1 p-1 bg-white/[0.03] rounded-lg border border-white/[0.06]',
        className
      )}
      role="tablist"
      {...props}
    >
      {children}
    </div>
  );
}

interface TabProps extends HTMLAttributes<HTMLButtonElement> {
  value: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export function Tab({ value, children, className, disabled, ...props }: TabProps) {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => setActiveTab(value)}
      className={cn(
        'relative z-10 px-4 py-2 text-sm font-medium rounded-md transition-colors',
        'text-white/50 hover:text-white/80',
        isActive && 'text-white',
        disabled && 'opacity-40 cursor-not-allowed',
        className
      )}
      {...props}
    >
      {isActive && (
        <motion.div
          layoutId="tab-indicator"
          className="absolute inset-0 bg-white/[0.06] rounded-md"
          transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  );
}

interface TabPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onAnimationStart' | 'onDrag' | 'onDragEnd' | 'onDragStart'> {
  value: string;
  children: React.ReactNode;
}

export function TabPanel({ value, children, className, ...props }: TabPanelProps) {
  const { activeTab } = useTabsContext();

  if (activeTab !== value) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      role="tabpanel"
      className={cn('', className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
