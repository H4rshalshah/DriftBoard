import { motion } from 'framer-motion';
import { Activity, Bell, CheckCircle2, GitBranch, UserPlus, Users } from 'lucide-react';
import { DriftBoardLogo } from '@/components/common/DriftBoardLogo';

const demoRows = [
  { method: 'GET', path: '/api/v1/users', status: 'Healthy', color: 'text-sky-300' },
  { method: 'POST', path: '/api/v1/orders', status: 'Watching', color: 'text-emerald-300' },
  { method: 'PATCH', path: '/api/v1/profile', status: 'Drift found', color: 'text-orange-400' },
];

const teamMembers = [
  { initials: 'AN', label: 'API owner', color: 'from-cyan-300 to-primary-400' },
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

function Workflow3DSignal() {
  return (
    <div className="relative mx-auto my-8 h-[250px] w-full max-w-[420px] overflow-hidden [perspective:760px] sm:mb-8 sm:mt-8 sm:h-[240px] sm:max-w-[520px] sm:[perspective:900px] lg:mx-0" aria-hidden="true">
      <svg
        className="absolute inset-0 z-[2] h-full w-full overflow-visible opacity-55 sm:opacity-100"
        viewBox="0 0 520 240"
        preserveAspectRatio="none"
      >
        <line className="tech-signal-line" x1="132" y1="80" x2="226" y2="102" />
        <line className="tech-signal-line" x1="386" y1="88" x2="304" y2="104" />
        <line className="tech-signal-line tech-signal-line-alert" x1="182" y1="198" x2="244" y2="156" />
      </svg>

      <div className="absolute left-1/2 top-[68%] z-[1] h-36 w-36 rounded-[24px] border border-primary-400/30 bg-primary-400/10 shadow-[0_28px_72px_rgba(34,197,94,0.24)] [transform:translate(-50%,-50%)_rotateX(64deg)_rotateZ(-38deg)] dark:border-primary-300/34 dark:bg-primary-300/12 dark:shadow-[0_30px_82px_rgba(34,197,94,0.28)] sm:h-40 sm:w-40 sm:rounded-[26px] sm:shadow-[0_34px_80px_rgba(34,197,94,0.22)] sm:dark:shadow-[0_34px_88px_rgba(34,197,94,0.24)]" />

      <div className="tech-contract-cube absolute left-1/2 top-[42%] z-[4] h-24 w-24 [--cube-depth:46px] sm:h-24 sm:w-24 sm:[--cube-depth:46px]">
        <span className="tech-contract-face tech-contract-face-front" />
        <span className="tech-contract-face tech-contract-face-back" />
        <span className="tech-contract-face tech-contract-face-right" />
        <span className="tech-contract-face tech-contract-face-left" />
        <span className="tech-contract-face tech-contract-face-top" />
        <span className="tech-contract-face tech-contract-face-bottom" />
      </div>

      <div className="tech-data-chip left-0 top-8 z-[5] scale-75 sm:left-4 sm:top-12 sm:scale-100">schema:v4</div>
      <div className="tech-data-chip right-0 top-14 z-[5] scale-75 animation-delay-200 sm:right-5 sm:top-16 sm:scale-100">drift:live</div>
      <div className="tech-data-chip left-10 top-[190px] z-[5] scale-75 animation-delay-500 sm:left-16 sm:top-[178px] sm:scale-100">alert:sent</div>
    </div>
  );
}

export function DemoVideo() {
  return (
    <section id="demo" className="relative px-4 py-14 sm:px-6 md:py-24">
      <motion.div
        variants={scrollContainerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: false, amount: 0.24 }}
        className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-10"
      >
        <motion.div variants={scrollItemVariants}>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary-300">
            Live workflow
          </p>
          <h2 className="text-2xl font-bold text-white sm:text-3xl md:text-4xl">
            Connect people and notify the team as your project changes
          </h2>
          <Workflow3DSignal />
          <p className="mt-4 max-w-xl text-sm leading-6 text-white/60 sm:text-base">
            DriftBoard turns every project update into a visible workflow: connect the source,
            invite collaborators, watch contracts, and send alerts when schema drift appears.
          </p>
        </motion.div>

        <motion.div
          variants={scrollItemVariants}
          className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-950/75 shadow-xl shadow-primary-500/10 backdrop-blur-xl md:rounded-2xl md:shadow-2xl md:shadow-primary-500/10"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 md:px-5">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-orange-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-300" />
            </div>
            <span className="hidden text-sm text-white/50 sm:inline">driftboard-demo.web</span>
          </div>

          <div className="p-4 md:p-5">
            <motion.div
              className="rounded-lg border border-primary-400/20 bg-primary-500/10 p-3 md:rounded-xl md:p-4"
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="flex items-center gap-3">
                <DriftBoardLogo compact />
                <div>
                  <p className="text-sm font-semibold text-white sm:text-base">Contract snapshot captured</p>
                  <p className="text-xs text-white/50 sm:text-sm">Express middleware extracted response schema v4</p>
                </div>
              </div>
            </motion.div>

            <div className="mt-6 grid gap-3 md:mt-7">
              {demoRows.map((row, index) => (
                <motion.div
                  key={row.path}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: [0.55, 1, 0.55], x: 0 }}
                  transition={{ delay: index * 0.45, duration: 3, repeat: Infinity, repeatDelay: 1.2 }}
                  className="grid grid-cols-[58px_1fr] items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-3 sm:grid-cols-[72px_1fr_auto] sm:gap-3 sm:rounded-xl sm:px-4"
                >
                  <span className="rounded-md border border-white/10 px-2 py-1 text-xs font-bold text-white">
                    {row.method}
                  </span>
                  <span className="font-mono text-sm text-white/70">{row.path}</span>
                  <span className={`${row.color} col-span-2 text-sm sm:col-span-1 sm:text-base`}>{row.status}</span>
                </motion.div>
              ))}
            </div>

            <motion.div
              className="mt-5 grid gap-3 rounded-lg border border-orange-400/25 bg-orange-500/10 p-3 md:rounded-xl md:p-4"
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

          <div className="border-t border-white/10 px-4 py-4 md:px-6 md:py-6">
            <div className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
              <motion.div
                className="flex min-h-[132px] flex-col items-center justify-center rounded-lg border border-primary-300/20 bg-primary-500/10 px-4 py-4 text-center shadow-lg shadow-primary-500/10 md:min-h-[168px] md:rounded-xl md:px-5 md:py-6"
                animate={{ y: [0, -4, 0], boxShadow: ['0 0 0 rgba(34,197,94,0)', '0 0 34px rgba(34,197,94,0.14)', '0 0 0 rgba(34,197,94,0)'] }}
                transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <motion.div
                  className="grid h-14 w-14 place-items-center rounded-full bg-primary-500/25 text-primary-100 ring-1 ring-primary-300/25"
                  animate={{ scale: [1, 1.08, 1], boxShadow: ['0 0 0 rgba(34,197,94,0)', '0 0 28px rgba(34,197,94,0.28)', '0 0 0 rgba(34,197,94,0)'] }}
                  transition={{ duration: 2.8, repeat: Infinity }}
                >
                  <UserPlus className="h-6 w-6" />
                </motion.div>
                <p className="mt-3 text-base font-semibold leading-6 text-white md:mt-4">People connected</p>
                <p className="mt-2 max-w-[210px] text-sm leading-6 text-white/55">Project updates route to the right owners</p>
                <div className="mt-4 flex justify-center -space-x-2.5 md:mt-5">
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
                  className="flex min-h-[116px] flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 py-4 text-center md:min-h-[168px] md:rounded-xl md:px-5 md:py-6"
                  animate={{ opacity: [0.76, 1, 0.76], y: [0, -3, 0] }}
                  transition={{ delay: index * 0.35, duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <span className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-300/10 md:mb-4 md:h-12 md:w-12">
                    <event.icon className="h-5 w-5" />
                  </span>
                  <p className="max-w-[150px] text-sm font-semibold leading-5 text-white md:max-w-[130px] md:text-base md:leading-6">{event.text}</p>
                  <p className="mt-2 max-w-[180px] text-xs leading-5 text-white/55 md:mt-3 md:max-w-[150px] md:text-sm md:leading-6">{event.detail}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
