import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Bell, GitBranch, Layout, ShieldCheck, Zap } from 'lucide-react';
import { AnimatedBackground } from '@/components/common/AnimatedBackground';
import { Button } from '@/components/common/Button';
import { DemoVideo } from '@/components/common/DemoVideo';
import { DriftBoardLogo } from '@/components/common/DriftBoardLogo';
import { ThemeToggle } from '@/components/common/ThemeToggle';

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
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const scrollContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.08 },
  },
};

const scrollItemVariants = {
  hidden: { opacity: 0, y: 34, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.52, ease: 'easeOut' },
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
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <AnimatedBackground intensity="hero" />

      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-5 sm:py-5">
        <Link to="/" aria-label="DriftBoard home">
          <DriftBoardLogo />
        </Link>
        <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 md:flex">
            {[
              ['Features', 'features'],
              ['Demo', 'demo'],
            ].map(([label, id]) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className="rounded-lg px-3 py-2 text-sm text-white/60 transition-all hover:-translate-y-0.5 hover:bg-white/10 hover:text-white"
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

      <section className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-5 md:pb-24 md:pt-24">
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="mx-auto max-w-5xl text-center">
          <motion.div variants={itemVariants} className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs text-indigo-100 shadow-inner sm:mb-8 sm:px-5 sm:text-sm">
            <ShieldCheck className="h-4 w-4 text-indigo-300" />
            Live contract drift detection
          </motion.div>

          <motion.h1 variants={itemVariants} className="text-balance text-4xl font-bold leading-[1.08] tracking-normal text-white sm:text-5xl md:text-7xl lg:text-8xl">
            API Drift Intelligence to Keep Frontend and Backend in Sync
          </motion.h1>

          <motion.p variants={itemVariants} className="mx-auto mt-6 max-w-3xl text-base leading-7 text-indigo-100/70 sm:mt-8 md:text-xl md:leading-8">
            DriftBoard monitors Express APIs, stores schema snapshots, and streams beautiful live diffs before renamed fields break production.
          </motion.p>

          <motion.form
            variants={itemVariants}
            onSubmit={requestDemo}
            className="mx-auto mt-8 flex max-w-2xl flex-col gap-3 rounded-xl border border-white/10 bg-white/10 p-2 shadow-2xl shadow-indigo-500/10 backdrop-blur-xl sm:mt-12 sm:flex-row sm:rounded-2xl"
          >
            <input
              type="email"
              placeholder="Enter your business email"
              value={demoEmail}
              onChange={(event) => setDemoEmail(event.target.value)}
              autoComplete="email"
              className="min-h-[56px] flex-1 rounded-xl bg-transparent px-5 text-white outline-none placeholder:text-white/40"
            />
            <Button type="submit" fullWidth size="lg" className="sm:w-[210px]" rightIcon={<ArrowRight className="h-5 w-5" />}>
              Request demo
            </Button>
          </motion.form>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 44 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.35 }}
          transition={{ duration: 0.64, ease: 'easeOut' }}
          className="relative mx-auto mt-12 max-w-6xl overflow-hidden rounded-2xl border border-indigo-300/25 bg-slate-950/70 p-4 shadow-2xl shadow-indigo-500/15 backdrop-blur-xl md:mt-20 md:rounded-3xl md:p-5"
        >
          <div className="mb-5 flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-300" />
              <span className="ml-4 text-sm font-semibold text-white">DriftBoard Console</span>
            </div>
            <span className="text-sm text-indigo-100/70">Live WebSocket feed</span>
          </div>

          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 md:rounded-2xl md:p-4">
              <div className="space-y-2">
              {consoleTabs.map((item) => (
                <motion.button
                  key={item}
                  type="button"
                  onClick={() => setActiveConsoleTab(item)}
                  className={`w-full rounded-xl px-4 py-3 text-center text-sm transition-all hover:translate-x-1 hover:bg-white/10 hover:text-white ${activeConsoleTab === item ? 'bg-indigo-500/20 text-white' : 'text-white/50'}`}
                  animate={activeConsoleTab === item ? { boxShadow: ['0 0 0 rgba(99,102,241,0)', '0 0 28px rgba(99,102,241,0.22)', '0 0 0 rgba(99,102,241,0)'] } : undefined}
                  transition={{ duration: 2.8, repeat: Infinity }}
                >
                  {item}
                </motion.button>
              ))}
              </div>
              <p className="mt-4 grid min-h-[76px] place-items-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xs leading-5 text-indigo-100/65">
                {activeConsolePanel.note}
              </p>
            </div>
            <div className="grid gap-3 md:hidden">
              {activeConsolePanel.metrics.slice(0, 2).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 border-b border-white/10 py-3 last:border-b-0">
                  <span className="text-sm text-indigo-100/65">{label}</span>
                  <span className="text-lg font-bold text-white">{value}</span>
                </div>
              ))}
            </div>
            <motion.div
              key={activeConsoleTab}
              variants={scrollContainerVariants}
              initial={false}
              animate="visible"
              className="hidden gap-4 sm:grid-cols-2 md:grid lg:grid-cols-4"
            >
              {activeConsolePanel.metrics.map(([label, value], index) => (
                <motion.div
                  key={label}
                  variants={scrollItemVariants}
                  className="flex min-h-[220px] rounded-2xl border border-white/10 bg-white/5 transition-all hover:-translate-y-1 hover:border-indigo-400/30 hover:bg-white/10 lg:min-h-[260px]"
                >
                  <motion.div
                    className="flex min-h-[180px] w-full flex-1 flex-col items-center justify-center p-5 text-center"
                    animate={{ y: [0, index % 2 === 0 ? -5 : 5, 0] }}
                    transition={{ duration: 4 + index, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <p className="w-full text-center text-sm text-indigo-100/65">{label}</p>
                    <p className="mt-4 w-full text-center text-3xl font-bold text-white">{value}</p>
                  </motion.div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </section>

      <section id="features" className="relative z-10 px-4 py-14 sm:px-5 md:py-20">
        <motion.div
          variants={scrollContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.2 }}
          className="mx-auto max-w-7xl"
        >
          <motion.div variants={scrollItemVariants} className="mb-12 max-w-2xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">Platform</p>
            <h2 className="text-3xl font-bold text-white md:text-4xl">Key Features of DriftBoard</h2>
          </motion.div>
          <div className="grid gap-3 md:grid-cols-2 md:gap-5 lg:grid-cols-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                variants={scrollItemVariants}
                transition={{ delay: index * 0.08, duration: 0.52, ease: 'easeOut' }}
                className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-indigo-400/30 hover:bg-white/10 hover:shadow-lg hover:shadow-indigo-500/10 md:rounded-2xl md:p-6"
              >
                <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-indigo-500/15 text-indigo-200">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/50">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      <DemoVideo />

      <footer className="relative z-10 border-t border-white/10 px-5 py-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.4 }}
          transition={{ duration: 0.44, ease: 'easeOut' }}
          className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row"
        >
          <DriftBoardLogo />
          <div className="flex flex-col items-center gap-3 text-sm text-white/40 md:items-end">
            <div className="flex items-center gap-4">
              <Link to="/contact" className="transition-colors hover:text-white">Contact</Link>
              <a href="mailto:h4rshal.workspace@gmail.com" className="transition-colors hover:text-white">Support</a>
            </div>
            <p>Copyright 2026 DriftBoard. Built for API contract confidence.</p>
          </div>
        </motion.div>
      </footer>
    </div>
  );
}
