import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  Github,
  Linkedin,
  Mail,
  MessageSquare,
  Send,
  Share2,
  Twitter,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { DriftBoardLogo } from '@/components/common/DriftBoardLogo';
import { Input } from '@/components/common/Input';
import { api, type ApiError } from '@/services/api';
import { useAuthStore } from '@/store';
import { cn } from '@/utils/cn';

type ContactSubject = 'sales' | 'support' | 'billing' | 'security' | 'feedback' | 'other';

type ContactForm = {
  name: string;
  email: string;
  subject: ContactSubject;
  message: string;
  website: string;
  startedAt: number;
};

type ContactResponse = {
  message: string;
  contactId: string;
  notificationStatus: 'sent' | 'not_configured' | 'failed';
};

const subjectOptions: Array<{ value: ContactSubject; label: string }> = [
  { value: 'support', label: 'Technical support' },
  { value: 'sales', label: 'Sales and demos' },
  { value: 'security', label: 'Security disclosure' },
  { value: 'feedback', label: 'Product feedback' },
  { value: 'other', label: 'Other' },
];



const socialLinks = [
  {
    label: 'GitHub',
    href: 'https://github.com/H4rshalshah',
    icon: Github,
    className: 'border-slate-300/25 text-slate-100 hover:border-slate-200/50 hover:bg-slate-200/10',
    iconClassName: 'text-white',
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/h4rshal/',
    icon: Linkedin,
    className: 'border-sky-400/25 text-sky-100 hover:border-sky-300/50 hover:bg-sky-500/10',
    iconClassName: 'text-sky-300',
  },
  {
    label: 'X',
    href: 'https://x.com/H4rshalshah',
    icon: Twitter,
    className: 'border-zinc-300/25 text-zinc-100 hover:border-zinc-200/50 hover:bg-zinc-200/10',
    iconClassName: 'text-zinc-100',
  },
  {
    label: 'Email',
    href: 'mailto:h4rshal.workspace@gmail.com',
    icon: Mail,
    className: 'border-rose-400/25 text-rose-100 hover:border-rose-300/50 hover:bg-rose-500/10',
    iconClassName: 'text-rose-300',
  },
];

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as ApiError).message || fallback);
  }
  return error instanceof Error ? error.message : fallback;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function ContactPage() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isAppRoute = location.pathname.startsWith('/app');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof ContactForm, string>>>({});
  const [form, setForm] = useState<ContactForm>({
    name: user?.name || '',
    email: user?.email || '',
    subject: 'support',
    message: '',
    website: '',
    startedAt: Date.now(),
  });

  useEffect(() => {
    if (!user) return;
    setForm((current) => ({
      ...current,
      name: current.name || user.name || '',
      email: current.email || user.email || '',
    }));
  }, [user]);

  const supportEmail = 'h4rshal.workspace@gmail.com';

  const validate = () => {
    const nextErrors: Partial<Record<keyof ContactForm, string>> = {};

    if (!form.name.trim()) nextErrors.name = 'Name is required.';
    if (!form.email.trim()) nextErrors.email = 'Email is required.';
    else if (!isValidEmail(form.email)) nextErrors.email = 'Enter a valid email address.';
    if (!form.message.trim()) nextErrors.message = 'Message is required.';
    else if (form.message.trim().length < 20) nextErrors.message = 'Message must be at least 20 characters.';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const updateField = <Key extends keyof ContactForm>(key: Key, value: ContactForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSubmittedMessage('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) {
      toast.error('Please fix the highlighted fields.');
      return;
    }

    const toastId = toast.loading('Sending your message...');
    setIsSubmitting(true);

    try {
      const response = await api.post<ContactResponse>('/contact', form);
      const delivered = response.notificationStatus === 'sent';
      const successMessage = delivered
        ? response.message || 'Message sent.'
        : response.notificationStatus === 'not_configured'
        ? 'Message saved, but email delivery is not configured on the server.'
        : 'Message saved, but email delivery failed. Check the server mail credentials.';
      if (delivered) {
        toast.success(successMessage, { id: toastId });
      } else {
        toast.error(successMessage, { id: toastId });
      }
      setSubmittedMessage(successMessage);
      setForm((current) => ({
        ...current,
        message: '',
        website: '',
        startedAt: Date.now(),
      }));
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not send message.'), { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const page = (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {!isAppRoute && (
            <Link to="/" className="mb-8 inline-flex">
              <DriftBoardLogo />
            </Link>
          )}
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600">Contact DriftBoard</p>
          <h1 className="text-3xl font-bold text-white sm:text-4xl">Talk to our team</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55 sm:text-base">
            Get help with API monitoring, team setup, billing, security reviews, or a DriftBoard rollout.
          </p>
        </div>
        <a
          href={`mailto:${supportEmail}`}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-red-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-black-800 transition-all hover:-translate-y-0.5 hover:border-cyan-300/45 hover:bg-cyan-400/15"
        >
          <Mail className="h-4 w-4" />
          {supportEmail}
        </a>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Card className="p-5 sm:p-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-cyan-300" />
              Send Message
            </CardTitle>
          </CardHeader>
          <CardContent>
            {submittedMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 flex items-start gap-3 rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-3 text-sm text-emerald-100"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
                <span>{submittedMessage}</span>
              </motion.div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                value={form.website}
                onChange={(event) => updateField('website', event.target.value)}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Name"
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  error={errors.name}
                  placeholder="Your name"
                  autoComplete="name"
                />
                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  error={errors.email}
                  placeholder="you@company.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="contact-subject" className="mb-1.5 block text-sm font-medium text-white/80">
                  Subject
                </label>
                <select
                  id="contact-subject"
                  value={form.subject}
                  onChange={(event) => updateField('subject', event.target.value as ContactSubject)}
                  className="min-h-[44px] w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none transition-all duration-200 focus:border-white/30 focus:ring-2 focus:ring-white/10"
                >
                  {subjectOptions.map((option) => (
                    <option key={option.value} value={option.value} className="bg-slate-950 text-white">
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="contact-message" className="mb-1.5 block text-sm font-medium text-white/80">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  value={form.message}
                  onChange={(event) => updateField('message', event.target.value)}
                  rows={8}
                  placeholder="Tell us what you need help with..."
                  className={cn(
                    'w-full resize-y rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-all duration-200',
                    'focus:border-white/30 focus:ring-2 focus:ring-white/10',
                    errors.message && 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20'
                  )}
                />
                {errors.message && <p className="mt-1.5 text-sm text-red-400">{errors.message}</p>}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-white/45">
                  Protected by rate limits and lightweight spam checks. We use your details only to respond.
                </p>
                <Button type="submit" size="lg" loading={isSubmitting} rightIcon={<Send className="h-4 w-4" />} className="min-h-[46px] sm:min-w-[170px]">
                  Send Message
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-5 w-5 text-cyan-300" />
                Support
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-white/55">
              <p>For active incidents or onboarding questions, email us directly and include your project name.</p>
              <a href={`mailto:${supportEmail}`} className="inline-flex items-center gap-2 font-medium text-cyan-200 transition-colors hover:text-cyan-100">
                {supportEmail}
                <ArrowRight className="h-4 w-4" />
              </a>
            </CardContent>
          </Card>

          

          <Card className="p-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Share2 className="h-5 w-5 text-emerald-300" />
                Connect
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-4">
                {socialLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        'inline-flex min-h-[40px] min-w-0 items-center justify-center gap-1.5 rounded-lg border bg-white/5 px-2.5 py-2 text-sm font-medium transition-all hover:-translate-y-0.5',
                        link.className
                      )}
                    >
                      <Icon className={cn('h-4 w-4 flex-shrink-0', link.iconClassName)} />
                      <span className="truncate">{link.label}</span>
                    </a>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  if (isAppRoute) return page;

  return (
    <div className="min-h-screen bg-gradient-dark px-4 py-6 sm:px-6 sm:py-10">
      {page}
    </div>
  );
}
