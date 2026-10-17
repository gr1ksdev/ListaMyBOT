import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Dialog({ open, onOpenChange, children }) {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={() => onOpenChange?.(false)}
      />
      {/* Content */}
      <div className="relative z-50 w-full max-w-lg rounded-2xl border border-white/10 bg-card p-5 shadow-2xl duration-150 animate-in zoom-in-95 text-card-foreground">
        <button
          type="button"
          onClick={() => onOpenChange?.(false)}
          className="absolute right-3.5 top-3.5 rounded-lg p-1 opacity-60 hover:opacity-100 hover:bg-white/10 transition"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar</span>
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function DialogHeader({ className, ...props }) {
  return <div className={cn('flex flex-col space-y-1 text-left mb-4', className)} {...props} />;
}

export function DialogTitle({ className, ...props }) {
  return <h2 className={cn('text-base font-semibold leading-none tracking-tight text-foreground', className)} {...props} />;
}

export function DialogDescription({ className, ...props }) {
  return <p className={cn('text-xs text-muted-foreground mt-0.5', className)} {...props} />;
}

export function DialogFooter({ className, ...props }) {
  return <div className={cn('flex flex-row items-center justify-end gap-2 mt-5', className)} {...props} />;
}
