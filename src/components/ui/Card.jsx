import * as React from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/10 bg-card text-card-foreground shadow-sm transition-all',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('flex flex-col space-y-1 p-4', className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return (
    <h3
      className={cn('text-sm font-semibold leading-none tracking-tight text-foreground', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }) {
  return <p className={cn('text-xs text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn('p-4 pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }) {
  return <div className={cn('flex items-center p-4 pt-0', className)} {...props} />;
}
