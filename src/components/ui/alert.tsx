import * as React from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'error' | 'success' | 'info' | 'warning';
  title?: string;
}

export function Alert({
  variant = 'info',
  title,
  children,
  className = '',
  ...props
}: AlertProps) {
  const variantStyles = {
    error: 'border-rose-200 bg-rose-50 text-rose-900',
    success: 'border-blue-200 bg-blue-50 text-blue-900',
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  };

  const iconStyles = {
    error: 'text-rose-600',
    success: 'text-blue-600',
    info: 'text-sky-600',
    warning: 'text-amber-600',
  };

  const Icons = {
    error: AlertCircle,
    success: CheckCircle,
    info: Info,
    warning: AlertTriangle,
  };

  const IconComponent = Icons[variant];

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 border p-4 text-sm leading-relaxed ${variantStyles[variant]} ${className}`.trim()}
      {...props}
    >
      <IconComponent className={`h-5 w-5 shrink-0 mt-0.5 ${iconStyles[variant]}`} />
      <div className="flex-1 space-y-1">
        {title && <h5 className="font-semibold">{title}</h5>}
        <div className="text-xs md:text-sm font-normal opacity-90">{children}</div>
      </div>
    </div>
  );
}
