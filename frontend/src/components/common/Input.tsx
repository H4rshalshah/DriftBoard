import { forwardRef, useState, type InputHTMLAttributes, useId } from 'react';
import { cn } from '../../utils/cn';
import { Eye, EyeOff, Search } from 'lucide-react';

export type InputVariant = 'default' | 'search';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  variant?: InputVariant;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-4 py-3 text-base',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      variant = 'default',
      leftIcon,
      rightIcon,
      size = 'md',
      type = 'text',
      className,
      id,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const generatedId = useId();
    const inputId = id || generatedId;
    const isSearch = variant === 'search';

    const inputType =
      type === 'password' ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-white/70 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {isSearch && !leftIcon && (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          )}
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            type={inputType}
            className={cn(
              'w-full bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder:text-white/25',
              'focus:outline-none focus:border-primary-500/40 focus:ring-1 focus:ring-primary-500/10',
              'transition-all duration-200',
              sizeStyles[size],
              leftIcon && 'pl-10',
              (rightIcon || type === 'password') && 'pr-10',
              isSearch && 'pl-10',
              error && 'border-red-500/40 focus:border-red-500/40 focus:ring-red-500/15',
              className
            )}
            {...props}
          />
          {type === 'password' && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
          {rightIcon && type !== 'password' && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30">
              {rightIcon}
            </span>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
