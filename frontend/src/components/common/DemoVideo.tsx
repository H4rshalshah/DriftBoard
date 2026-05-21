import { motion } from 'framer-motion';
import { Activity, Bell, CheckCircle2, GitBranch, UserPlus, Users } from 'lucide-react';
import { DriftBoardLogo } from '@/components/common/DriftBoardLogo';

const demoRows = [
  { method: 'GET', path: '/api/v1/users', status: 'Healthy', color: 'text-sky-300' },
  { method: 'POST', path: '/api/v1/orders', status: 'Watching', color: 'text-emerald-300' },
  { method: 'PATCH', path: '/api/v1/profile', status: 'Drift found', color: 'text-orange-400' },
];

const teamMembers = [
  { initials: 'AN', label: 'API owner', color: 'from-cyan-300 to-indigo-400' },
  { initials: 'JS', label: 'Frontend', color: 'from-violet-300 to-fuchsia-400' },
  { initials: 'MK', label: 'QA lead', color: 'from-emerald-300 to-teal-400' },
];

const updateEvents = [
  { icon: GitBranch, text: 'Project connected', detail: 'Repository sync started' },
  { icon: Users, text: 'Team notified', detail: '3 members received update' },
  { icon: Bell, text: 'Alert delivered', detail: 'Breaking change assigned' },
];

const scrollContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.14, delayChildren: 0.08 },
  },
};

const scrollItemVariants = {
  hidden: { opacity: 0, y: 36, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.56, ease: 'easeOut' },
  },
};

export function DemoVideo() {
  return (
    <section id="demo" className="relative px-6 py-24">
      <motion.div
        variants={scrollContainerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: false, amount: 0.24 }}
        className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center"
      >
        <motion.div variants={scrollItemVariants}>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
            Live workflow
          </p>
          <h2 className="text-3xl font-bold text-white md:text-4xl">
            Connect people and notify the team as your project changes
          </h2>
          <p className="mt-4 max-w-xl text-white/60">
            DriftBoard turns every project update into a visible workflow: connect the source,
            invite collaborators, watch contracts, and send alerts when schema drift appears.
          </p>
        </motion.div>

        <motion.div
          variants={scrollItemVariants}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/75 shadow-2xl shadow-indigo-500/15 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-orange-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-300" />
            </div>
            <span className="text-sm text-white/50">driftboard-demo.web</span>
          </div>

          <div className="relative min-h-[360px] p-5">
            <motion.div
              className="absolute inset-x-5 top-5 rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-4"
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="flex items-center gap-3">
                <DriftBoardLogo compact />
                <div>
                  <p className="font-semibold text-white">Contract snapshot captured</p>
                  <p className="text-sm text-white/50">Express middleware extracted response schema v4</p>
                </div>
              </div>
            </motion.div>

            <div className="mt-28 grid gap-3">
              {demoRows.map((row, index) => (
                <motion.div
                  key={row.path}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: [0.55, 1, 0.55], x: 0 }}
                  transition={{ delay: index * 0.45, duration: 3, repeat: Infinity, repeatDelay: 1.2 }}
                  className="grid grid-cols-[72px_1fr_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <span className="rounded-md border border-white/10 px-2 py-1 text-xs font-bold text-white">
                    {row.method}
                  </span>
                  <span className="font-mono text-sm text-white/70">{row.path}</span>
                  <span className={row.color}>{row.status}</span>
                </motion.div>
              ))}
            </div>

            <motion.div
              className="mt-5 grid gap-3 rounded-xl border border-orange-400/25 bg-orange-500/10 p-4"
              animate={{ boxShadow: ['0 0 0 rgba(249,115,22,0)', '0 0 40px rgba(249,115,22,0.2)', '0 0 0 rgba(249,115,22,0)'] }}
              transition={{ duration: 3.2, repeat: Infinity }}
            >
              <div className="flex items-center gap-2 text-orange-400">
                <Activity className="h-4 w-4" />
                <span className="text-sm font-semibold">Breaking drift detected</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {['email optional', 'alert sent', 'key active'].map((item, index) => (
                  <div key={item} className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-xs text-white/70">
                    {index === 1 ? <Bell className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="border-t border-white/10 px-6 py-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <motion.div
                className="flex min-h-[168px] flex-col items-center justify-center rounded-xl border border-indigo-300/20 bg-indigo-500/10 px-5 py-6 text-center shadow-lg shadow-indigo-500/10"
                animate={{ y: [0, -4, 0], boxShadow: ['0 0 0 rgba(99,102,241,0)', '0 0 34px rgba(99,102,241,0.14)', '0 0 0 rgba(99,102,241,0)'] }}
                transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <motion.div
                  className="grid h-14 w-14 place-items-center rounded-full bg-indigo-500/25 text-indigo-100 ring-1 ring-indigo-300/25"
                  animate={{ scale: [1, 1.08, 1], boxShadow: ['0 0 0 rgba(99,102,241,0)', '0 0 28px rgba(99,102,241,0.28)', '0 0 0 rgba(99,102,241,0)'] }}
                  transition={{ duration: 2.8, repeat: Infinity }}
                >
                  <UserPlus className="h-6 w-6" />
                </motion.div>
                <p className="mt-4 text-base font-semibold leading-6 text-white">People connected</p>
                <p className="mt-2 max-w-[210px] text-sm leading-6 text-white/55">Project updates route to the right owners</p>
                <div className="mt-5 flex justify-center -space-x-2.5">
                  {teamMembers.map((member, index) => (
                    <motion.div
                      key={member.initials}
                      title={member.label}
                      className={`grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-gradient-to-br ${member.color} text-sm font-bold text-slate-950 shadow-lg shadow-black/20`}
                      animate={{ y: [0, index % 2 === 0 ? -3 : 3, 0], scale: [1, 1.04, 1] }}
                      transition={{ duration: 3 + index * 0.4, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      {member.initials}
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {updateEvents.map((event, index) => (
                <motion.div
                  key={event.text}
                  className="flex min-h-[168px] flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-6 text-center"
                  animate={{ opacity: [0.76, 1, 0.76], y: [0, -3, 0] }}
                  transition={{ delay: index * 0.35, duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-300/10">
                    <event.icon className="h-5 w-5" />
                  </span>
                  <p className="max-w-[130px] text-base font-semibold leading-6 text-white">{event.text}</p>
                  <p className="mt-3 max-w-[150px] text-sm leading-6 text-white/55">{event.detail}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
