import * as React from 'react';
import {
  CheckCircle2,
  Clock,
  Send,
  Trash2,
  AlertCircle,
  TrendingUp,
  Radio,
  ChevronRight,
  Sparkles,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/Dialog';
import { formatDate, displayDate } from '@/lib/utils';
import { useToast } from './ui/Toast';
import { callEndpoint, haptic } from '@/lib/telegram';

export function OverviewTab({ data, onNavigateTab, onRefresh, isDemo }) {
  const { toast } = useToast();
  const [confirmSendOpen, setConfirmSendOpen] = React.useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);

  const approvedChats = (data?.chats || []).filter((c) => c.status === 'approved');
  const pendingChats = (data?.chats || []).filter((c) => c.status === 'pending');
  const rejectedChats = (data?.chats || []).filter((c) => c.status === 'rejected');

  const schedule = data?.settings?.schedule;
  const removalSchedule = data?.settings?.removalSchedule;
  const lastDelivery = data?.lastDeliverySummary;
  const lastRemoval = data?.lastRemovalSummary;

  const isOnline = data?.schedulerHeartbeat && Date.now() - data.schedulerHeartbeat < 120000;

  const handleSendNow = async () => {
    if (isDemo) {
      toast('Modo de teste: simulação de envio executada com sucesso!', 'info');
      setConfirmSendOpen(false);
      return;
    }
    try {
      setSending(true);
      haptic('heavy');
      await callEndpoint('sendNow', {});
      toast('Disparo da lista iniciado com sucesso!', 'success');
      setConfirmSendOpen(false);
      onRefresh?.();
    } catch (err) {
      toast(err.message || 'Falha ao disparar lista', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleRemoveNow = async () => {
    if (isDemo) {
      toast('Modo de teste: simulação de remoção executada!', 'info');
      setConfirmRemoveOpen(false);
      return;
    }
    try {
      setRemoving(true);
      haptic('heavy');
      await callEndpoint('removeNow', {});
      toast('Remoção das listas enviadas concluída!', 'success');
      setConfirmRemoveOpen(false);
      onRefresh?.();
    } catch (err) {
      toast(err.message || 'Falha ao remover listas', 'error');
    } finally {
      setRemoving(false);
    }
  };

  const handleTestNow = async () => {
    if (isDemo) {
      toast('Modo de teste: lista enviada para seu chat privado!', 'info');
      return;
    }
    try {
      setTesting(true);
      haptic('medium');
      await callEndpoint('testList', {});
      toast('Lista de teste enviada para seu privado!', 'success');
    } catch (err) {
      toast(err.message || 'Falha ao enviar teste', 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      {/* Top Banner / Welcome */}
      <div className="relative overflow-hidden rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-950/40 via-slate-900 to-indigo-950/40 p-6 shadow-xl backdrop-blur-xl">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-400 mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              Painel de Controle
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Gerencie sua Rede de Listas
            </h1>
            <p className="mt-1 text-sm text-slate-300 max-w-xl">
              Controle automático de aprovação, envio e remoção programada com visualização em tempo real.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestNow}
              disabled={testing || approvedChats.length === 0}
              className="border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200"
            >
              <Radio className="h-4 w-4 text-sky-400" />
              {testing ? 'Enviando...' : 'Testar no Privado'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setConfirmSendOpen(true)}
              disabled={approvedChats.length === 0}
              className="shadow-lg shadow-sky-500/20"
            >
              <Send className="h-4 w-4" />
              Enviar Agora
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {/* Ativos */}
        <Card
          onClick={() => onNavigateTab('chats', 'approved')}
          className="cursor-pointer border-slate-800/80 hover:border-sky-500/40 transition-all hover:bg-slate-900/90"
        >
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-medium">
              <span>Ativos</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-white">{approvedChats.length}</div>
            <p className="mt-1 text-[11px] text-slate-400">Na lista oficial</p>
          </CardContent>
        </Card>

        {/* Pendentes */}
        <Card
          onClick={() => onNavigateTab('chats', 'pending')}
          className={`cursor-pointer transition-all hover:bg-slate-900/90 ${
            pendingChats.length > 0
              ? 'border-amber-500/40 bg-amber-950/20'
              : 'border-slate-800/80 hover:border-amber-500/40'
          }`}
        >
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-medium">
              <span className={pendingChats.length > 0 ? 'text-amber-300 font-semibold' : ''}>
                Pendentes
              </span>
              <Clock className="h-4 w-4 text-amber-400" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-white">{pendingChats.length}</div>
            <p className="mt-1 text-[11px] text-slate-400">Aguardando moderação</p>
          </CardContent>
        </Card>

        {/* Rodadas */}
        <Card className="border-slate-800/80">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-medium">
              <span>Rodadas</span>
              <TrendingUp className="h-4 w-4 text-sky-400" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-white">
              {data?.rounds?.length || 0}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Disparos registrados</p>
          </CardContent>
        </Card>

        {/* Taxa de Entrega */}
        <Card className="border-slate-800/80">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-medium">
              <span>Entregas</span>
              <ShieldCheck className="h-4 w-4 text-indigo-400" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-white">
              {lastDelivery?.sent ?? 0}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {lastDelivery?.total ? `de ${lastDelivery.total} na última rodada` : 'Nenhum envio ainda'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Attention Alert */}
      {pendingChats.length > 0 && (
        <div
          onClick={() => onNavigateTab('chats', 'pending')}
          className="group flex cursor-pointer items-center justify-between rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-transparent p-4 shadow-sm transition-all hover:border-amber-400"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-amber-200">
                {pendingChats.length} {pendingChats.length === 1 ? 'canal aguardando aprovação' : 'canais aguardando aprovação'}
              </h4>
              <p className="text-xs text-amber-300/80">
                Toque aqui para revisar solicitações pendentes e aprovar participantes.
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-amber-400 transition-transform group-hover:translate-x-1" />
        </div>
      )}

      {/* Schedules & Automations Status */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Envio Programado */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Send className="h-4 w-4 text-sky-400" />
                Envio Programado
              </CardTitle>
              <Badge variant={schedule?.enabled ? 'success' : 'secondary'}>
                {schedule?.enabled ? 'Ativado' : 'Desativado'}
              </Badge>
            </div>
            <CardDescription>
              {schedule?.enabled
                ? schedule.mode === 'fixed'
                  ? `Horários diários: ${schedule.times?.join(', ') || '—'}`
                  : `A cada ${schedule.minutes} minutos`
                : 'Envios automáticos desligados'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-slate-950/60 p-3 border border-slate-800">
              <span className="text-xs text-slate-400">Próximo envio</span>
              <span className="text-xs font-semibold text-slate-100">
                {schedule?.enabled ? displayDate(schedule.nextAt) : '—'}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateTab('schedule')}
              className="w-full text-xs text-slate-300 border-slate-800 hover:bg-slate-800"
            >
              Configurar horários de envio
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </CardContent>
        </Card>

        {/* Auto Remoção */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-rose-400" />
                Remoção Programada
              </CardTitle>
              <Badge variant={removalSchedule?.enabled ? 'destructive' : 'secondary'}>
                {removalSchedule?.enabled ? 'Ativado' : 'Desativado'}
              </Badge>
            </div>
            <CardDescription>
              {removalSchedule?.enabled
                ? removalSchedule.mode === 'fixed'
                  ? `Exclusão diária: ${removalSchedule.times?.join(', ') || '—'}`
                  : `A cada ${removalSchedule.minutes} minutos`
                : 'Limpeza automática de listas desligada'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-slate-950/60 p-3 border border-slate-800">
              <span className="text-xs text-slate-400">Próxima exclusão</span>
              <span className="text-xs font-semibold text-slate-100">
                {removalSchedule?.enabled ? displayDate(removalSchedule.nextAt) : '—'}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmRemoveOpen(true)}
              className="w-full text-xs text-rose-300 border-slate-800 hover:bg-rose-950/30 hover:border-rose-800"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1 text-rose-400" />
              Remover listas agora
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Última Rodada & Status de Entrega */}
      {lastDelivery && (
        <Card className="border-slate-800/80">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Última Rodada de Envio</CardTitle>
                <CardDescription>
                  {data?.rounds?.[0]?.created ? formatDate(data.rounds[0].created) : 'Registro recente'}
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono">
                {lastDelivery.sent} de {lastDelivery.total} entregues
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-500"
                style={{
                  width: `${
                    lastDelivery.total > 0
                      ? Math.min(100, Math.round((lastDelivery.sent / lastDelivery.total) * 100))
                      : 0
                  }%`,
                }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-950/50 p-2.5 border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Sucesso</span>
                <span className="text-sm font-bold text-emerald-400">{lastDelivery.sent || 0}</span>
              </div>
              <div className="rounded-xl bg-slate-950/50 p-2.5 border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Falhas</span>
                <span className="text-sm font-bold text-rose-400">{lastDelivery.failed || 0}</span>
              </div>
              <div className="rounded-xl bg-slate-950/50 p-2.5 border border-slate-800">
                <span className="text-[11px] text-slate-400 block">A Conferir</span>
                <span className="text-sm font-bold text-amber-400">{lastDelivery.uncertain || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog for Immediate Broadcast */}
      <Dialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <DialogHeader>
          <DialogTitle>Disparar Lista Agora?</DialogTitle>
          <DialogDescription>
            A lista atual com {approvedChats.length} canais e grupos ativos será enviada imediatamente para todos os chats participantes cadastrados.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl bg-slate-950/60 p-4 border border-slate-800 text-xs text-slate-300 space-y-2">
          <div className="flex justify-between">
            <span>Destinos participantes:</span>
            <strong className="text-white">{approvedChats.length} canais</strong>
          </div>
          <div className="flex justify-between">
            <span>Fixar mensagem (Pin):</span>
            <strong className="text-white">{data?.settings?.pin ? 'Sim' : 'Não'}</strong>
          </div>
          <div className="flex justify-between">
            <span>Apagar lista anterior:</span>
            <strong className="text-white">{data?.settings?.deletePrevious ? 'Sim' : 'Não'}</strong>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setConfirmSendOpen(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSendNow} disabled={sending}>
            <Send className="h-4 w-4" />
            {sending ? 'Disparando...' : 'Confirmar e Enviar'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Confirmation Dialog for Immediate Removal */}
      <Dialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
        <DialogHeader>
          <DialogTitle>Remover Listas Enviadas?</DialogTitle>
          <DialogDescription>
            Essa ação apagará imediatamente as últimas mensagens da lista enviadas pelo bot em todos os canais e grupos.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setConfirmRemoveOpen(false)} disabled={removing}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleRemoveNow} disabled={removing}>
            <Trash2 className="h-4 w-4" />
            {removing ? 'Excluindo...' : 'Confirmar Exclusão'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
