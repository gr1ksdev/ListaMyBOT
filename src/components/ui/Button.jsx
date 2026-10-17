import * as React from 'react';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/telegram';

export const buttonVariants = {
  variant: {
    default: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-[0.98]',
    primary: 'bg-primary text-primary-foreground font-semibold shadow hover:bg-primary/90 active:scale-[0.98]',
    secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700 active:scale-[0.98]',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-[0.98]',
    success: 'bg-emerald-600 text-white hover:bg-emerald-500 active:scale-[0.98]',
    outline: 'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground active:scale-[0.98]',
    ghost: 'hover:bg-accent hover:text-accent-foreground active:scale-[0.98]',
    link: 'text-primary underline-offset-4 hover:underline p-0 h-auto',
  },
  size: {
    default: 'h-10 px-4 py-2',
    sm: 'h-8 rounded-md px-3 text-xs',
    lg: 'h-11 rounded-md px-8 text-base',
    icon: 'h-9 w-9 p-0 flex items-center justify-center',
  },
};

export const Button = React.forwardRef(
  ({ className, variant = 'default', size = 'default', hapticFeedback = 'light', onClick, disabled, ...props }, ref) => {
    const handleClick = (e) => {
      if (disabled) return;
      if (hapticFeedback) haptic(hapticFeedback);
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          'disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none',
          buttonVariants.variant[variant] || buttonVariants.variant.default,
          buttonVariants.size[size] || buttonVariants.size.default,
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
