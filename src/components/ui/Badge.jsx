import * as React from 'react';
import { cn } from '@/lib/utils';

export const badgeVariants = {
  default: 'bg-slate-800 text-slate-200 border-slate-700',
  secondary: 'bg-slate-800/60 text-slate-400 border-transparent',
  primary: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  destructive: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  outline: 'text-slate-300 border-slate-700',
};

export function Badge({ className, variant = 'default', ...props }) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        badgeVariants[variant] || badgeVariants.default,
        className
      )}
      {...props}
    />
  );
}
