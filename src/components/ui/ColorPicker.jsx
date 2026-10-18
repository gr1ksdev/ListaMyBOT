import * as React from 'react';
import { Check } from 'lucide-react';
import { haptic } from '@/lib/telegram';
import { cn } from '@/lib/utils';

export const COLOR_SWATCHES = [
  { value: '', label: 'Padrão', colorClass: 'bg-slate-400 border border-white/20' },
  { value: 'primary', label: 'Azul', colorClass: 'bg-[#2481cc]' },
  { value: 'success', label: 'Verde', colorClass: 'bg-[#2ea043]' },
  { value: 'danger', label: 'Vermelho', colorClass: 'bg-[#e53935]' },
];

export function ColorPicker({
  value = '',
  onChange,
  inheritLabel = 'Padrão',
  size = 'default',
  className,
}) {
  const swatches = COLOR_SWATCHES.map((s) => (s.value === '' ? { ...s, label: inheritLabel } : s));

  const handleSelect = (val) => {
    haptic('selection');
    onChange?.(val);
  };

  return (
    <div
      className={cn(
        'w-full grid grid-cols-4 gap-1 p-1 rounded-xl bg-black/20 border border-white/10 select-none box-border',
        className
      )}
    >
      {swatches.map((swatch) => {
        const isSelected = (value || '') === swatch.value;

        return (
          <button
            key={swatch.value}
            type="button"
            onClick={() => handleSelect(swatch.value)}
            className={cn(
              'group flex items-center justify-center gap-1 sm:gap-1.5 px-1 sm:px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer min-w-0 w-full overflow-hidden',
              isSelected
                ? 'bg-white/15 text-white shadow-sm ring-1 ring-white/20 font-semibold'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            )}
            title={swatch.label}
          >
            <span
              className={cn(
                'relative flex h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 items-center justify-center rounded-full shadow-sm transition-transform',
                swatch.colorClass,
                isSelected && 'scale-110 ring-2 ring-white/40'
              )}
            >
              {isSelected && <Check className="h-2 w-2 sm:h-2.5 sm:w-2.5 text-white stroke-[3]" />}
            </span>
            <span className="text-[10px] sm:text-[11px] truncate leading-tight">{swatch.label}</span>
          </button>
        );
      })}
    </div>
  );
}
