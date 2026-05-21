import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

interface AnimatedBackgroundProps {
  intensity?: 'hero' | 'app';
  className?: string;
}

export function AnimatedBackground({ intensity = 'app', className }: AnimatedBackgroundProps) {
  return (
    <div className={cn('pointer-events-none fixed inset-0 overflow-hidden', className)} aria-hidden="true">
      <div className="absolute inset-0 animated-grid" />
      <motion.div
        className={cn(
          'absolute left-1/2 top-[-18rem] h-[42rem] w-[42rem] -translate-x-1/2 rounded-full blur-3xl',
          intensity === 'hero' ? 'drift-orb-primary-hero' : 'drift-orb-primary'
        )}
        animate={{ x: [-80, 80, -80], y: [0, 70, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className={cn(
          'absolute bottom-[-18rem] left-[-10rem] h-[36rem] w-[36rem] rounded-full blur-3xl',
          intensity === 'hero' ? 'drift-orb-secondary-hero' : 'drift-orb-secondary'
        )}
        animate={{ x: [0, 90, 0], y: [30, -50, 30], scale: [1, 1.12, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="drift-orb-accent absolute bottom-[8%] right-[-8rem] h-[26rem] w-[26rem] rounded-full blur-3xl"
        animate={{ x: [40, -80, 40], y: [0, -60, 0], opacity: [0.45, 0.8, 0.45] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}
