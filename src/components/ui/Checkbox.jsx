import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/telegram';

export function Checkbox({
  checked = false,
  onCheckedChange,
  onChange,
  disabled = false,
  id,
  className,
  children,
}) {
  const handleChange = () => {
    if (disabled) return;
    haptic('selection');
    const next = !checked;
    onCheckedChange?.(next);
    onChange?.({ target: { checked: next } });
  };

  return (
    <label
      htmlFor={id}
      onClick={(e) => {
        // Prevent double triggers if clicked on label
        e.preventDefault();
        handleChange();
      }}
      className={cn(
        'group inline-flex items-center gap-2 cursor-pointer select-none text-xs text-foreground/90',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <button
        id={id}
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          handleChange();
        }}
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-md border border-white/20 bg-background/60 shadow-sm transition-all duration-150',
          'group-hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          checked && 'border-primary bg-primary text-white shadow-primary/20'
        )}
      >
        {checked && <Check className="h-3 w-3 stroke-[3]" />}
      </button>
      {children && <span className="leading-tight">{children}</span>}
    </label>
  );
}
