import * as React from 'react';
import { RefreshCw, Bot } from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { haptic } from '@/lib/telegram';

export function Header({ data, loading, onRefresh, isDemo }) {
  const isOnline = data?.schedulerHeartbeat && Date.now() - data.schedulerHeartbeat < 120000;
  const isScheduled = data?.settings?.schedule?.enabled;
  const isMaintenance = Boolean(data?.settings?.maintenance?.enabled);

  const handleRefresh = () => {
    haptic('light');
    onRefresh?.();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
        {/* Brand & Bot identity */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white font-bold text-base shadow-sm">
            <Bot className="h-5 w-5" />
            {isOnline ? (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-background"></span>
              </span>
            ) : null}
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm text-foreground tracking-tight">ListaMyBOT</span>
              <Badge variant="primary" className="text-[9px] py-0 px-1.5 h-3.5 font-mono">
                ADMIN
              </Badge>
              {isDemo && (
                <Badge variant="warning" className="text-[9px] py-0 px-1.5 h-3.5">
                  DEMO
                </Badge>
              )}
              {isMaintenance && (
                <Badge variant="warning" className="text-[9px] py-0 px-1.5 h-3.5">
                  MANUTENÇÃO
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    isMaintenance
                      ? 'bg-amber-400'
                      : isOnline
                        ? 'bg-emerald-400'
                        : isScheduled
                          ? 'bg-amber-400'
                          : 'bg-muted-foreground/50'
                  }`}
                />
                {isMaintenance
                  ? 'Manutenção ativa'
                  : isOnline
                    ? 'Agendador ativo'
                    : isScheduled
                      ? 'Aguardando cron'
                      : 'Manual'}
              </span>
              <span>•</span>
              <span className="font-mono opacity-70">v{data?.version || 1}</span>
            </div>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={loading}
            className="rounded-xl h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Atualizar dados"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-primary' : ''}`} />
          </Button>
        </div>
      </div>
    </header>
  );
}
