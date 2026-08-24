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
  if (passed === 3) return { score: 75, label: 'Good', color: 'bg-primary-500' };
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
      const message = err instanceof Error ? err.message : 'Registration failed';
      if (message.toLowerCase().includes('network') || message.toLowerCase().includes('timeout') || message.toLowerCase().includes('econnaborted')) {
        setLocalError('Connection timed out. Please try again.');
      } else {
        setLocalError(message);
      }
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
                className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-primary-500 focus:ring-primary-500/20"
              />
              <span className="text-sm text-white/60">
                I agree to the{' '}
                <button type="button" className="text-primary-400 hover:text-primary-300">
                  Terms of Service
                </button>{' '}
                and{' '}
                <button type="button" className="text-primary-400 hover:text-primary-300">
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
              <svg className="w-5 h-5" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 0 0 0 24c0 3.77.87 7.35 2.56 10.61l7.97-6.02z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.02C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
            }>
              Google
            </Button>
            <Button type="button" variant="secondary" onClick={() => startOAuthLogin('github')} leftIcon={
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .5C5.37.5 0 5.78 0 12.292c0 5.211 3.438 9.63 8.205 11.188.6.111.82-.254.82-.567 0-.28-.01-1.022-.015-2.005-3.338.711-4.042-1.582-4.042-1.582-.546-1.36-1.335-1.723-1.335-1.723-1.089-.73.083-.716.083-.716 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.417-1.305.762-1.604-2.665-.305-5.466-1.336-5.466-5.931 0-1.31.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.61 11.61 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.569.801.564 4.771-1.56 8.205-5.977 8.205-11.188C24 5.78 18.627.5 12 .5z"/>
              </svg>
            }>
              GitHub
            </Button>
          </div>
        </motion.div>

        <motion.p variants={itemVariants} className="text-center mt-6 text-white/60">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-400 hover:text-primary-300 transition-colors">
            Sign in
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
