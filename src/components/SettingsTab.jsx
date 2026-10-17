import * as React from 'react';
import {
  Sliders,
  Palette,
  Pin,
  Trash2,
  Users,
  ShieldAlert,
  FlaskConical,
  CheckSquare,
  ChevronRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { Switch } from './ui/Switch';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/Dialog';
import { ColorPicker } from './ui/ColorPicker';
import { useToast } from './ui/Toast';
import { saveSettingsSafe, haptic } from '@/lib/telegram';

export function SettingsTab({ data, onRefresh, isDemo, onToggleDemo, onSyncVersion }) {
  const { toast } = useToast();
  const settings = data?.settings || {};

  // Form states
  const [buttonColor, setButtonColor] = React.useState(settings.buttonColor || '');
  const [channelColor, setChannelColor] = React.useState(settings.channelColor || '');
  const [groupColor, setGroupColor] = React.useState(settings.groupColor || '');

  const [approval, setApproval] = React.useState(settings.approval || 'manual');
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
      setApproval(data.settings.approval || 'manual');
      setPin(Boolean(data.settings.pin));
      setDeletePrevious(Boolean(data.settings.deletePrevious));
      setMinMembers(data.settings.minMembers ?? 0);
      setAdminIdsText((data.settings.admins || []).join('\n'));
    }
  }, [data]);

  const handleSaveColor = async (field, value) => {
    if (field === 'buttonColor') setButtonColor(value);
    if (field === 'channelColor') setChannelColor(value);
    if (field === 'groupColor') setGroupColor(value);

    if (isDemo) {
      toast('Cor salva (Demo)', 'info');
      return;
    }

    try {
      haptic('selection');
      const updated = { ...settings, [field]: value };
      await saveSettingsSafe(updated, data?.version, onSyncVersion);
      toast('Cor dos botões atualizada!', 'success');
      onRefresh?.();
    } catch (err) {
      toast(err.message || 'Falha ao salvar cor', 'error');
    }
  };

  const handleToggleApproval = async (mode) => {
    setApproval(mode);
    if (isDemo) {
      toast(`Modo de aprovação: ${mode === 'automatic' ? 'Automático' : 'Manual'} (Demo)`, 'info');
      return;
    }
    try {
      haptic('selection');
      const updated = { ...settings, approval: mode };
      await saveSettingsSafe(updated, data?.version, onSyncVersion);
      toast(`Modo de aprovação: ${mode === 'automatic' ? 'Automático' : 'Manual'}`, 'success');
      onRefresh?.();
    } catch (err) {
      toast(err.message || 'Falha ao salvar aprovação', 'error');
    }
  };

  const handleTogglePin = async (checked) => {
    setPin(checked);
    if (isDemo) {
      toast('Preferência de fixar salva (Demo)', 'info');
      return;
    }
    try {
      haptic('selection');
      const updated = { ...settings, pin: checked };
      await saveSettingsSafe(updated, data?.version, onSyncVersion);
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
      toast('Preferência de exclusão salva (Demo)', 'info');
      return;
    }
    try {
      haptic('selection');
      const updated = { ...settings, deletePrevious: checked };
      await saveSettingsSafe(updated, data?.version, onSyncVersion);
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
      await saveSettingsSafe(updated, data?.version, onSyncVersion);
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
      await saveSettingsSafe(updated, data?.version, onSyncVersion);
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
    <div className="space-y-4 pb-20 animate-in fade-in duration-300">
      {/* 1. Modo de Aprovação */}
      <Card className="border-white/10 bg-card">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-primary" />
              Modo de Aprovação de Cadastros
            </span>
          </CardTitle>
          <CardDescription>
            Como novos canais e grupos são aceitos na rede ao serem adicionados.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleToggleApproval('manual')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                approval === 'manual'
                  ? 'border-primary bg-primary/20 text-white font-semibold'
                  : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'
              }`}
            >
              <strong className="block text-xs text-foreground">Aprovação Manual</strong>
              <span className="text-[11px] opacity-75">Admin deve revisar e aprovar cada canal</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleApproval('automatic')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                approval === 'automatic'
                  ? 'border-primary bg-primary/20 text-white font-semibold'
                  : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'
              }`}
            >
              <strong className="block text-xs text-foreground">Aprovação Automática</strong>
              <span className="text-[11px] opacity-75">Canais válidos entram na lista direto</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* 2. Cores dos Botões no Telegram (Organizado com ColorPicker) */}
      <Card className="border-white/10 bg-card">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            Cores dos Botões no Telegram
          </CardTitle>
          <CardDescription>
            Personalize as cores dos botões na lista enviada aos canais e grupos.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-3.5">
          {/* Cor Global */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-foreground block">Cor Global</span>
              <span className="text-[11px] text-muted-foreground">Padrão para todos os botões</span>
            </div>
            <ColorPicker
              value={buttonColor}
              onChange={(val) => handleSaveColor('buttonColor', val)}
              inheritLabel="Padrão"
            />
          </div>

          {/* Cor para Canais */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
            <div>
              <span className="text-xs font-semibold text-foreground block">Cor para Canais</span>
              <span className="text-[11px] text-muted-foreground">Substitui apenas nos canais</span>
            </div>
            <ColorPicker
              value={channelColor}
              onChange={(val) => handleSaveColor('channelColor', val)}
              inheritLabel="Herda Global"
            />
          </div>

          {/* Cor para Grupos */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
            <div>
              <span className="text-xs font-semibold text-foreground block">Cor para Grupos</span>
              <span className="text-[11px] text-muted-foreground">Substitui apenas nos grupos</span>
            </div>
            <ColorPicker
              value={groupColor}
              onChange={(val) => handleSaveColor('groupColor', val)}
              inheritLabel="Herda Global"
            />
          </div>
        </CardContent>
      </Card>

      {/* 3. Opções de Publicação (Switches) */}
      <Card className="border-white/10 bg-card">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Pin className="h-4 w-4 text-primary" />
            Preferências de Publicação
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-white/5 p-3 border border-white/10">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-foreground block">
                Fixar nova lista (Pin)
              </span>
              <span className="text-[11px] text-muted-foreground">
                Fixa a mensagem no topo dos canais e supergrupos.
              </span>
            </div>
            <Switch checked={pin} onChange={handleTogglePin} />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-white/5 p-3 border border-white/10">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-foreground block">
                Apagar lista anterior
              </span>
              <span className="text-[11px] text-muted-foreground">
                Remove a última mensagem antes de enviar a nova rodada.
              </span>
            </div>
            <Switch checked={deletePrevious} onChange={handleToggleDelete} />
          </div>
        </CardContent>
      </Card>

      {/* 4. Mínimo de Membros */}
      <Card className="border-white/10 bg-card">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Mínimo de Membros Exigido
          </CardTitle>
          <CardDescription>
            Quantidade mínima de membros para aceitar um canal ou grupo na rede.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <form onSubmit={handleSaveMinMembers} className="space-y-2">
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                max="100000000"
                value={minMembers}
                onChange={(e) => setMinMembers(e.target.value)}
                placeholder="Ex: 100"
                className="max-w-[150px] bg-white/5 border-white/10"
              />
              <Button type="submit" variant="primary" disabled={savingMin}>
                {savingMin ? 'Salvando...' : 'Salvar Mínimo'}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Use 0 para desativar a exigência.
            </p>
          </form>
        </CardContent>
      </Card>

      {/* 5. Administradores & Modo de Demonstração */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card
          onClick={() => setAdminModalOpen(true)}
          className="cursor-pointer border-white/10 bg-card hover:border-white/20 transition"
        >
          <CardHeader className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-primary">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Administradores</h4>
                  <p className="text-[11px] text-muted-foreground">
                    {(settings.admins || []).length} autorizado(s)
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 opacity-50" />
            </div>
          </CardHeader>
        </Card>

        <Card
          onClick={onToggleDemo}
          className={`cursor-pointer border-white/10 bg-card transition ${
            isDemo ? 'border-amber-500/50 bg-amber-500/10' : 'hover:border-white/20'
          }`}
        >
          <CardHeader className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    isDemo ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-muted-foreground'
                  }`}
                >
                  <FlaskConical className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    {isDemo ? 'Sair do Modo Demo' : 'Modo de Testes (Demo)'}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    {isDemo ? '20 canais simulados' : 'Simule sem alterar banco'}
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
            Lista de Telegram User IDs autorizados a acessar este painel.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSaveAdmins} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground/80">
              IDs de Usuários (um por linha)
            </label>
            <textarea
              rows={6}
              value={adminIdsText}
              onChange={(e) => setAdminIdsText(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-background p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="7595607953&#10;123456789"
            />
            <p className="text-[11px] text-muted-foreground">
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
