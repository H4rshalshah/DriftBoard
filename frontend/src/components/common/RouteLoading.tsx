import { motion } from 'framer-motion';

interface RouteLoadingProps {
  message?: string;
}

export function RouteLoading({ message = 'Loading...' }: RouteLoadingProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="relative mb-6">
        {/* Outer ring */}
        <div className="h-16 w-16 animate-[spin_2s_linear_infinite] rounded-full border-[3px] border-white/10 border-t-primary-500" />
        {/* Inner ring */}
        <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 animate-[spin_1.5s_linear_infinite_reverse] rounded-full border-[2px] border-transparent border-b-primary-400" />
        {/* Core dot */}
        <motion.div
          className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-500"
          animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <motion.p
        className="text-sm text-white/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {message}
      </motion.p>
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="space-y-4 p-6">
      <div className="h-8 w-3/4 animate-pulse rounded-lg bg-white/5" />
      <div className="h-4 w-1/2 animate-pulse rounded-lg bg-white/5" />
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-xl bg-white/5"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
      <div className="mt-4 h-64 animate-pulse rounded-xl bg-white/5" />
    </div>
  );
}
