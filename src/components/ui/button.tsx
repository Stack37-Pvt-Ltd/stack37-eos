import * as React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 disabled:pointer-events-none disabled:opacity-50 select-none';

    const variantStyles = {
      primary:
        'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800 focus-visible:ring-emerald-600',
      secondary:
        'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 active:bg-zinc-300 focus-visible:ring-zinc-400',
      outline:
        'border border-zinc-300 bg-white text-zinc-800 shadow-xs hover:bg-zinc-50 active:bg-zinc-100 focus-visible:ring-zinc-400',
      ghost:
        'text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200 focus-visible:ring-zinc-400',
      link:
        'text-emerald-600 hover:text-emerald-700 underline-offset-4 hover:underline focus-visible:ring-0 p-0 h-auto',
    };

    const sizeStyles = {
      sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
      md: 'h-10 px-4 text-sm rounded-lg gap-2',
      lg: 'h-12 px-6 text-base rounded-xl gap-2.5',
    };

    const appliedSize = variant === 'link' ? '' : sizeStyles[size];

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${appliedSize} ${className}`.trim()}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-current shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
