import * as React from 'react';
import {
  Clock,
  Send,
  Trash2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Radio,
  Zap,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { Switch } from './ui/Switch';
import { useToast } from './ui/Toast';
import { callEndpoint, saveSettingsSafe, haptic } from '@/lib/telegram';
import { displayDate, formatDate } from '@/lib/utils';

export function ScheduleTab({ data, onRefresh, isDemo, onSyncVersion }) {
  const { toast } = useToast();

  const settings = data?.settings || {};
  const initialSchedule = settings.schedule || {
    enabled: false,
    mode: 'fixed',
    minutes: 60,
    times: ['08:00', '20:00'],
  };
  const initialRemoval = settings.removalSchedule || {
    enabled: false,
    mode: 'fixed',
    minutes: 60,
    times: ['06:00', '18:00'],
  };

  // Broadcast state
  const [sendEnabled, setSendEnabled] = React.useState(Boolean(initialSchedule.enabled));
  const [sendMode, setSendMode] = React.useState(initialSchedule.mode || 'fixed');
  const [sendMinutes, setSendMinutes] = React.useState(initialSchedule.minutes || 60);
  const [sendTimes, setSendTimes] = React.useState((initialSchedule.times || []).join(', '));
  const [savingSend, setSavingSend] = React.useState(false);

  // Removal state
  const [remEnabled, setRemEnabled] = React.useState(Boolean(initialRemoval.enabled));
  const [remMode, setRemMode] = React.useState(initialRemoval.mode || 'fixed');
  const [remMinutes, setRemMinutes] = React.useState(initialRemoval.minutes || 60);
  const [remTimes, setRemTimes] = React.useState((initialRemoval.times || []).join(', '));
  const [savingRem, setSavingRem] = React.useState(false);

  // Actions state
  const [triggeringSend, setTriggeringSend] = React.useState(false);
  const [triggeringRem, setTriggeringRem] = React.useState(false);
  const [triggeringTest, setTriggeringTest] = React.useState(false);

  const isOnline = data?.schedulerHeartbeat && Date.now() - data.schedulerHeartbeat < 120000;

  const handleSaveSendSchedule = async (e) => {
    e?.preventDefault();
    const timesArray = sendTimes
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (sendMode === 'fixed' && !timesArray.length) {
      toast('Informe pelo menos um horário diário (ex: 08:00, 20:00)', 'error');
      return;
    }

    if (isDemo) {
      toast('Agendamento de envios salvo! (Modo Demo)', 'success');
      return;
    }

    try {
      setSavingSend(true);
      haptic('medium');
      const updated = {
        ...settings,
        schedule: {
          ...initialSchedule,
          enabled: sendEnabled,
          mode: sendMode,
          minutes: Number(sendMinutes),
          times: timesArray,
        },
      };
      await saveSettingsSafe(updated, data?.version, onSyncVersion);
      toast('Agendamento de envios salvo com sucesso!', 'success');
      onRefresh?.();
    } catch (err) {
      toast(err.message || 'Falha ao salvar agendamento', 'error');
    } finally {
      setSavingSend(false);
    }
  };

  const handleSaveRemovalSchedule = async (e) => {
    e?.preventDefault();
    const timesArray = remTimes
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (remMode === 'fixed' && !timesArray.length) {
      toast('Informe pelo menos um horário de remoção (ex: 06:00, 18:00)', 'error');
      return;
    }

    if (isDemo) {
      toast('Agendamento de remoções salvo! (Modo Demo)', 'success');
      return;
    }

    try {
      setSavingRem(true);
      haptic('medium');
      const updated = {
        ...settings,
        removalSchedule: {
          ...initialRemoval,
          enabled: remEnabled,
          mode: remMode,
          minutes: Number(remMinutes),
          times: timesArray,
        },
      };
      await saveSettingsSafe(updated, data?.version, onSyncVersion);
      toast('Agendamento de remoção salvo com sucesso!', 'success');
      onRefresh?.();
    } catch (err) {
      toast(err.message || 'Falha ao salvar remoção', 'error');
    } finally {
      setSavingRem(false);
    }
  };

  const handleSendNow = async () => {
    if (isDemo) {
      toast('Modo Demo: envio disparado!', 'info');
      return;
    }
    try {
      setTriggeringSend(true);
      haptic('heavy');
      await callEndpoint('sendNow', {});
      toast('Disparo da lista iniciado!', 'success');
      onRefresh?.();
    } catch (err) {
      toast(err.message || 'Falha ao disparar', 'error');
    } finally {
      setTriggeringSend(false);
    }
  };

  const handleRemoveNow = async () => {
    if (isDemo) {
      toast('Modo Demo: listas removidas!', 'info');
      return;
    }
    try {
      setTriggeringRem(true);
      haptic('heavy');
      const res = await callEndpoint('removeNow', {});
      toast(`Listas removidas: ${res?.deletedCount || 0} mensagens apagadas.`, 'success');
      onRefresh?.();
    } catch (err) {
      toast(err.message || 'Falha ao remover listas', 'error');
    } finally {
      setTriggeringRem(false);
    }
  };

  const handleTestList = async () => {
    if (isDemo) {
      toast('Modo Demo: teste enviado ao seu privado!', 'info');
      return;
    }
    try {
      setTriggeringTest(true);
      haptic('light');
      await callEndpoint('testList', {});
      toast('Lista de teste enviada ao seu chat privado!', 'success');
    } catch (err) {
      toast(err.message || 'Falha ao enviar teste', 'error');
    } finally {
      setTriggeringTest(false);
    }
  };

  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-300">
      {/* Top Banner Quick Actions */}
      <Card className="border-white/10 bg-card">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Disparos Manuais Imediatos
            </span>
            <Badge variant="outline" className="text-xs font-mono border-white/10">
              Brasília (UTC−3)
            </Badge>
          </CardTitle>
          <CardDescription>
            Envie ou exclua as listas dos canais e grupos participantes a qualquer momento.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSendNow}
              disabled={triggeringSend}
              className="h-8 text-xs font-semibold"
            >
              <Send className="h-3.5 w-3.5" />
              {triggeringSend ? 'Enviando...' : 'Disparar Lista Agora'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRemoveNow}
              disabled={triggeringRem}
              className="h-8 text-xs border-white/10 text-rose-400 hover:bg-rose-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {triggeringRem ? 'Excluindo...' : 'Excluir Listas Agora'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleTestList}
              disabled={triggeringTest}
              className="h-8 text-xs text-foreground/80 hover:text-foreground"
            >
              <Radio className="h-3.5 w-3.5 text-primary" />
              {triggeringTest ? 'Enviando...' : 'Testar no Privado'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Grid: Send Schedule & Removal Schedule */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Envio Programado Form */}
        <Card className="border-white/10 bg-card">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Send className="h-4 w-4 text-primary" />
                Agendamento de Envios
              </CardTitle>
              <Switch
                id="send-enabled"
                checked={sendEnabled}
                onChange={setSendEnabled}
              />
            </div>
            <CardDescription>
              Disparo automático da lista para os canais.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 pt-2">
            <form onSubmit={handleSaveSendSchedule} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground/80 block">Modo de envio</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSendMode('fixed')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition text-left cursor-pointer ${
                      sendMode === 'fixed'
                        ? 'border-primary bg-primary/20 text-white'
                        : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'
                    }`}
                  >
                    <strong>Horários Fixos</strong>
                    <span className="block text-[10px] opacity-70 mt-0.5">Ex: 08:00, 20:00</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSendMode('interval')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition text-left cursor-pointer ${
                      sendMode === 'interval'
                        ? 'border-primary bg-primary/20 text-white'
                        : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'
                    }`}
                  >
                    <strong>Intervalo</strong>
                    <span className="block text-[10px] opacity-70 mt-0.5">A cada X minutos</span>
                  </button>
                </div>
              </div>

              {sendMode === 'fixed' ? (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground/80">
                    Horários diários (separados por vírgula)
                  </label>
                  <Input
                    type="text"
                    value={sendTimes}
                    onChange={(e) => setSendTimes(e.target.value)}
                    placeholder="08:00, 14:00, 20:00"
                    className="h-9 bg-white/5 border-white/10"
                  />
                  <p className="text-[11px] text-muted-foreground">Horário de Brasília (UTC−3).</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground/80">Intervalo em minutos</label>
                  <Input
                    type="number"
                    min="1"
                    max="10080"
                    value={sendMinutes}
                    onChange={(e) => setSendMinutes(e.target.value)}
                    className="h-9 bg-white/5 border-white/10"
                  />
                </div>
              )}

              <div className="rounded-xl bg-white/5 p-2.5 border border-white/10 text-xs flex justify-between items-center">
                <span className="text-muted-foreground">Próximo envio:</span>
                <span className="font-semibold text-primary">
                  {sendEnabled ? displayDate(initialSchedule.nextAt) : 'Desativado'}
                </span>
              </div>

              <Button type="submit" variant="primary" className="w-full h-9" disabled={savingSend}>
                {savingSend ? 'Salvando...' : 'Salvar Envios'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Remoção Programada Form */}
        <Card className="border-white/10 bg-card">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-rose-400" />
                Remoção Automática de Listas
              </CardTitle>
              <Switch
                id="rem-enabled"
                checked={remEnabled}
                onChange={setRemEnabled}
              />
            </div>
            <CardDescription>
              Exclui a lista dos canais nos horários programados.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 pt-2">
            <form onSubmit={handleSaveRemovalSchedule} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground/80 block">Modo de remoção</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRemMode('fixed')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition text-left cursor-pointer ${
                      remMode === 'fixed'
                        ? 'border-rose-500 bg-rose-500/20 text-rose-300'
                        : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'
                    }`}
                  >
                    <strong>Horários Fixos</strong>
                    <span className="block text-[10px] opacity-70 mt-0.5">Ex: 06:00, 18:00</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRemMode('interval')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition text-left cursor-pointer ${
                      remMode === 'interval'
                        ? 'border-rose-500 bg-rose-500/20 text-rose-300'
                        : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'
                    }`}
                  >
                    <strong>Intervalo</strong>
                    <span className="block text-[10px] opacity-70 mt-0.5">A cada X minutos</span>
                  </button>
                </div>
              </div>

              {remMode === 'fixed' ? (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground/80">
                    Horários de exclusão (separados por vírgula)
                  </label>
                  <Input
                    type="text"
                    value={remTimes}
                    onChange={(e) => setRemTimes(e.target.value)}
                    placeholder="06:00, 18:00"
                    className="h-9 bg-white/5 border-white/10"
                  />
                  <p className="text-[11px] text-muted-foreground">Horário de Brasília (UTC−3).</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground/80">Intervalo em minutos</label>
                  <Input
                    type="number"
                    min="1"
                    max="10080"
                    value={remMinutes}
                    onChange={(e) => setRemMinutes(e.target.value)}
                    className="h-9 bg-white/5 border-white/10"
                  />
                </div>
              )}

              <div className="rounded-xl bg-white/5 p-2.5 border border-white/10 text-xs flex justify-between items-center">
                <span className="text-muted-foreground">Próxima exclusão:</span>
                <span className="font-semibold text-rose-400">
                  {remEnabled ? displayDate(initialRemoval.nextAt) : 'Desativado'}
                </span>
              </div>

              <Button
                type="submit"
                variant="destructive"
                className="w-full h-9"
                disabled={savingRem}
              >
                {savingRem ? 'Salvando...' : 'Salvar Remoções'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Cloudflare Worker / Cron Status Card */}
      <Card className="border-white/10 bg-card">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Status da Automação
            </span>
            <Badge variant={isOnline ? 'success' : 'warning'}>
              {isOnline ? 'Conectado e Ativo' : 'Aguardando Cron'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-1 text-xs text-muted-foreground space-y-2">
          <p>
            {isOnline
              ? 'O agendador está executando as verificações no servidor e enviando batimentos regulares.'
              : 'Para disparar com o painel fechado, ative o Worker de agendamento na Cloudflare.'}
          </p>
          <div className="flex justify-between border-t border-white/5 pt-2 text-[11px]">
            <span>Última verificação:</span>
            <span className="font-mono text-foreground">{formatDate(data?.schedulerHeartbeat)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
