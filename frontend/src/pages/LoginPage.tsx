import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { DriftBoardLogo } from '@/components/common/DriftBoardLogo';
import { getApiBaseUrl } from '@/services/runtimeConfig';

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

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, forgotPassword, startOAuthLogin, completeOAuthLogin, isLoading, error, clearError } = useAuthStore();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [localError, setLocalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [warmupStatus, setWarmupStatus] = useState('');
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const warmupAbortRef = useRef<AbortController | null>(null);
  const warmupCancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      warmupAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const rememberedIdentifier = localStorage.getItem('driftboard_remembered_identifier');
    if (rememberedIdentifier) {
      setIdentifier(rememberedIdentifier);
      setRememberMe(true);
    }
    const urlIdentifier = searchParams.get('identifier');
    if (urlIdentifier) {
      setIdentifier(urlIdentifier);
      setMode('forgot');
    }
  }, [searchParams]);

  useEffect(() => {
    const authError = searchParams.get('authError');
    const oauthToken = searchParams.get('token');
    const encodedUser = searchParams.get('user');

    if (authError) {
      setLocalError(authError);
      return;
    }

    if (searchParams.get('oauth') === 'success' && oauthToken && encodedUser) {
      try {
        const user = JSON.parse(atob(encodedUser.replace(/-/g, '+').replace(/_/g, '/')));
        completeOAuthLogin(oauthToken, user);
        navigate('/app/dashboard', { replace: true });
      } catch {
        setLocalError('Could not complete sign-in. Please try again.');
      }
    }
  }, [completeOAuthLogin, navigate, searchParams]);

  const warmupBackend = async (): Promise<boolean> => {
    const apiBaseUrl = getApiBaseUrl();
    const healthUrl = `${apiBaseUrl.replace(/\/$/, '')}/health`;

    warmupAbortRef.current?.abort();
    const controller = new AbortController();
    warmupAbortRef.current = controller;
    warmupCancelledRef.current = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (controller.signal.aborted) {
        warmupCancelledRef.current = true;
        return false;
      }
      try {
        setWarmupStatus(
          attempt === 0
            ? 'Waking up server...'
            : `Waking up server (attempt ${attempt + 1})...`
        );
        const response = await fetch(healthUrl, {
          method: 'GET',
          signal: controller.signal,
        });
        if (response.ok || response.status < 500) {
          return true;
        }
      } catch {
        // Backend not ready yet, retry
      }
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setSuccessMessage('');
    setWarmupStatus('');
    setIsWarmingUp(false);
    clearError();

    if (mode === 'forgot') {
      if (!identifier) {
        setLocalError('Enter your email or username');
        return;
      }

      try {
        const response = await forgotPassword(identifier);
        setSuccessMessage(response.message);
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Password reset failed');
      }
      return;
    }

    if (!identifier || !password) {
      setLocalError('Please fill in all fields');
      return;
    }

    // Warm up backend before login to avoid cold start timeouts
    setIsWarmingUp(true);
    warmupCancelledRef.current = false;
    const backendReady = await warmupBackend();

    // If user cancelled warmup, don't proceed with login
    if (warmupCancelledRef.current) {
      setIsWarmingUp(false);
      setWarmupStatus('');
      return;
    }

    if (!backendReady) {
      // Warmup failed but proceed anyway — the increased 60s timeout may still handle it
    } else {
      // Small delay so the backend can fully initialize after warmup
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    setIsWarmingUp(false);
    setWarmupStatus('');

    try {
      await login(identifier, password);
      if (rememberMe) {
        localStorage.setItem('driftboard_remembered_identifier', identifier);
      } else {
        localStorage.removeItem('driftboard_remembered_identifier');
      }
      navigate('/app/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      // If the error is a network/timeout error, suggest retrying
      if (message.toLowerCase().includes('network') || message.toLowerCase().includes('timeout') || message.toLowerCase().includes('econnaborted')) {
        setLocalError('Connection timed out. The server may still be starting up — please wait a moment and sign in again.');
      } else {
        setLocalError(message);
      }
    }
  };

  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<'google' | 'github' | null>(null);
  const [oauthStatus, setOauthStatus] = useState('');

  const continueWithProvider = async (provider: 'google' | 'github') => {
    setLocalError('');
    setSuccessMessage('');
    clearError();
    setOauthProvider(provider);
    setOauthLoading(true);
    setOauthStatus('Connecting securely...');

    const providerLabel = provider === 'google' ? 'Google' : 'GitHub';
    const apiBaseUrl = getApiBaseUrl();
    const healthUrl = `${apiBaseUrl.replace(/\/$/, '')}/health`;

    // Ping health endpoint to wake up backend (Render free tier)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let backendReady = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        setOauthStatus(
          attempt === 0
            ? 'Connecting securely...'
            : `Waking up server (attempt ${attempt + 1})...`
        );
        const response = await fetch(healthUrl, {
          method: 'GET',
          signal: controller.signal,
        });
        if (response.ok || response.status < 500) {
          backendReady = true;
          break;
        }
      } catch {
        // Backend not ready yet, retry
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    clearTimeout(timeoutId);

    if (!backendReady) {
      setOauthLoading(false);
      setOauthProvider(null);
      setLocalError(
        `Could not reach the server for ${providerLabel} sign-in. Please try again in a moment.`
      );
      return;
    }

    setOauthStatus(`Preparing ${providerLabel} login...`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    startOAuthLogin(provider);
  };

  const showLoginMode = () => {
    setMode('login');
    setLocalError('');
    setSuccessMessage('');
    clearError();
  };

  const displayError = localError || error;
  const oauthProviderLabel = oauthProvider === 'google' ? 'Google' : oauthProvider === 'github' ? 'GitHub' : '';
  const title = mode === 'login' ? 'Welcome back' : 'Reset password';
  const subtitle =
    mode === 'login'
      ? 'Sign in to your account to continue'
      : 'Enter your account email and we will send you a reset link';

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
          <h1 className="text-3xl font-bold text-white mb-2">
            {oauthLoading ? oauthProviderLabel : isWarmingUp ? 'Waking up server' : title}
          </h1>
          <p className="text-white/60">
            {oauthLoading ? oauthStatus : isWarmingUp ? warmupStatus : subtitle}
          </p>
        </motion.div>

        {isWarmingUp ? (
          <motion.div
            variants={itemVariants}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px]"
          >
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 animate-pulse" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-indigo-400/30 bg-indigo-500/10">
                <Shield className="h-10 w-10 text-indigo-400" />
              </div>
            </div>
            <div className="mb-4 flex items-center gap-3">
              <RefreshCw className="h-5 w-5 animate-spin text-indigo-400" />
              <p className="text-lg font-medium text-white">{warmupStatus}</p>
            </div>
            <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-purple-400"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 8, ease: 'easeInOut' }}
              />
            </div>
            <p className="mt-4 text-sm text-white/40">
              Waking up the server for a secure sign-in
            </p>              <button
                type="button"
                onClick={() => {
                  setIsWarmingUp(false);
                  setWarmupStatus('');
                  warmupCancelledRef.current = true;
                  warmupAbortRef.current?.abort();
                }}
                className="mt-6 text-sm text-white/40 hover:text-white/60 transition-colors"
              >
                Cancel
              </button>
          </motion.div>
        ) : oauthLoading ? (
          <motion.div
            variants={itemVariants}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px]"
          >
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 animate-pulse" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-indigo-400/30 bg-indigo-500/10">
                <Shield className="h-10 w-10 text-indigo-400" />
              </div>
            </div>
            <div className="mb-4 flex items-center gap-3">
              <RefreshCw className="h-5 w-5 animate-spin text-indigo-400" />
              <p className="text-lg font-medium text-white">{oauthStatus}</p>
            </div>
            <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-purple-400"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 8, ease: 'easeInOut' }}
              />
            </div>
            <p className="mt-4 text-sm text-white/40">
              Waking up the server for a secure {oauthProviderLabel} sign-in
            </p>
            <button
              type="button"
              onClick={() => {
                setOauthLoading(false);
                setOauthProvider(null);
              }}
              className="mt-6 text-sm text-white/40 hover:text-white/60 transition-colors"
            >
              Cancel
            </button>
          </motion.div>
        ) : (
        <motion.div
          variants={itemVariants}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
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

            <Input
              label="Email or username"
              type="text"
              placeholder="you@example.com or username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
            />

            {mode === 'login' && (
              <>
                <Input
                  label="Password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500/20"
                    />
                    <span className="text-sm text-white/60">Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setLocalError('');
                      setSuccessMessage('');
                      clearError();
                    }}
                    className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              </>
            )}

            <Button type="submit" fullWidth loading={isLoading}>
              {mode === 'login' ? 'Sign In' : 'Send Reset Link'}
            </Button>

            {mode !== 'login' && (
              <Button type="button" variant="ghost" fullWidth onClick={showLoginMode}>
                Back to sign in
              </Button>
            )}
          </form>

          {mode === 'login' && (
            <>
              <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/50">
                Demo account: demo@driftboard.dev / Demo1234
              </div>
              <p className="mt-3 text-xs leading-5 text-white/45">
                Google and GitHub use real OAuth when provider credentials are configured.
              </p>

              <div className="my-6 flex items-center gap-4 text-sm">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-white/40">Or continue with</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button type="button" variant="secondary" loading={isLoading} onClick={() => continueWithProvider('google')} leftIcon={
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                }>
                  Google
                </Button>
                <Button type="button" variant="secondary" loading={isLoading} onClick={() => continueWithProvider('github')} leftIcon={
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                }>
                  GitHub
                </Button>
              </div>
            </>
          )}
        </motion.div>
        )}

        {mode === 'login' && (
          <motion.p variants={itemVariants} className="text-center mt-6 text-white/60">
            Don't have an account?{' '}
            <Link to="/register" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              Sign up
            </Link>
          </motion.p>
        )}
        {oauthLoading && (
          <p className="text-center mt-4 text-xs text-white/30">
            This ensures the backend is awake before redirecting to {oauthProviderLabel}
          </p>
        )}
      </motion.div>
    </div>
  );
}
