import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Bell, GitBranch, Layout, ShieldCheck, Zap } from 'lucide-react';
import { AnimatedBackground } from '@/components/common/AnimatedBackground';
import { Button } from '@/components/common/Button';
import { DemoVideo } from '@/components/common/DemoVideo';
import { DriftBoardLogo } from '@/components/common/DriftBoardLogo';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { useAuthStore } from '@/store/authStore';

const features = [
  {
    icon: Zap,
    title: 'Real-time Detection',
    description: 'Catch renamed fields, deleted properties, and type changes the moment they ship.',
  },
  {
    icon: GitBranch,
    title: 'Schema Versioning',
    description: 'Compare every request and response contract with a clean timeline of snapshots.',
  },
  {
    icon: Layout,
    title: 'Console View',
    description: 'A focused dashboard for endpoints, drift events, schema history, and team alerts.',
  },
  {
    icon: Bell,
    title: 'Smart Alerts',
    description: 'Route breaking-change notifications to the people who can fix them fastest.',
  },
];

const consoleTabs = ['Home', 'Contracts', 'Drifts', 'API Keys'];

type ConsoleMetric = [label: string, value: string];

type ConsolePanel = {
  note: string;
  metrics: ConsoleMetric[];
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const scrollContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.06 },
  },
};

const scrollItemVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: 'easeOut' },
  },
};

export default function LandingPage() {
  const navigate = useNavigate();
  const [demoEmail, setDemoEmail] = useState('');
  const [activeConsoleTab, setActiveConsoleTab] = useState('Contracts');
  const consolePanels = useMemo<Record<string, ConsolePanel>>(() => {
    const randomRange = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

    return {
      Home: {
        note: 'Workspace summary refreshed from live request traces.',
        metrics: [
          ['Projects active', String(randomRange(3, 9))],
          ['Requests today', randomRange(8200, 18400).toLocaleString()],
          ['Team alerts', String(randomRange(12, 28))],
          ['Uptime', `${randomRange(98, 99)}.${randomRange(1, 9)}%`],
        ],
      },
      Contracts: {
        note: 'Schema snapshots grouped by endpoint and version.',
        metrics: [
          ['Endpoints watched', randomRange(950, 1690).toLocaleString()],
          ['Snapshots stored', randomRange(4200, 8800).toLocaleString()],
          ['Latest version', `v${randomRange(4, 12)}`],
          ['Schema health', `${randomRange(94, 98)}%`],
        ],
      },
      Drifts: {
        note: 'Breaking changes ranked by severity and owner.',
        metrics: [
          ['Breaking drifts', String(randomRange(3, 11)).padStart(2, '0')],
          ['Fields changed', String(randomRange(18, 47))],
          ['Alert latency', `${(1 + Math.random() * 1.4).toFixed(1)}s`],
          ['Resolved today', String(randomRange(5, 18))],
        ],
      },
      'API Keys': {
        note: 'Scoped keys with rotation status and last-used activity.',
        metrics: [
          ['Active keys', String(randomRange(4, 12))],
          ['Rotations due', String(randomRange(1, 4))],
          ['Last used', `${randomRange(1, 9)}m`],
          ['Scopes locked', String(randomRange(6, 14))],
        ],
      },
    };
  }, []);

  const activeConsolePanel = consolePanels[activeConsoleTab];

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const requestDemo = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = demoEmail.trim() ? `?email=${encodeURIComponent(demoEmail.trim())}` : '';
    navigate(`/register${query}`);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-black dark:bg-black text-neutral-900 dark:text-white">
      <AnimatedBackground intensity="hero" />

      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 sm:px-6 sm:py-5 lg:px-8">
        <Link to="/" aria-label="DriftBoard home">
          <DriftBoardLogo />
        </Link>
        <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-1 md:flex">
            {[
              ['Features', 'features'],
              ['Demo', 'demo'],
            ].map(([label, id]) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className="rounded-lg px-3 py-2 text-sm text-neutral-500 dark:text-white/45 transition-all hover:text-neutral-800 dark:text-white/80"
              >
                {label}
              </button>
            ))}
          </div>
          <ThemeToggle />
          <Link to="/login" className="hidden sm:block">
            <Button variant="ghost" size="sm">Log in</Button>
          </Link>
          <Link to="/register">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>
      </nav>

      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-18 pt-12 sm:px-6 sm:pb-20 sm:pt-16 md:pb-28 md:pt-28 lg:px-8">
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="mx-auto max-w-5xl text-center">
          <motion.div variants={itemVariants} className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-500/15 bg-primary-500/5 px-4 py-2 text-xs text-primary-300 sm:mb-8 sm:px-5 sm:text-sm">
            <ShieldCheck className="h-4 w-4 text-primary-400" />
            Live contract drift detection
          </motion.div>

          <motion.h1 variants={itemVariants} className="mx-auto max-w-6xl text-balance text-4xl font-bold leading-[1.08] tracking-tight text-neutral-900 dark:text-white sm:text-5xl md:text-6xl lg:text-7xl">
            API Drift Intelligence to Keep Frontend and Backend in Sync
          </motion.h1>

          <motion.p variants={itemVariants} className="mx-auto mt-6 max-w-3xl text-base leading-7 text-neutral-500 dark:text-white/45 sm:mt-8 md:text-lg md:leading-7">
            DriftBoard monitors Express APIs, stores schema snapshots, and streams live diffs before renamed fields break production.
          </motion.p>

          <motion.form
            variants={itemVariants}
            onSubmit={requestDemo}
            className="mx-auto mt-8 flex max-w-2xl flex-col gap-3 rounded-xl border border-neutral-200 dark:border-white/8 bg-white/[0.03] p-2 backdrop-blur-xl sm:mt-12 sm:flex-row sm:rounded-2xl"
          >
            <input
              type="email"
              placeholder="Enter your business email"
              value={demoEmail}
              onChange={(event) => setDemoEmail(event.target.value)}
              autoComplete="email"
              className="min-h-[52px] flex-1 rounded-xl bg-transparent px-5 text-neutral-800 dark:text-white/80 outline-none placeholder:text-neutral-400 dark:text-white/25"
            />
            <Button type="submit" fullWidth size="lg" className="sm:w-[200px]" rightIcon={<ArrowRight className="h-5 w-5" />}>
              Request demo
            </Button>
          </motion.form>

          <motion.div variants={itemVariants} className="mx-auto mt-6 max-w-2xl">
            <div className="relative flex items-center gap-4 text-sm">
              <div className="h-px flex-1 bg-white/8" />
              <span className="text-neutral-400 dark:text-white/25">Or continue with</span>
              <div className="h-px flex-1 bg-white/8" />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => useAuthStore.getState().startOAuthLogin('google')}
                leftIcon={
                  <svg className="w-5 h-5" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 0 0 0 24c0 3.77.87 7.35 2.56 10.61l7.97-6.02z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.02C6.51 42.62 14.62 48 24 48z"/>
                    <path fill="none" d="M0 0h48v48H0z"/>
                  </svg>
                }
              >
                Google
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => useAuthStore.getState().startOAuthLogin('github')}
                leftIcon={
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 .5C5.37.5 0 5.78 0 12.292c0 5.211 3.438 9.63 8.205 11.188.6.111.82-.254.82-.567 0-.28-.01-1.022-.015-2.005-3.338.711-4.042-1.582-4.042-1.582-.546-1.36-1.335-1.723-1.335-1.723-1.089-.73.083-.716.083-.716 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.417-1.305.762-1.604-2.665-.305-5.466-1.336-5.466-5.931 0-1.31.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.61 11.61 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.569.801.564 4.771-1.56 8.205-5.977 8.205-11.188C24 5.78 18.627.5 12 .5z"/>
                  </svg>
                }
              >
                GitHub
              </Button>
            </div>
          </motion.div>

        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 36 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.35 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="relative mx-auto mt-10 max-w-6xl overflow-hidden rounded-2xl border border-neutral-200 dark:border-white/[0.06] bg-black/50 p-4 backdrop-blur-xl sm:mt-12 sm:p-5 md:mt-16 md:rounded-3xl lg:p-6"
        >
          <div className="mb-5 flex flex-col gap-3 border-b border-neutral-200 dark:border-white/[0.06] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-300" />
              <span className="ml-4 text-sm font-semibold text-neutral-800 dark:text-white/80">DriftBoard Console</span>
            </div>
            <span className="text-sm text-neutral-400 dark:text-white/35">Live WebSocket feed</span>
          </div>

          <div className="grid gap-5 md:grid-cols-[240px_1fr] lg:gap-6">
            <div className="rounded-xl border border-neutral-200 dark:border-white/[0.06] bg-white/[0.02] p-3 md:rounded-2xl md:p-5">
              <div className="space-y-1">
              {consoleTabs.map((item) => (
                <motion.button
                  key={item}
                  type="button"
                  onClick={() => setActiveConsoleTab(item)}
                  className={`w-full rounded-lg px-4 py-3 text-center text-sm transition-all hover:text-neutral-800 dark:text-white/80 ${activeConsoleTab === item ? 'bg-primary-500/10 text-white' : 'text-neutral-500 dark:text-white/40 hover:bg-white/[0.03]'}`}
                  animate={activeConsoleTab === item ? { boxShadow: ['0 0 0 rgba(34,197,94,0)', '0 0 20px rgba(34,197,94,0.1)', '0 0 0 rgba(34,197,94,0)'] } : undefined}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  {item}
                </motion.button>
              ))}
              </div>
              <p className="mt-4 grid min-h-[72px] place-items-center rounded-xl border border-neutral-200 dark:border-white/[0.06] bg-white/[0.02] px-4 py-3 text-center text-xs leading-5 text-neutral-400 dark:text-white/35">
                {activeConsolePanel.note}
              </p>
            </div>
            <div className="grid gap-3 md:hidden">
              {activeConsolePanel.metrics.slice(0, 2).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 border-b border-neutral-200 dark:border-white/[0.06] py-3 last:border-b-0">
                  <span className="text-sm text-neutral-500 dark:text-white/40">{label}</span>
                  <span className="text-lg font-bold text-neutral-900 dark:text-white">{value}</span>
                </div>
              ))}
            </div>
            <motion.div
              key={activeConsoleTab}
              variants={scrollContainerVariants}
              initial={false}
              animate="visible"
              className="hidden gap-4 sm:grid-cols-2 md:grid lg:grid-cols-4 lg:gap-5"
            >
              {activeConsolePanel.metrics.map(([label, value], index) => (
                <motion.div
                  key={label}
                  variants={scrollItemVariants}
                  className="flex min-h-[220px] rounded-2xl border border-neutral-200 dark:border-white/[0.06] bg-white/[0.02] transition-all hover:-translate-y-1 hover:border-white/[0.1] lg:min-h-[260px]"
                >
                  <motion.div
                    className="flex min-h-[180px] w-full flex-1 flex-col items-center justify-center p-5 text-center"
                    animate={{ y: [0, index % 2 === 0 ? -4 : 4, 0] }}
                    transition={{ duration: 4 + index, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <p className="w-full text-center text-sm text-neutral-500 dark:text-white/40">{label}</p>
                    <p className="mt-4 w-full text-center text-3xl font-bold text-neutral-900 dark:text-white">{value}</p>
                  </motion.div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </section>

      <section id="features" className="relative z-10 px-5 py-16 sm:px-6 md:py-24 lg:px-8">
        <motion.div
          variants={scrollContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.2 }}
          className="mx-auto max-w-7xl"
        >
          <motion.div variants={scrollItemVariants} className="mb-12 max-w-2xl md:mb-14">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-primary-400">Platform</p>
            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white md:text-4xl">Key Features of DriftBoard</h2>
          </motion.div>
          <div className="grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                variants={scrollItemVariants}
                transition={{ delay: index * 0.06, duration: 0.45, ease: 'easeOut' }}
                className="rounded-xl border border-neutral-200 dark:border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-white/[0.1] md:rounded-2xl md:p-6"
              >
                <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-primary-500/10 text-primary-400">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-neutral-900 dark:text-white">{feature.title}</h3>
                <p className="mt-2.5 text-sm leading-6 text-neutral-500 dark:text-white/40">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      <DemoVideo />

      <footer className="relative z-10 border-t border-neutral-200 dark:border-white/[0.06] px-5 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.4 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row"
        >
          <DriftBoardLogo />
          <div className="flex flex-col items-center gap-3 text-sm text-neutral-400 dark:text-white/30 md:items-end">
            <div className="flex items-center gap-4">
              <Link to="/contact" className="transition-colors hover:text-neutral-600 dark:text-white/70">Contact</Link>
              <a href="mailto:h4rshal.workspace@gmail.com" className="transition-colors hover:text-neutral-600 dark:text-white/70">Support</a>
            </div>
            <p>Copyright 2026 DriftBoard. Built for API contract confidence.</p>
          </div>
        </motion.div>
      </footer>
    </div>
  );
}
