import * as React from 'react';
import {
  Clock,
  Send,
  Trash2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Radio,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { Switch } from './ui/Switch';
import { useToast } from './ui/Toast';
import { callEndpoint, haptic } from '@/lib/telegram';
import { displayDate, formatDate } from '@/lib/utils';

export function ScheduleTab({ data, onRefresh, isDemo }) {
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
      toast('Agendamento de envios salvo com sucesso! (Modo Demo)', 'success');
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
      await callEndpoint('saveSettings', { settings: updated, version: data?.version });
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
      toast('Informe pelo menos um horário diário de remoção (ex: 06:00, 18:00)', 'error');
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
      await callEndpoint('saveSettings', { settings: updated, version: data?.version });
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
      toast('Modo Demo: teste enviado para seu privado!', 'info');
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
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      {/* Top Banner Quick Actions */}
      <Card className="border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-sky-400" />
              Disparos Manuais Imediatos
            </span>
            <Badge variant="outline" className="text-xs font-mono">
              Brasília (UTC−3)
            </Badge>
          </CardTitle>
          <CardDescription>
            Envie ou exclua as listas dos canais e grupos aprovados a qualquer momento.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSendNow}
              disabled={triggeringSend}
              className="shadow-sm shadow-sky-500/20"
            >
              <Send className="h-3.5 w-3.5" />
              {triggeringSend ? 'Enviando...' : 'Disparar Lista Agora'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRemoveNow}
              disabled={triggeringRem}
              className="border-slate-700 text-rose-400 hover:bg-rose-950/30 hover:border-rose-800"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {triggeringRem ? 'Excluindo...' : 'Excluir Listas Agora'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleTestList}
              disabled={triggeringTest}
              className="text-slate-300 hover:text-white"
            >
              <Radio className="h-3.5 w-3.5 text-sky-400" />
              {triggeringTest ? 'Enviando...' : 'Testar no Privado'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Grid: Send Schedule & Removal Schedule */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Envio Programado Form */}
        <Card className="border-slate-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4 text-sky-400" />
                Agendamento de Envios
              </CardTitle>
              <Switch
                id="send-enabled"
                checked={sendEnabled}
                onChange={setSendEnabled}
              />
            </div>
            <CardDescription>
              Disparo automático da lista para os canais participantes.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSaveSendSchedule} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">Modo de envio</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSendMode('fixed')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition text-left cursor-pointer ${
                      sendMode === 'fixed'
                        ? 'border-sky-500 bg-sky-500/15 text-sky-300'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <strong>Horários Fixos</strong>
                    <span className="block text-[10px] text-slate-400 mt-0.5">Ex: 08:00, 20:00</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSendMode('interval')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition text-left cursor-pointer ${
                      sendMode === 'interval'
                        ? 'border-sky-500 bg-sky-500/15 text-sky-300'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <strong>Intervalo</strong>
                    <span className="block text-[10px] text-slate-400 mt-0.5">A cada X minutos</span>
                  </button>
                </div>
              </div>

              {sendMode === 'fixed' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Horários diários (separados por vírgula)
                  </label>
                  <Input
                    type="text"
                    value={sendTimes}
                    onChange={(e) => setSendTimes(e.target.value)}
                    placeholder="08:00, 14:00, 20:00"
                  />
                  <p className="text-[11px] text-slate-400">Horário oficial de Brasília (UTC−3).</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Intervalo em minutos</label>
                  <Input
                    type="number"
                    min="1"
                    max="10080"
                    value={sendMinutes}
                    onChange={(e) => setSendMinutes(e.target.value)}
                  />
                </div>
              )}

              <div className="rounded-xl bg-slate-950 p-3 border border-slate-800 text-xs flex justify-between items-center">
                <span className="text-slate-400">Próximo envio estimado:</span>
                <span className="font-semibold text-sky-400">
                  {sendEnabled ? displayDate(initialSchedule.nextAt) : 'Desativado'}
                </span>
              </div>

              <Button type="submit" variant="primary" className="w-full" disabled={savingSend}>
                {savingSend ? 'Salvando...' : 'Salvar Agendamento de Envios'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Remoção Programada Form */}
        <Card className="border-slate-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
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
              Exclui a lista enviada nos canais participantes após certo período.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSaveRemovalSchedule} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">Modo de remoção</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRemMode('fixed')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition text-left cursor-pointer ${
                      remMode === 'fixed'
                        ? 'border-rose-500 bg-rose-500/15 text-rose-300'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <strong>Horários Fixos</strong>
                    <span className="block text-[10px] text-slate-400 mt-0.5">Ex: 06:00, 18:00</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRemMode('interval')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition text-left cursor-pointer ${
                      remMode === 'interval'
                        ? 'border-rose-500 bg-rose-500/15 text-rose-300'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <strong>Intervalo</strong>
                    <span className="block text-[10px] text-slate-400 mt-0.5">A cada X minutos</span>
                  </button>
                </div>
              </div>

              {remMode === 'fixed' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Horários de exclusão (separados por vírgula)
                  </label>
                  <Input
                    type="text"
                    value={remTimes}
                    onChange={(e) => setRemTimes(e.target.value)}
                    placeholder="06:00, 18:00"
                  />
                  <p className="text-[11px] text-slate-400">Horário oficial de Brasília (UTC−3).</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Intervalo em minutos</label>
                  <Input
                    type="number"
                    min="1"
                    max="10080"
                    value={remMinutes}
                    onChange={(e) => setRemMinutes(e.target.value)}
                  />
                </div>
              )}

              <div className="rounded-xl bg-slate-950 p-3 border border-slate-800 text-xs flex justify-between items-center">
                <span className="text-slate-400">Próxima exclusão estimada:</span>
                <span className="font-semibold text-rose-400">
                  {remEnabled ? displayDate(initialRemoval.nextAt) : 'Desativado'}
                </span>
              </div>

              <Button
                type="submit"
                variant="destructive"
                className="w-full"
                disabled={savingRem}
              >
                {savingRem ? 'Salvando...' : 'Salvar Agendamento de Remoções'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Cloudflare Worker / Cron Status Card */}
      <Card className="border-slate-800">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-sky-400" />
              Status do Serviço de Automação
            </span>
            <Badge variant={isOnline ? 'success' : 'warning'}>
              {isOnline ? 'Conectado e Ativo' : 'Aguardando Cron'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-1 text-xs text-slate-400 space-y-2">
          <p>
            {isOnline
              ? 'O agendador está enviando batimentos regulares e executando as verificações no servidor.'
              : 'O painel e o bot funcionam normalmente. Para disparar com o painel fechado, ative o Cron / Cloudflare Worker.'}
          </p>
          <div className="flex justify-between border-t border-slate-800/80 pt-2 text-[11px]">
            <span>Última verificação registrada:</span>
            <span className="font-mono text-slate-200">{formatDate(data?.schedulerHeartbeat)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
