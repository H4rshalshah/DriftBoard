import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
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

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const passwordRequirements: PasswordRequirement[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'Contains uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'Contains lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'Contains number', test: (p) => /[0-9]/.test(p) },
];

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  const passed = passwordRequirements.filter((req) => req.test(password)).length;
  
  if (password.length === 0) return { score: 0, label: '', color: '' };
  if (passed <= 1) return { score: 25, label: 'Weak', color: 'bg-red-500' };
  if (passed === 2) return { score: 50, label: 'Fair', color: 'bg-yellow-500' };
  if (passed === 3) return { score: 75, label: 'Good', color: 'bg-blue-500' };
  return { score: 100, label: 'Strong', color: 'bg-green-500' };
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register, startOAuthLogin, isLoading, error, clearError } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [username, setUsername] = useState('');
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [localError, setLocalError] = useState('');

  const passwordStrength = getPasswordStrength(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const suggestedUsername = (email || name)
    .trim()
    .toLowerCase()
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/(^[-._]+|[-._]+$)/g, '');

  useEffect(() => {
    if (!usernameEdited) {
      setUsername(suggestedUsername);
    }
  }, [suggestedUsername, usernameEdited]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    const finalUsername = username.trim() || suggestedUsername;

    if (!name || !email || !password || !confirmPassword) {
      setLocalError('Please fill in all fields');
      return;
    }

    if (!acceptTerms) {
      setLocalError('Please accept the terms and conditions');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    if (passwordStrength.score < 50) {
      setLocalError('Please choose a stronger password');
      return;
    }

    try {
      await register(email, password, name, finalUsername);
      navigate('/app/dashboard');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <motion.div
        className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent"
        animate={{
          background: [
            'radial-gradient(ellipse_at_top,_var(--tw-gradient-stops)) from-indigo-500/10 via-transparent to-transparent',
            'radial-gradient(ellipse_at_top,_var(--tw-gradient-stops)) from-purple-500/10 via-transparent to-transparent',
            'radial-gradient(ellipse_at_top,_var(--tw-gradient-stops)) from-indigo-500/10 via-transparent to-transparent',
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
          <h1 className="text-3xl font-bold text-white mb-2">Create an account</h1>
          <p className="text-white/60">Start monitoring your APIs today</p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8"
        >
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

            <Input
              label="Full Name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />

            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <Input
              label="Username"
              type="text"
              placeholder="your-name"
              value={username}
              onChange={(e) => {
                setUsernameEdited(true);
                setUsername(e.target.value);
              }}
              autoComplete="username"
            />

            <div>
              <Input
                label="Password"
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              {password.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full ${passwordStrength.color}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${passwordStrength.score}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <span className="text-xs text-white/60">{passwordStrength.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {passwordRequirements.map((req) => (
                      <div
                        key={req.label}
                        className={`text-xs flex items-center gap-1 ${
                          req.test(password) ? 'text-green-400' : 'text-white/40'
                        }`}
                      >
                        <span className={req.test(password) ? 'text-green-400' : 'text-white/40'}>
                          {req.test(password) ? 'OK' : '-'}
                        </span>
                        {req.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Input
              label="Confirm Password"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              error={confirmPassword.length > 0 && !passwordsMatch ? 'Passwords do not match' : undefined}
            />

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500/20"
              />
              <span className="text-sm text-white/60">
                I agree to the{' '}
                <button type="button" className="text-indigo-400 hover:text-indigo-300">
                  Terms of Service
                </button>{' '}
                and{' '}
                <button type="button" className="text-indigo-400 hover:text-indigo-300">
                  Privacy Policy
                </button>
              </span>
            </label>

            <Button type="submit" fullWidth loading={isLoading}>
              Create Account
            </Button>
          </form>

          <div className="my-6 flex items-center gap-4 text-sm">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-white/40">Or continue with</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="secondary" onClick={() => startOAuthLogin('google')} leftIcon={
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            }>
              Google
            </Button>
            <Button type="button" variant="secondary" onClick={() => startOAuthLogin('github')} leftIcon={
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            }>
              GitHub
            </Button>
          </div>
        </motion.div>

        <motion.p variants={itemVariants} className="text-center mt-6 text-white/60">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            Sign in
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
