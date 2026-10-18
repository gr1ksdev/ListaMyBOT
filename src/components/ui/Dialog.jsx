import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Dialog({ open, onOpenChange, children, className }) {
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
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 animate-in fade-in duration-150">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={() => onOpenChange?.(false)}
      />
      {/* Content: Mobile Bottom Sheet, Desktop Centered Modal */}
      <div
        className={cn(
          'relative z-50 w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/10 bg-card p-5 pb-7 sm:pb-5 shadow-2xl duration-200 animate-in slide-in-from-bottom-8 sm:zoom-in-95 text-card-foreground flex flex-col max-h-[90dvh] sm:max-h-[85vh]',
          className
        )}
      >
        {/* Mobile Grab Handle */}
        <div
          className="w-12 h-1.5 rounded-full bg-white/20 mx-auto -mt-1.5 mb-3.5 sm:hidden cursor-pointer shrink-0"
          onClick={() => onOpenChange?.(false)}
        />
        <button
          type="button"
          onClick={() => onOpenChange?.(false)}
          className="absolute right-3.5 top-3.5 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/10 transition cursor-pointer z-10"
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
  return <div className={cn('flex flex-col space-y-1 text-left mb-3 shrink-0 pr-6', className)} {...props} />;
}

export function DialogTitle({ className, ...props }) {
  return <h2 className={cn('text-base font-semibold leading-tight tracking-tight text-foreground', className)} {...props} />;
}

export function DialogDescription({ className, ...props }) {
  return <p className={cn('text-xs text-muted-foreground mt-0.5 leading-normal', className)} {...props} />;
}

export function DialogFooter({ className, ...props }) {
  return <div className={cn('flex flex-row items-center justify-end gap-2 pt-3 mt-auto shrink-0 border-t border-white/10', className)} {...props} />;
}
