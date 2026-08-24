import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Lock, KeyRound, Mail } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { DriftBoardLogo } from '@/components/common/DriftBoardLogo';

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

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { resetPassword, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isResetSuccessful, setIsResetSuccessful] = useState(false);

  const token = searchParams.get('token') || '';

  useEffect(() => {
    if (token) {
      setResetCode(token);
    }
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setSuccessMessage('');
    clearError();

    if (!email.trim()) {
      setLocalError('Enter your account email address.');
      return;
    }

    if (!resetCode.trim()) {
      setLocalError('Enter the reset code from the email.');
      return;
    }

    if (newPassword.length < 8) {
      setLocalError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    try {
      await resetPassword(resetCode, newPassword, email);
      setIsResetSuccessful(true);
      setSuccessMessage('Password reset successfully.');
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not reset password');
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <motion.div
        className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-500/10 via-transparent to-transparent"
        animate={{
          background: [
            'radial-gradient(ellipse_at_top,_var(--tw-gradient-stops)) from-primary-500/10 via-transparent to-transparent',
            'radial-gradient(ellipse_at_top,_var(--tw-gradient-stops)) from-primary-600/8 via-transparent to-transparent',
            'radial-gradient(ellipse_at_top,_var(--tw-gradient-stops)) from-primary-500/10 via-transparent to-transparent',
          ],
        }}
        transition={{ duration: 8, repeat: Infinity }}
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md relative z-10"
      >
        <motion.div variants={itemVariants} className="text-center mb-8">
          <Link to="/" className="mb-6 inline-flex">
            <DriftBoardLogo />
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">
            {isResetSuccessful ? 'Password Reset' : 'Set New Password'}
          </h1>
          <p className="text-neutral-500 dark:text-neutral-500 dark:text-white/60">
            {isResetSuccessful
              ? 'Your password has been updated successfully'
              : 'Enter your new password below'}
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="bg-white dark:bg-white/5 backdrop-blur-xl border border-neutral-200 dark:border-white/10 rounded-2xl p-8"
        >
          {isResetSuccessful ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center py-4"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border-2 border-emerald-400/30">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
              <p className="text-emerald-300 font-medium text-lg">Password reset successfully.</p>
              <p className="mt-2 text-neutral-500 dark:text-neutral-500 dark:text-white/50 text-sm">Redirecting to sign in...</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {displayError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm"
                >
                  {displayError}
                </motion.div>
              )}

              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-sm"
                >
                  {successMessage}
                </motion.div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="h-4 w-4 text-primary-400" />
                  <label className="block text-sm font-medium text-neutral-800 dark:text-neutral-800 dark:text-white/80">Account Email</label>
                </div>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <KeyRound className="h-4 w-4 text-primary-400" />
                  <label className="block text-sm font-medium text-neutral-800 dark:text-neutral-800 dark:text-white/80">Reset Code</label>
                </div>
                <Input
                  type="text"
                  placeholder="Reset code from email"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Lock className="h-4 w-4 text-primary-400" />
                  <label className="block text-sm font-medium text-neutral-800 dark:text-neutral-800 dark:text-white/80">New Password</label>
                </div>
                <Input
                  type="password"
                  placeholder="Create a new password (min. 8 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Lock className="h-4 w-4 text-primary-400" />
                  <label className="block text-sm font-medium text-neutral-800 dark:text-neutral-800 dark:text-white/80">Confirm Password</label>
                </div>
                <Input
                  type="password"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <Button type="submit" fullWidth loading={isLoading}>
                Reset Password
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
