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
          'absolute left-1/2 top-[-16rem] h-[38rem] w-[38rem] -translate-x-1/2 rounded-full blur-3xl',
          intensity === 'hero' ? 'drift-orb-primary-hero' : 'drift-orb-primary'
        )}
        animate={{ x: [-60, 60, -60], y: [0, 50, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className={cn(
          'absolute bottom-[-16rem] left-[-8rem] h-[32rem] w-[32rem] rounded-full blur-3xl',
          intensity === 'hero' ? 'drift-orb-secondary-hero' : 'drift-orb-secondary'
        )}
        animate={{ x: [0, 70, 0], y: [20, -40, 20], scale: [1, 1.08, 1] }}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="drift-orb-accent absolute bottom-[8%] right-[-6rem] h-[24rem] w-[24rem] rounded-full blur-3xl"
        animate={{ x: [30, -60, 30], y: [0, -40, 0], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}
