import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { KeyRound, Link2 } from 'lucide-react';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { DriftBoardLogo } from '@/components/common/DriftBoardLogo';

interface InviteDetails {
  projectName: string;
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
  const navigate = useNavigate();
  const { acceptInvite, isLoading } = useAuthStore();
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [password, setPassword] = useState('');
  const [accountMode, setAccountMode] = useState<'existing' | 'new' | null>(null);
  const [accountPassword, setAccountPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoadingInvite, setIsLoadingInvite] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    setIsLoadingInvite(true);
    api.get<InviteDetails>(`/team/invite/${token}`)
      .then((details) => {
        setInvite(details);
        setAccountMode(null);
        setUsername(details.email.split('@')[0] || '');
      })
      .catch((requestError) => setError(getErrorMessage(requestError, 'Invite not found.')))
      .finally(() => setIsLoadingInvite(false));
  }, [token]);

  const submitInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!password.trim()) {
      setError('Enter the invite password.');
      return;
    }

    if (!accountMode) {
      setError('Choose whether you already have a DriftBoard account.');
      return;
    }

    if (accountMode === 'existing' && !accountPassword) {
      setError('Enter the invited account password.');
      return;
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
      await acceptInvite(token, {
        password: password.trim(),
        accountMode,
        accountPassword,
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

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="absolute inset-0 bg-gradient-dark" />
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
            <p className="mt-2 text-sm leading-6 text-white/60">
              You were invited as <span className="font-semibold capitalize text-white">{invite.role}</span> to{' '}
              <span className="font-semibold text-white">{invite.projectName}</span>.
              {invite.accountStatus === 'existing'
                ? ' We found an existing account for this email.'
                : ' Create an account for this email to accept access.'}
            </p>
          )}
          {isLoadingInvite && <p className="mt-2 text-sm text-white/50">Checking invite...</p>}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {invite && (
          <form onSubmit={submitInvite} className="space-y-5">
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-xs text-white/45">Invited account</p>
              <p className="mt-1 text-sm font-medium text-white">{invite.email}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setAccountMode('existing')}
                className={`min-h-[40px] rounded-md px-3 text-sm font-medium transition-colors ${
                  accountMode === 'existing' ? 'bg-primary-500 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                I have an account
              </button>
              <button
                type="button"
                onClick={() => setAccountMode('new')}
                className={`min-h-[40px] rounded-md px-3 text-sm font-medium transition-colors ${
                  accountMode === 'new' ? 'bg-primary-500 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                Create account
              </button>
            </div>
            {!accountMode && (
              <p className="text-xs leading-5 text-white/45">
                First choose the option that matches the invited email. Then enter the invite password from the email or the admin who invited you.
              </p>
            )}
            <Input
              label="Invite password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter shared password"
              leftIcon={<KeyRound className="h-4 w-4" />}
            />
            {accountMode === 'existing' ? (
              <Input
                label="Account password"
                type="password"
                value={accountPassword}
                onChange={(event) => setAccountPassword(event.target.value)}
                placeholder="Password for the invited account"
                leftIcon={<KeyRound className="h-4 w-4" />}
              />
            ) : (
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
                  error={confirmPassword && newPassword !== confirmPassword ? 'Passwords do not match' : undefined}
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
