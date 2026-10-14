import * as React from 'react';

export function Card({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`ui-card border border-brand-line bg-white p-6 md:p-8 ${className}`.trim()}
      {...props}
    />
  );
}

export function CardHeader({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`mb-6 space-y-1.5 ${className}`.trim()} {...props} />;
}

export function CardTitle({ className = '', as: Heading = 'h2', ...props }: React.HTMLAttributes<HTMLHeadingElement> & { as?: 'h1' | 'h2' | 'h3' }) {
  return <Heading className={`ui-card-title text-2xl font-semibold tracking-[-0.04em] text-brand-navy ${className}`.trim()} {...props} />;
}

export function CardDescription({ className = '', ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`text-sm text-slate-600 leading-relaxed ${className}`.trim()} {...props} />;
}

export function CardContent({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`space-y-4 ${className}`.trim()} {...props} />;
}

export function CardFooter({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`ui-card-footer mt-6 pt-4 border-t border-brand-line flex items-center justify-between text-sm ${className}`.trim()} {...props} />;
}
