import * as React from 'react';
import { RefreshCw, Bot, ShieldCheck, Zap } from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { haptic } from '@/lib/telegram';

export function Header({ data, loading, onRefresh, isDemo, onToggleDemo }) {
  const isOnline = data?.schedulerHeartbeat && (Date.now() - data.schedulerHeartbeat < 120000);
  const isScheduled = data?.settings?.schedule?.enabled;

  const handleRefresh = () => {
    haptic('light');
    onRefresh?.();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* Brand & Bot identity */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-500 shadow-md shadow-sky-500/20 text-white font-bold text-lg">
            <Bot className="h-5 w-5" />
            {isOnline ? (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-slate-950"></span>
              </span>
            ) : null}
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base text-slate-100 tracking-tight">ListaMyBOT</span>
              <Badge variant="primary" className="text-[10px] py-0 px-1.5 h-4 font-mono font-medium">
                PRO
              </Badge>
              {isDemo && (
                <Badge variant="warning" className="text-[10px] py-0 px-1.5 h-4">
                  DEMO
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    isOnline ? 'bg-emerald-400' : isScheduled ? 'bg-amber-400' : 'bg-slate-600'
                  }`}
                />
                {isOnline ? 'Agendador ativo' : isScheduled ? 'Aguardando cron' : 'Manual'}
              </span>
              <span>•</span>
              <span className="text-[11px] font-mono text-slate-500">v{data?.version || 1}</span>
            </div>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={loading}
            className="rounded-xl h-9 w-9 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            title="Atualizar dados"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          </Button>
        </div>
      </div>
    </header>
  );
}
