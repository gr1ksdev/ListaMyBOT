import * as React from 'react';
import {
  Sliders,
  Palette,
  Pin,
  Trash2,
  Users,
  ShieldAlert,
  FlaskConical,
  Check,
  ChevronRight,
  Info,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { Switch } from './ui/Switch';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/Dialog';
import { useToast } from './ui/Toast';
import { callEndpoint, haptic } from '@/lib/telegram';
import { COLOR_OPTIONS } from '@/lib/utils';

export function SettingsTab({ data, onRefresh, isDemo, onToggleDemo }) {
  const { toast } = useToast();
  const settings = data?.settings || {};

  // Form states
  const [buttonColor, setButtonColor] = React.useState(settings.buttonColor || '');
  const [channelColor, setChannelColor] = React.useState(settings.channelColor || '');
  const [groupColor, setGroupColor] = React.useState(settings.groupColor || '');

  const [pin, setPin] = React.useState(Boolean(settings.pin));
  const [deletePrevious, setDeletePrevious] = React.useState(Boolean(settings.deletePrevious));

  const [minMembers, setMinMembers] = React.useState(settings.minMembers ?? 0);
  const [savingMin, setSavingMin] = React.useState(false);

  // Admin modal state
  const [adminModalOpen, setAdminModalOpen] = React.useState(false);
  const [adminIdsText, setAdminIdsText] = React.useState((settings.admins || []).join('\n'));
  const [savingAdmins, setSavingAdmins] = React.useState(false);

  // Sync state when data changes
  React.useEffect(() => {
    if (data?.settings) {
      setButtonColor(data.settings.buttonColor || '');
      setChannelColor(data.settings.channelColor || '');
      setGroupColor(data.settings.groupColor || '');
      setPin(Boolean(data.settings.pin));
      setDeletePrevious(Boolean(data.settings.deletePrevious));
      setMinMembers(data.settings.minMembers ?? 0);
      setAdminIdsText((data.settings.admins || []).join('\n'));
    }
  }, [data]);

  const handleSaveColor = async (field, value) => {
    if (isDemo) {
      toast(`Cor salva com sucesso! (Demo)`, 'info');
      if (field === 'buttonColor') setButtonColor(value);
      if (field === 'channelColor') setChannelColor(value);
      if (field === 'groupColor') setGroupColor(value);
      return;
    }

    try {
      haptic('selection');
      const updated = { ...settings, [field]: value };
      await callEndpoint('saveSettings', { settings: updated, version: data?.version });
      if (field === 'buttonColor') setButtonColor(value);
      if (field === 'channelColor') setChannelColor(value);
      if (field === 'groupColor') setGroupColor(value);
      toast('Cor dos botões atualizada!', 'success');
      onRefresh?.();
    } catch (err) {
      toast(err.message || 'Falha ao salvar cor', 'error');
    }
  };

  const handleTogglePin = async (checked) => {
    setPin(checked);
    if (isDemo) {
      toast(`Preferência de fixar salva (Demo)`, 'info');
      return;
    }
    try {
      haptic('selection');
      const updated = { ...settings, pin: checked };
      await callEndpoint('saveSettings', { settings: updated, version: data?.version });
      toast('Preferência de fixar salva!', 'success');
      onRefresh?.();
    } catch (err) {
      setPin(!checked);
      toast(err.message || 'Falha ao salvar preferência', 'error');
    }
  };

  const handleToggleDelete = async (checked) => {
    setDeletePrevious(checked);
    if (isDemo) {
      toast(`Preferência de apagar anterior salva (Demo)`, 'info');
      return;
    }
    try {
      haptic('selection');
      const updated = { ...settings, deletePrevious: checked };
      await callEndpoint('saveSettings', { settings: updated, version: data?.version });
      toast('Preferência de exclusão salva!', 'success');
      onRefresh?.();
    } catch (err) {
      setDeletePrevious(!checked);
      toast(err.message || 'Falha ao salvar preferência', 'error');
    }
  };

  const handleSaveMinMembers = async (e) => {
    e?.preventDefault();
    if (isDemo) {
      toast('Mínimo de membros salvo! (Demo)', 'info');
      return;
    }
    try {
      setSavingMin(true);
      haptic('medium');
      const updated = { ...settings, minMembers: Number(minMembers) };
      await callEndpoint('saveSettings', { settings: updated, version: data?.version });
      toast('Regra de membros mínimos salva!', 'success');
      onRefresh?.();
    } catch (err) {
      toast(err.message || 'Falha ao salvar mínimo', 'error');
    } finally {
      setSavingMin(false);
    }
  };

  const handleSaveAdmins = async (e) => {
    e?.preventDefault();
    const ids = adminIdsText
      .split(/[\s,]+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map(Number);

    if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      toast('Informe IDs numéricos válidos.', 'error');
      return;
    }

    if (isDemo) {
      toast('Administradores salvos! (Demo)', 'info');
      setAdminModalOpen(false);
      return;
    }

    try {
      setSavingAdmins(true);
      haptic('medium');
      const updated = { ...settings, admins: ids };
      await callEndpoint('saveSettings', { settings: updated, version: data?.version });
      toast('Administradores autorizados atualizados!', 'success');
      setAdminModalOpen(false);
      onRefresh?.();
    } catch (err) {
      toast(err.message || 'Falha ao salvar administradores', 'error');
    } finally {
      setSavingAdmins(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      {/* 1. Cores dos Botões no Telegram */}
      <Card className="border-slate-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4 text-sky-400" />
            Cores dos Botões no Telegram
          </CardTitle>
          <CardDescription>
            Defina o padrão de cores aplicado nos botões inline da lista enviada aos chats.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cor Global */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Cor Global (todos os botões)</span>
              <span className="text-slate-400">Padrão para canais e grupos</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSaveColor('buttonColor', opt.value)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    buttonColor === opt.value
                      ? 'border-sky-500 bg-sky-500/20 text-sky-300 font-bold'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cor para Canais */}
          <div className="space-y-2 border-t border-slate-800/80 pt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Cor específica para Canais</span>
              <span className="text-slate-400">Sobrescreve a cor global</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: '', label: 'Herda global' },
                { value: 'primary', label: 'Azul' },
                { value: 'success', label: 'Verde' },
                { value: 'danger', label: 'Vermelho' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSaveColor('channelColor', opt.value)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    channelColor === opt.value
                      ? 'border-sky-500 bg-sky-500/20 text-sky-300 font-bold'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cor para Grupos */}
          <div className="space-y-2 border-t border-slate-800/80 pt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Cor específica para Grupos</span>
              <span className="text-slate-400">Sobrescreve a cor global</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: '', label: 'Herda global' },
                { value: 'primary', label: 'Azul' },
                { value: 'success', label: 'Verde' },
                { value: 'danger', label: 'Vermelho' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSaveColor('groupColor', opt.value)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    groupColor === opt.value
                      ? 'border-sky-500 bg-sky-500/20 text-sky-300 font-bold'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Opções de Publicação (Switches) */}
      <Card className="border-slate-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Pin className="h-4 w-4 text-sky-400" />
            Preferências de Publicação
          </CardTitle>
          <CardDescription>
            Comportamentos executados durante cada rodada de disparo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-slate-950 p-3.5 border border-slate-800">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-slate-200 block">
                Fixar nova lista automaticamente (Pin)
              </span>
              <span className="text-[11px] text-slate-400">
                Fixa a mensagem da lista no topo dos canais e supergrupos participantes.
              </span>
            </div>
            <Switch checked={pin} onChange={handleTogglePin} />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-slate-950 p-3.5 border border-slate-800">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-slate-200 block">
                Apagar mensagem da lista anterior
              </span>
              <span className="text-[11px] text-slate-400">
                Remove a última mensagem antes de postar a nova rodada.
              </span>
            </div>
            <Switch checked={deletePrevious} onChange={handleToggleDelete} />
          </div>
        </CardContent>
      </Card>

      {/* 3. Mínimo de Membros */}
      <Card className="border-slate-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-sky-400" />
            Filtro de Membros Mínimos
          </CardTitle>
          <CardDescription>
            Quantidade mínima de membros para aceitar o canal/grupo na rede.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveMinMembers} className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                max="100000000"
                value={minMembers}
                onChange={(e) => setMinMembers(e.target.value)}
                placeholder="Ex: 100"
                className="max-w-[160px]"
              />
              <Button type="submit" variant="primary" disabled={savingMin}>
                {savingMin ? 'Salvando...' : 'Salvar Mínimo'}
              </Button>
            </div>
            <p className="text-[11px] text-slate-400">
              Informe 0 para desativar a exigência de membros.
            </p>
          </form>
        </CardContent>
      </Card>

      {/* 4. Administradores & Modo de Demonstração */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Administradores */}
        <Card
          onClick={() => setAdminModalOpen(true)}
          className="cursor-pointer border-slate-800 hover:border-sky-500/40 transition hover:bg-slate-900/90"
        >
          <CardHeader className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-sky-400">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-100">Administradores</h4>
                  <p className="text-[11px] text-slate-400">
                    {(settings.admins || []).length} autorizado(s)
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>
          </CardHeader>
        </Card>

        {/* Modo Demo */}
        <Card
          onClick={onToggleDemo}
          className={`cursor-pointer border-slate-800 transition ${
            isDemo ? 'border-amber-500/50 bg-amber-950/20' : 'hover:border-slate-700'
          }`}
        >
          <CardHeader className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    isDemo ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <FlaskConical className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-100">
                    {isDemo ? 'Sair do Modo Demo' : 'Modo de Testes (Demo)'}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {isDemo ? 'Ativo com 20 canais fictícios' : 'Simule 20 canais sem alterar banco'}
                  </p>
                </div>
              </div>
              <Badge variant={isDemo ? 'warning' : 'outline'}>{isDemo ? 'Ativo' : 'Testar'}</Badge>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Modal: Administradores */}
      <Dialog open={adminModalOpen} onOpenChange={setAdminModalOpen}>
        <DialogHeader>
          <DialogTitle>Gerenciar Administradores</DialogTitle>
          <DialogDescription>
            Lista de Telegram User IDs autorizados a acessar este painel e moderar a lista.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSaveAdmins} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              IDs de Usuários (um por linha)
            </label>
            <textarea
              rows={6}
              value={adminIdsText}
              onChange={(e) => setAdminIdsText(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="7595607953&#10;123456789"
            />
            <p className="text-[11px] text-slate-400">
              O administrador proprietário do bot é protegido e permanece sempre autorizado.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAdminModalOpen(false)}
              disabled={savingAdmins}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={savingAdmins}>
              {savingAdmins ? 'Salvando...' : 'Salvar Administradores'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
