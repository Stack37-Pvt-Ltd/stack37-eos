import * as React from 'react';

export function Card({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-zinc-200/90 bg-white p-6 md:p-8 shadow-xs ${className}`.trim()}
      {...props}
    />
  );
}

export function CardHeader({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`mb-6 space-y-1.5 ${className}`.trim()} {...props} />;
}

export function CardTitle({ className = '', ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={`text-xl md:text-2xl font-bold tracking-tight text-zinc-900 ${className}`.trim()} {...props} />;
}

export function CardDescription({ className = '', ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`text-sm text-zinc-500 leading-relaxed ${className}`.trim()} {...props} />;
}

export function CardContent({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`space-y-4 ${className}`.trim()} {...props} />;
}

export function CardFooter({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between text-sm ${className}`.trim()} {...props} />;
}
