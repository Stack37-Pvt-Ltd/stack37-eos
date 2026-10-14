import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, helperText, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-700"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            id={inputId}
            ref={ref}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={`flex min-h-11 w-full rounded-none border bg-white px-3 py-2 text-sm text-brand-navy placeholder:text-slate-500 transition-colors focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${
              error
                ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                : 'border-slate-300 focus:border-brand-blue focus:ring-2 focus:ring-blue-600/15'
            } ${className}`.trim()}
            {...props}
          />
        </div>
        {error && (
          <p id={errorId} className="text-xs font-medium text-rose-600">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helperId} className="text-xs text-zinc-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
