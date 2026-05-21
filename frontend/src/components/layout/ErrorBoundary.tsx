import { Component, ReactNode, ErrorInfo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: unknown[];
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      error,
      errorInfo,
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  componentDidUpdate(prevProps: Props): void {
    if (this.state.hasError && this.props.resetKeys) {
      const hasResetKeyChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );

      if (hasResetKeyChanged) {
        this.reset();
      }
    }
  }

  reset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = (): void => {
    this.reset();
    window.location.reload();
  };

  handleGoHome = (): void => {
    this.reset();
    window.location.href = '/app/dashboard';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.state.error?.message || 'Something went wrong';
      const isDev = import.meta.env.DEV;

      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="min-h-[400px] flex items-center justify-center p-6"
        >
          <div className="max-w-md w-full">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
              className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-red-500/20 flex items-center justify-center"
            >
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <h2 className="text-xl font-semibold text-white mb-2">Something went wrong</h2>
              <p className="text-sm text-gray-400 mb-6">{errorMessage}</p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={this.reset}
                  className={cn(
                    'flex items-center justify-center gap-2 px-4 py-2.5',
                    'bg-white/10 hover:bg-white/20 text-white rounded-lg',
                    'border border-white/20 transition-all duration-200'
                  )}
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Try Again</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={this.handleGoHome}
                  className={cn(
                    'flex items-center justify-center gap-2 px-4 py-2.5',
                    'bg-gradient-primary text-white rounded-lg',
                    'hover:shadow-glow-primary transition-all duration-200'
                  )}
                >
                  <Home className="w-4 h-4" />
                  <span>Go to Dashboard</span>
                </motion.button>
              </div>

              {isDev && this.state.errorInfo && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-left"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Bug className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-medium text-red-400">Error Details</span>
                  </div>
                  <pre className="text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap font-mono">
                    {this.state.error?.stack || errorMessage}
                  </pre>
                  {this.state.errorInfo.componentStack && (
                    <pre className="text-xs text-gray-500 mt-2 overflow-x-auto whitespace-pre-wrap font-mono">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </motion.div>
              )}
            </motion.div>
          </div>
        </motion.div>
      );
    }

    return this.props.children;
  }
}
