import * as React from 'react';
import {
  Sliders,
  Palette,
  Pin,
  Trash2,
  Users,
  ShieldAlert,
  Shield,
  Crown,
  UserPlus,
  Plus,
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

const BOT_OWNER_IDS = [7595607953, 8474484790];
const isOwnerId = (id) => BOT_OWNER_IDS.includes(Number(id));

export function SettingsTab({ data, onRefresh, isDemo, onToggleDemo, onSyncVersion }) {
  const { toast } = useToast();
  const settings = data?.settings || {};

  // Form states
  const [buttonColor, setButtonColor] = React.useState(settings.buttonColor || '');
  const [channelColor, setChannelColor] = React.useState(settings.channelColor || '');
  const [groupColor, setGroupColor] = React.useState(settings.groupColor || '');

  const [listType, setListType] = React.useState(settings.listType || 'mixed');
  const [approval, setApproval] = React.useState(settings.approval || 'manual');
  const [pin, setPin] = React.useState(Boolean(settings.pin));
  const [deletePrevious, setDeletePrevious] = React.useState(Boolean(settings.deletePrevious));

  const [minMembers, setMinMembers] = React.useState(settings.minMembers ?? 0);
  const [savingMin, setSavingMin] = React.useState(false);

  // Admin management state
  const [adminModalOpen, setAdminModalOpen] = React.useState(false);
  const [adminList, setAdminList] = React.useState(
    (settings.admins || []).filter((id) => !isOwnerId(id))
  );
  const [newAdminInput, setNewAdminInput] = React.useState('');
  const [savingAdmins, setSavingAdmins] = React.useState(false);

  // Sync state when data changes
  React.useEffect(() => {
    if (data?.settings) {
      setButtonColor(data.settings.buttonColor || '');
      setChannelColor(data.settings.channelColor || '');
      setGroupColor(data.settings.groupColor || '');
      setListType(data.settings.listType || 'mixed');
      setApproval(data.settings.approval || 'manual');
      setPin(Boolean(data.settings.pin));
      setDeletePrevious(Boolean(data.settings.deletePrevious));
      setMinMembers(data.settings.minMembers ?? 0);
      setAdminList(
        (data.settings.admins || []).filter((id) => !isOwnerId(id))
      );
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

  const handleToggleListType = async (type) => {
    setListType(type);
    if (isDemo) {
      toast(`Tipo de lista: ${type === 'simple' ? 'Lista Simples' : 'Lista Mista'} (Demo)`, 'info');
      return;
    }
    try {
      haptic('selection');
      const updated = { ...settings, listType: type };
      await saveSettingsSafe(updated, data?.version, onSyncVersion);
      toast(
        `Tipo de lista: ${type === 'simple' ? 'Lista Simples (Dividida)' : 'Lista Mista (Canais + Grupos)'}`,
        'success'
      );
      onRefresh?.();
    } catch (err) {
      toast(err.message || 'Falha ao salvar tipo de lista', 'error');
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

  const isCurrentUserOwner = isOwnerId(data?.id);

  const saveAdminsToBackend = async (nextList) => {
    if (isDemo) {
      toast('Administradores atualizados! (Demo)', 'info');
      return true;
    }
    try {
      setSavingAdmins(true);
      haptic('medium');
      const allAdmins = [...new Set([...BOT_OWNER_IDS, ...nextList])];
      const updated = { ...settings, admins: allAdmins };
      await saveSettingsSafe(updated, data?.version, onSyncVersion);
      toast('Administradores atualizados com sucesso!', 'success');
      onRefresh?.();
      return true;
    } catch (err) {
      toast(err.message || 'Falha ao salvar administradores', 'error');
      setAdminList(
        (data?.settings?.admins || []).filter((id) => !isOwnerId(id))
      );
      return false;
    } finally {
      setSavingAdmins(false);
    }
  };

  const handleAddAdmin = async (e) => {
    e?.preventDefault();
    if (!isCurrentUserOwner && !isDemo) {
      toast('Apenas os proprietários (Owners) podem cadastrar administradores.', 'error');
      return;
    }

    const clean = newAdminInput.trim().replace(/^@/, '');
    const id = Number(clean);

    if (!clean || !Number.isSafeInteger(id) || id <= 0) {
      toast('Informe um ID de usuário numérico válido.', 'error');
      return;
    }

    if (isOwnerId(id)) {
      toast('Este ID é um proprietário (Owner) permanente do bot!', 'warning');
      setNewAdminInput('');
      return;
    }

    if (adminList.includes(id)) {
      toast('Este ID já está cadastrado como administrador.', 'warning');
      return;
    }

    if (adminList.length >= 18) {
      toast('Limite máximo de 20 administradores atingido.', 'error');
      return;
    }

    const nextList = [...adminList, id];
    setAdminList(nextList);
    setNewAdminInput('');
    await saveAdminsToBackend(nextList);
  };

  const handleRemoveAdmin = async (idToRemove) => {
    if (!isCurrentUserOwner && !isDemo) {
      toast('Apenas os proprietários (Owners) podem remover administradores.', 'error');
      return;
    }

    if (isOwnerId(idToRemove)) {
      toast('Os proprietários (Owners) não podem ser removidos!', 'error');
      return;
    }
    const nextList = adminList.filter((id) => id !== idToRemove);
    setAdminList(nextList);
    await saveAdminsToBackend(nextList);
  };

  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-300">
      {/* 0. Tipo de Entrega da Lista (Mista vs Simples) */}
      <Card className="border-white/10 bg-card">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-primary" />
              Tipo de Entrega da Lista
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {listType === 'simple' ? 'Lista Simples' : 'Lista Mista'}
            </Badge>
          </CardTitle>
          <CardDescription>
            Escolha como canais e grupos receberão as publicações oficiais da comunidade.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleToggleListType('mixed')}
              className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                listType === 'mixed'
                  ? 'border-primary bg-primary/20 text-white font-semibold ring-1 ring-primary/40'
                  : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <strong className="block text-xs text-foreground">🔄 Lista Mista</strong>
                {listType === 'mixed' && (
                  <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded-full font-bold">
                    Ativa
                  </span>
                )}
              </div>
              <span className="text-[11px] opacity-75 leading-relaxed">
                Canais e grupos juntos na mesma lista final que será entregue para ambos.
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleListType('simple')}
              className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                listType === 'simple'
                  ? 'border-primary bg-primary/20 text-white font-semibold ring-1 ring-primary/40'
                  : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <strong className="block text-xs text-foreground">📑 Lista Simples</strong>
                {listType === 'simple' && (
                  <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded-full font-bold">
                    Ativa
                  </span>
                )}
              </div>
              <span className="text-[11px] opacity-75 leading-relaxed">
                Tudo dividido: grupos recebem uma lista só de grupos e canais uma lista só de canais.
              </span>
            </button>
          </div>
        </CardContent>
      </Card>

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
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                  <Crown className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Administradores</h4>
                  <p className="text-[11px] text-muted-foreground">
                    👑 2 Donos {adminList.length > 0 ? `+ ${adminList.length} admin(s)` : '(Mestres)'}
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

      {/* Modal: Administradores em Cards */}
      <Dialog open={adminModalOpen} onOpenChange={setAdminModalOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-400" />
            Gerenciar Administradores
          </DialogTitle>
          <DialogDescription>
            Controle de acesso ao painel e permissões de gerenciamento do bot.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Card: Owners Permanentes */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Proprietários do Bot ({BOT_OWNER_IDS.length})
            </span>
            <div className="space-y-2">
              {BOT_OWNER_IDS.map((ownerId) => (
                <div
                  key={ownerId}
                  className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-center justify-between shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                      <Crown className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">Proprietário (Owner)</span>
                        <Badge variant="warning" className="text-[10px] py-0 px-1.5 font-medium">
                          👑 Dono
                        </Badge>
                      </div>
                      <p className="font-mono text-xs text-amber-300 font-semibold mt-0.5">
                        ID: {ownerId}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Acesso mestre permanente ao bot e ao painel. Não pode ser removido.
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[11px] text-amber-400/80 border-amber-500/30 shrink-0">
                    Fixo
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Cards: Administradores Adicionais */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Administradores Adicionais ({adminList.length})
              </span>
              <span className="text-[10px] text-muted-foreground">
                Acesso ao painel
              </span>
            </div>

            {adminList.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-5 text-center bg-white/[0.02]">
                <Shield className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1.5" />
                <p className="text-xs font-medium text-foreground/80">
                  Nenhum administrador adicional
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Adicione novos administradores pelo campo abaixo.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {adminList.map((adminId) => (
                  <div
                    key={adminId}
                    className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center justify-between hover:border-white/20 transition group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                        <Shield className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-foreground">
                            {adminId}
                          </span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-primary border-primary/30">
                            Admin
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Acesso completo a aprovações, configurações e moderação
                        </p>
                      </div>
                    </div>
                    {isCurrentUserOwner || isDemo ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAdmin(adminId)}
                        disabled={savingAdmins}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 px-2.5 flex items-center gap-1 shrink-0 transition"
                        title="Remover Administrador"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="text-xs">Remover</span>
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card: Adicionar Administrador */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 space-y-2.5">
            <label className="text-xs font-semibold text-foreground/90 flex items-center gap-1.5">
              <UserPlus className="h-4 w-4 text-primary" />
              Adicionar Administrador
            </label>
            {!isCurrentUserOwner && !isDemo ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-center gap-2">
                <Crown className="h-4 w-4 shrink-0 text-amber-400" />
                <span>Apenas os proprietários (Owners) podem cadastrar ou remover administradores.</span>
              </div>
            ) : (
              <form onSubmit={handleAddAdmin} className="flex gap-2">
                <Input
                  type="number"
                  placeholder="ID numérico (ex: 123456789)"
                  value={newAdminInput}
                  onChange={(e) => setNewAdminInput(e.target.value)}
                  className="bg-white/5 border-white/10 text-xs font-mono"
                />
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!newAdminInput.trim() || savingAdmins}
                  className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-3.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar
                </Button>
              </form>
            )}
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Dica: O usuário pode obter o próprio ID enviando mensagem para o bot <span className="text-primary font-mono">@userinfobot</span> no Telegram.
            </p>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setAdminModalOpen(false)}
          >
            Fechar
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
