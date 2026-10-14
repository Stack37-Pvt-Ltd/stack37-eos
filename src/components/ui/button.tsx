import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Slot } from '@radix-ui/react-slot';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      asChild = false,
      disabled = false,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center rounded-none font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none';

    const variantStyles = {
      primary:
        'bg-brand-navy text-white hover:bg-slate-700 active:bg-slate-800',
      secondary:
        'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 active:bg-zinc-300 focus-visible:ring-zinc-400',
      outline:
        'border border-zinc-300 bg-white text-zinc-800 shadow-xs hover:bg-zinc-50 active:bg-zinc-100 focus-visible:ring-zinc-400',
      ghost:
        'text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200 focus-visible:ring-zinc-400',
      link:
        'text-brand-blue hover:text-blue-800 underline-offset-4 hover:underline p-0 h-auto',
    };

    const sizeStyles = {
      sm: 'min-h-10 px-3 text-xs gap-1.5',
      md: 'min-h-11 px-5 text-sm gap-2',
      lg: 'min-h-12 px-6 text-base gap-2.5',
    };

    const appliedSize = variant === 'link' ? '' : sizeStyles[size];
    const Component = asChild ? Slot : 'button';

    return (
      <Component
        ref={ref}
        {...(!asChild ? { type, disabled: disabled || isLoading } : {})}
        aria-busy={isLoading || undefined}
        className={`${baseStyles} ${variantStyles[variant]} ${appliedSize} ${className}`.trim()}
        {...props}
      >
        {asChild ? children : <>{isLoading && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-current shrink-0" />}{children}</>}
      </Component>
    );
  }
);

Button.displayName = 'Button';
