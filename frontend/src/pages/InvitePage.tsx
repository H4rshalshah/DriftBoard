import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { KeyRound, Link2 } from 'lucide-react';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { DriftBoardLogo } from '@/components/common/DriftBoardLogo';

interface InviteDetails {
  projectName?: string;
  teamName?: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  accountStatus: 'existing' | 'new';
  expiresAt: string;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;

  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message || fallback);
  }

  return fallback;
}

export default function InvitePage() {
  const { token = '' } = useParams();
  const [searchParams] = useSearchParams();
  const inviteToken = token || searchParams.get('token') || '';

  const navigate = useNavigate();
  const { acceptInvite, forgotPassword, isLoading } = useAuthStore();

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [invitePassword, setInvitePassword] = useState('');
  const [accountMode, setAccountMode] = useState<'existing' | 'new' | null>(null);

  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  const [isLoadingInvite, setIsLoadingInvite] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!inviteToken) {
      setError('Invite token missing.');
      setIsLoadingInvite(false);
      return;
    }

    setIsLoadingInvite(true);
    setError('');

    api
      .get<InviteDetails>(`/team/invite/${inviteToken}`)
      .then((details) => {
        const expired = new Date(details.expiresAt).getTime() < Date.now();

        if (expired) {
          setError('This invite link has expired.');
          return;
        }

        setInvite(details);
        setAccountMode(details.accountStatus);
        setAccountEmail(details.email);
        setUsername(details.email.split('@')[0] || '');
      })
      .catch((requestError) => {
        setError(getErrorMessage(requestError, 'Invite not found or expired.'));
      })
      .finally(() => {
        setIsLoadingInvite(false);
      });
  }, [inviteToken]);

  const submitInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!inviteToken) {
      setError('Invite token missing.');
      return;
    }

    if (!invitePassword.trim()) {
      setError('Enter the invite password.');
      return;
    }

    if (!accountMode) {
      setError('Choose whether you already have a DriftBoard account.');
      return;
    }

    if (accountMode === 'existing') {
      if (!accountEmail.trim()) {
        setError('Enter your account email address.');
        return;
      }
      if (invite && accountEmail.trim().toLowerCase() !== invite.email.toLowerCase()) {
        setError('Use the same email address this invite was sent to.');
        return;
      }
      if (!accountPassword.trim()) {
        setError('Enter your account password.');
        return;
      }
    }

    if (accountMode === 'new') {
      if (!name.trim()) {
        setError('Enter your full name.');
        return;
      }

      if (!newPassword || newPassword.length < 8) {
        setError('Create a password of at least 8 characters.');
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    try {
      await acceptInvite(inviteToken, {
        password: invitePassword.trim(),
        accountMode,
        email: accountEmail.trim(),
        accountPassword: accountPassword.trim(),
        name: name.trim(),
        username: username.trim(),
        newPassword,
      });

      toast.success('Project access granted.');
      navigate('/app/dashboard', { replace: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not accept invite.'));
    }
  };

  const requestPasswordReset = async () => {
    setError('');
    setResetMessage('');
    const email = (accountEmail || invite?.email || '').trim();
    if (!email) {
      setError('Enter your account email address first.');
      return;
    }
    try {
      const response = await forgotPassword(email);
      const resetUrl = `/reset-password?email=${encodeURIComponent(email)}`;
      setResetMessage(`${response.message} Open the reset link from your email, then return here and sign in with the new password.`);
      window.open(resetUrl, '_blank', 'noopener,noreferrer');
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not start password reset.'));
    }
  };

  const projectOrTeamName = invite?.projectName || invite?.teamName || 'this project';

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="absolute inset-0 bg-black" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-glass-dark/80 p-8 shadow-2xl backdrop-blur-xl"
      >
        <Link to="/" className="mb-8 inline-flex">
          <DriftBoardLogo />
        </Link>

        <div className="mb-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500/20 text-primary-300">
            <Link2 className="h-6 w-6" />
          </div>

          <h1 className="text-2xl font-bold text-white">Join project</h1>

          {invite && (
            <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-white/60">
              You were invited as{' '}
              <span className="font-semibold capitalize text-white">{invite.role}</span>{' '}
              to <span className="font-semibold text-white">{projectOrTeamName}</span>.
            </p>
          )}

          {isLoadingInvite && (
            <p className="mt-2 text-sm text-neutral-500 dark:text-white/50">Checking invite...</p>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {invite && !isLoadingInvite && (
          <form onSubmit={submitInvite} className="space-y-5">
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-xs text-white/45">Invited email</p>
              <p className="mt-1 text-sm font-medium text-white">{invite.email}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setAccountMode('existing')}
                className={`min-h-[40px] rounded-md px-3 text-sm font-medium transition-colors ${
                  accountMode === 'existing'
                    ? 'bg-primary-500 text-white'
                    : 'text-neutral-500 dark:text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                I have account
              </button>

              <button
                type="button"
                onClick={() => setAccountMode('new')}
                className={`min-h-[40px] rounded-md px-3 text-sm font-medium transition-colors ${
                  accountMode === 'new'
                    ? 'bg-primary-500 text-white'
                    : 'text-neutral-500 dark:text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                Create account
              </button>
            </div>

            <Input
              label="Invite password"
              type="password"
              value={invitePassword}
              onChange={(event) => setInvitePassword(event.target.value)}
              placeholder="Enter invite password"
              leftIcon={<KeyRound className="h-4 w-4" />}
            />

            {accountMode === 'existing' && (
              <div className="space-y-3">
                <Input
                  label="Account email"
                  type="email"
                  value={accountEmail}
                  onChange={(event) => setAccountEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <Input
                  label="Account password"
                  type="password"
                  value={accountPassword}
                  onChange={(event) => setAccountPassword(event.target.value)}
                  placeholder="Enter account password"
                  autoComplete="current-password"
                  leftIcon={<KeyRound className="h-4 w-4" />}
                />
                {resetMessage && (
                  <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs leading-5 text-emerald-200">
                    {resetMessage}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void requestPasswordReset()}
                  className="block text-left text-xs text-primary-400 transition-colors hover:text-primary-300"
                >
                  Forgot your password? Reset it here
                </button>
              </div>
            )}

            {accountMode === 'new' && (
              <div className="space-y-4">
                <Input
                  label="Full name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                />

                <Input
                  label="Username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="username"
                  autoComplete="username"
                />

                <Input
                  label="Create password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  leftIcon={<KeyRound className="h-4 w-4" />}
                />

                <Input
                  label="Confirm password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  error={
                    confirmPassword && newPassword !== confirmPassword
                      ? 'Passwords do not match'
                      : undefined
                  }
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  leftIcon={<KeyRound className="h-4 w-4" />}
                />
              </div>
            )}

            <Button type="submit" fullWidth loading={isLoading}>
              Get Access
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
