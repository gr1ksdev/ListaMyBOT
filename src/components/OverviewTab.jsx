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
  ShieldCheck,
  BookOpen,
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
  const [promoTutorialOpen, setPromoTutorialOpen] = React.useState(false);

  const approvedChats = (data?.chats || []).filter((c) => c.status === 'approved');
  const pendingChats = (data?.chats || []).filter((c) => c.status === 'pending');
  const rejectedChats = (data?.chats || []).filter((c) => c.status === 'rejected');

  const schedule = data?.settings?.schedule;
  const removalSchedule = data?.settings?.removalSchedule;
  const lastDelivery = data?.lastDeliverySummary;

  const handleSendNow = async () => {
    if (isDemo) {
      toast('Modo Demo: envio executado com sucesso!', 'info');
      setConfirmSendOpen(false);
      return;
    }
    try {
      setSending(true);
      haptic('heavy');
      await callEndpoint('sendNow', {});
      toast('Disparo da lista iniciado!', 'success');
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
      toast('Modo Demo: remoção executada!', 'info');
      setConfirmRemoveOpen(false);
      return;
    }
    try {
      setRemoving(true);
      haptic('heavy');
      await callEndpoint('removeNow', {});
      toast('Remoção das listas concluída!', 'success');
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
      toast('Modo Demo: teste enviado para seu privado!', 'info');
      return;
    }
    try {
      setTesting(true);
      haptic('medium');
      await callEndpoint('testList', {});
      toast('Lista de teste enviada ao seu chat privado!', 'success');
    } catch (err) {
      toast(err.message || 'Falha ao enviar teste', 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-300">
      {/* Top Welcome Card */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-card p-5 shadow-lg">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-primary mb-2.5">
              <Sparkles className="h-3.5 w-3.5" />
              Painel de Controle
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Rede de Listas do Telegram
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground max-w-xl">
              Aprovação de participantes, envio automático e remoção programada.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestNow}
              disabled={testing || approvedChats.length === 0}
              className="border-white/10 text-xs h-8"
            >
              <Radio className="h-3.5 w-3.5 text-primary" />
              {testing ? 'Enviando...' : 'Testar no Privado'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setConfirmSendOpen(true)}
              disabled={approvedChats.length === 0}
              className="text-xs h-8 font-semibold shadow-sm"
            >
              <Send className="h-3.5 w-3.5" />
              Enviar Agora
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {/* Ativos */}
        <Card
          onClick={() => onNavigateTab('chats', 'approved')}
          className="cursor-pointer border-white/10 bg-card hover:border-white/20 transition-all"
        >
          <CardHeader className="p-3.5 pb-1">
            <CardDescription className="flex items-center justify-between text-xs font-medium">
              <span>Ativos</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="text-xl font-bold tracking-tight text-foreground">{approvedChats.length}</div>
            <p className="text-[10px] text-muted-foreground">Na lista oficial</p>
          </CardContent>
        </Card>

        {/* Pendentes */}
        <Card
          onClick={() => onNavigateTab('chats', 'pending')}
          className={`cursor-pointer transition-all ${
            pendingChats.length > 0
              ? 'border-amber-500/40 bg-amber-500/10'
              : 'border-white/10 bg-card hover:border-white/20'
          }`}
        >
          <CardHeader className="p-3.5 pb-1">
            <CardDescription className="flex items-center justify-between text-xs font-medium">
              <span className={pendingChats.length > 0 ? 'text-amber-300 font-semibold' : ''}>
                Pendentes
              </span>
              <Clock className="h-3.5 w-3.5 text-amber-400" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="text-xl font-bold tracking-tight text-foreground">{pendingChats.length}</div>
            <p className="text-[10px] text-muted-foreground">Aguardando</p>
          </CardContent>
        </Card>

        {/* Rodadas */}
        <Card className="border-white/10 bg-card">
          <CardHeader className="p-3.5 pb-1">
            <CardDescription className="flex items-center justify-between text-xs font-medium">
              <span>Rodadas</span>
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="text-xl font-bold tracking-tight text-foreground">
              {data?.rounds?.length || 0}
            </div>
            <p className="text-[10px] text-muted-foreground">Disparos feitos</p>
          </CardContent>
        </Card>

        {/* Taxa de Entrega */}
        <Card className="border-white/10 bg-card">
          <CardHeader className="p-3.5 pb-1">
            <CardDescription className="flex items-center justify-between text-xs font-medium">
              <span>Entregas</span>
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="text-xl font-bold tracking-tight text-foreground">
              {lastDelivery?.sent ?? 0}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {lastDelivery?.total ? `de ${lastDelivery.total} na última` : 'Nenhum envio'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Alert */}
      {pendingChats.length > 0 && (
        <div
          onClick={() => onNavigateTab('chats', 'pending')}
          className="group flex cursor-pointer items-center justify-between rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 shadow-sm transition-all hover:border-amber-400"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-amber-200">
                {pendingChats.length} {pendingChats.length === 1 ? 'canal pendente' : 'canais pendentes'}
              </h4>
              <p className="text-[11px] text-amber-300/80">
                Toque para revisar solicitações pendentes de aprovação.
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-amber-400 transition-transform group-hover:translate-x-1" />
        </div>
      )}

      {/* Automations Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Envio */}
        <Card className="border-white/10 bg-card">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Send className="h-3.5 w-3.5 text-primary" />
                Envio Programado
              </CardTitle>
              <Badge variant={schedule?.enabled ? 'success' : 'secondary'} className="text-[10px]">
                {schedule?.enabled ? 'Ativado' : 'Desativado'}
              </Badge>
            </div>
            <CardDescription className="text-[11px]">
              {schedule?.enabled
                ? schedule.mode === 'fixed'
                  ? `Horários: ${schedule.times?.join(', ') || '—'}`
                  : `A cada ${schedule.minutes} minutos`
                : 'Envios automáticos desligados'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2.5">
            <div className="flex items-center justify-between rounded-xl bg-white/5 p-2.5 border border-white/10 text-xs">
              <span className="text-muted-foreground">Próximo envio:</span>
              <span className="font-semibold text-foreground">
                {schedule?.enabled ? displayDate(schedule.nextAt) : '—'}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateTab('schedule')}
              className="w-full text-xs h-8 border-white/10"
            >
              Configurar horários de envio
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </CardContent>
        </Card>

        {/* Remoção */}
        <Card className="border-white/10 bg-card">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                Remoção Programada
              </CardTitle>
              <Badge variant={removalSchedule?.enabled ? 'destructive' : 'secondary'} className="text-[10px]">
                {removalSchedule?.enabled ? 'Ativado' : 'Desativado'}
              </Badge>
            </div>
            <CardDescription className="text-[11px]">
              {removalSchedule?.enabled
                ? removalSchedule.mode === 'fixed'
                  ? `Exclusão: ${removalSchedule.times?.join(', ') || '—'}`
                  : `A cada ${removalSchedule.minutes} minutos`
                : 'Limpeza automática desligada'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2.5">
            <div className="flex items-center justify-between rounded-xl bg-white/5 p-2.5 border border-white/10 text-xs">
              <span className="text-muted-foreground">Próxima exclusão:</span>
              <span className="font-semibold text-foreground">
                {removalSchedule?.enabled ? displayDate(removalSchedule.nextAt) : '—'}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmRemoveOpen(true)}
              className="w-full text-xs h-8 text-rose-400 border-white/10 hover:bg-rose-500/10"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1 text-rose-400" />
              Remover listas agora
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Promo Spotlight Banner / Tutorial */}
      <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3.5 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-md">
            <Radio className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              Divulgações no Canal &amp; Grupo de Logs
              <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-semibold text-primary">Novo</span>
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Divulgação avulsa com mídia, moderação no grupo e post interativo.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            haptic('selection');
            setPromoTutorialOpen(true);
          }}
          className="shrink-0 text-xs font-semibold h-8 border-primary/30 text-primary hover:bg-primary/20"
        >
          <BookOpen className="h-3.5 w-3.5 mr-1" />
          Como Usar
        </Button>
      </div>

      {/* Confirmation Dialog: Send */}
      <Dialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <DialogHeader>
          <DialogTitle>Disparar Lista Agora?</DialogTitle>
          <DialogDescription>
            A lista atual com {approvedChats.length} canais ativos será enviada para todos os participantes.
          </DialogDescription>
        </DialogHeader>
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

      {/* Confirmation Dialog: Remove */}
      <Dialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
        <DialogHeader>
          <DialogTitle>Remover Listas Enviadas?</DialogTitle>
          <DialogDescription>
            Essa ação apagará imediatamente as últimas mensagens da lista enviadas pelo bot.
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

      {/* Tutorial Dialog: Standalone Promotions */}
      <Dialog open={promoTutorialOpen} onOpenChange={setPromoTutorialOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Radio className="h-4 w-4 text-primary" />
            Divulgações Exclusivas no Canal
          </DialogTitle>
          <DialogDescription>
            Tutorial de configuração e uso da nova ferramenta independente da lista.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs text-foreground">
          <div className="rounded-xl bg-black/20 p-3 border border-white/10 space-y-1">
            <h5 className="font-semibold text-primary flex items-center gap-1.5">
              <span>⚙️</span> 1. Configuração do Administrador
            </h5>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              • <b>Grupo de Logs:</b> Adicione o bot no seu grupo e envie <code>/setlogs</code>. Se o grupo for fórum, o tópico <i>Divulgações pendentes</i> é criado na hora.<br />
              • <b>Canal de Divulgação:</b> Adicione o bot como admin no canal de postagem e envie <code>/setcanal</code> (ou <code>/setcanal -100xxx</code>).
            </p>
          </div>

          <div className="rounded-xl bg-black/20 p-3 border border-white/10 space-y-1">
            <h5 className="font-semibold text-primary flex items-center gap-1.5">
              <span>👤</span> 2. Como os Usuários Enviam
            </h5>
            <p className="text-muted-foreground text-[11px]">
              O usuário envia no privado do bot o modelo abaixo (em texto ou como legenda de foto/vídeo/gif):
            </p>
            <pre className="rounded-lg bg-black/40 p-2 font-mono text-[11px] select-all overflow-x-auto text-emerald-400">
{`🆔 -100xxxxxxxxxx
🌐 Nome do Canal/Grupo
📝 Breve descrição sobre o canal
📌 Categoria: #tags #tema
🔗 https://t.me/seulink`}
            </pre>
            <p className="text-muted-foreground text-[11px]">
              Depois, envia <b>/divulgar</b> para encaminhar aos moderadores.
            </p>
          </div>

          <div className="rounded-xl bg-black/20 p-3 border border-white/10 space-y-1">
            <h5 className="font-semibold text-primary flex items-center gap-1.5">
              <span>⚖️</span> 3. Moderação e Publicação
            </h5>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Os administradores avaliam no tópico de logs com botões <b>Aprovar</b> e <b>Desaprovar</b>. Ao aprovar, o bot posta no canal vinculado com a mídia, título em negrito, descrição em blockquote, tags e botões interativos com link direto!
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="primary" onClick={() => setPromoTutorialOpen(false)} className="w-full text-xs">
            Entendido!
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
