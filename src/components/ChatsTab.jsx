import * as React from 'react';
import {
  Search,
  Filter,
  Check,
  X,
  UserCheck,
  Ban,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Edit2,
  Users,
  Shield,
  Palette,
  AlertTriangle,
  User,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/Dialog';
import { useToast } from './ui/Toast';
import { callEndpoint, haptic, openTelegramLink } from '@/lib/telegram';
import { initials, LABELS, COLOR_OPTIONS, resolveStyle } from '@/lib/utils';

export function ChatsTab({ data, initialFilter = 'all', onRefresh, isDemo }) {
  const { toast } = useToast();
  const [filter, setFilter] = React.useState(initialFilter);
  const [search, setSearch] = React.useState('');
  const [expandedIds, setExpandedIds] = React.useState(new Set());
  const [editingChat, setEditingChat] = React.useState(null);
  const [removingChat, setRemovingChat] = React.useState(null);
  const [savingAction, setSavingAction] = React.useState(false);

  // Sync initialFilter prop if changed
  React.useEffect(() => {
    if (initialFilter) setFilter(initialFilter);
  }, [initialFilter]);

  const chats = data?.chats || [];
  const settings = data?.settings || {};
  const categories = data?.categories || [];
  const bannedUsers = new Set(data?.bannedUsers || []);

  const pendingCount = chats.filter((c) => c.status === 'pending').length;
  const approvedCount = chats.filter((c) => c.status === 'approved').length;
  const rejectedCount = chats.filter((c) => c.status === 'rejected').length;

  const toggleExpand = (id) => {
    haptic('light');
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleApprovalMode = async (mode) => {
    if (isDemo) {
      toast(`Modo de aprovação alterado para ${mode === 'automatic' ? 'Automático' : 'Manual'} (Demo)`, 'info');
      return;
    }
    try {
      haptic('medium');
      const updated = { ...settings, approval: mode };
      await callEndpoint('saveSettings', { settings: updated });
      toast(`Modo de aprovação: ${mode === 'automatic' ? 'Automático' : 'Manual'}`, 'success');
      onRefresh?.();
    } catch (err) {
      toast(err.message || 'Falha ao alterar modo de aprovação', 'error');
    }
  };

  const handleModerate = async (id, status) => {
    if (isDemo) {
      const target = chats.find((c) => c.id === id);
      if (target) {
        if (target.members != null && settings.minMembers > 0 && target.members < settings.minMembers && status === 'approved') {
          toast(`Não é possível aprovar: canal tem ${target.members} membros (mínimo ${settings.minMembers})`, 'error');
          return;
        }
        target.status = status;
        toast(`Canal ${status === 'approved' ? 'aprovado' : 'rejeitado'} (Demo)`, 'success');
      }
      return;
    }

    try {
      haptic('light');
      await callEndpoint('moderateChat', { id, status });
      toast(`Canal ${status === 'approved' ? 'aprovado' : 'rejeitado'} com sucesso!`, 'success');
      onRefresh?.();
    } catch (err) {
      toast(err.message || 'Falha ao moderar canal', 'error');
    }
  };

  const handleApproveAllUser = async (owner) => {
    if (isDemo) {
      chats.filter((c) => c.owner === owner && c.status === 'pending').forEach((c) => (c.status = 'approved'));
      toast('Todos os canais pendentes deste usuário foram aprovados (Demo)', 'success');
      return;
    }

    try {
      haptic('medium');
      const res = await callEndpoint('approveUserChats', { owner });
      toast(`Aprovados ${res.approved || 0} canais pendentes do usuário!`, 'success');
      onRefresh?.();
    } catch (err) {
      toast(err.message || 'Falha ao aprovar canais do usuário', 'error');
    }
  };

  const handleBanUser = async (owner, willBan) => {
    if (isDemo) {
      toast(`Usuário ${willBan ? 'banido' : 'desbanido'} (Demo)`, 'info');
      return;
    }

    try {
      haptic('heavy');
      await callEndpoint('banUser', { owner, banned: willBan });
      toast(`Usuário ${willBan ? 'banido da rede' : 'desbanido'} com sucesso!`, 'success');
      onRefresh?.();
    } catch (err) {
      toast(err.message || 'Falha na moderação do usuário', 'error');
    }
  };

  const handleRemoveChat = async (id) => {
    if (isDemo) {
      const idx = chats.findIndex((c) => c.id === id);
      if (idx !== -1) chats.splice(idx, 1);
      toast('Canal removido da rede (Demo)', 'info');
      setRemovingChat(null);
      return;
    }

    try {
      setSavingAction(true);
      haptic('heavy');
      await callEndpoint('removeChat', { id });
      toast('Canal removido da rede com sucesso!', 'success');
      setRemovingChat(null);
      onRefresh?.();
    } catch (err) {
      toast(err.message || 'Falha ao remover canal', 'error');
    } finally {
      setSavingAction(false);
    }
  };

  const handleSetColor = async (id, color) => {
    if (isDemo) {
      const c = chats.find((ch) => ch.id === id);
      if (c) c.style = color;
      toast(`Cor do botão atualizada (Demo)`, 'info');
      return;
    }

    try {
      haptic('selection');
      await callEndpoint('setChatColor', { id, style: color });
      toast('Cor individual do botão salva!', 'success');
      onRefresh?.();
    } catch (err) {
      toast(err.message || 'Falha ao salvar cor', 'error');
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingChat) return;

    if (isDemo) {
      const target = chats.find((c) => c.id === editingChat.id);
      if (target) Object.assign(target, editingChat);
      toast('Alterações salvas (Demo)', 'success');
      setEditingChat(null);
      return;
    }

    try {
      setSavingAction(true);
      haptic('medium');
      await callEndpoint('updateChat', {
        id: editingChat.id,
        title: editingChat.title,
        url: editingChat.url,
        category: editingChat.category,
        style: editingChat.style,
      });
      toast('Dados do canal atualizados!', 'success');
      setEditingChat(null);
      onRefresh?.();
    } catch (err) {
      toast(err.message || 'Falha ao atualizar canal', 'error');
    } finally {
      setSavingAction(false);
    }
  };

  // Filter and search
  const filteredChats = chats.filter((c) => {
    if (filter === 'pending' && c.status !== 'pending') return false;
    if (filter === 'approved' && c.status !== 'approved') return false;
    if (filter === 'rejected' && c.status !== 'rejected') return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = (c.title || '').toLowerCase().includes(q);
      const matchUrl = (c.url || '').toLowerCase().includes(q);
      const matchId = String(c.id).includes(q);
      const matchOwner = String(c.owner).includes(q);
      const matchOwnerName = (c.ownerName || '').toLowerCase().includes(q);
      if (!matchTitle && !matchUrl && !matchId && !matchOwner && !matchOwnerName) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5 pb-20 animate-in fade-in duration-300">
      {/* Top Controls: Mode Switch & Filter Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <Button
            variant={filter === 'all' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className="rounded-full text-xs font-semibold"
          >
            Todos ({chats.length})
          </Button>
          <Button
            variant={filter === 'pending' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilter('pending')}
            className={`rounded-full text-xs font-semibold ${
              filter !== 'pending' && pendingCount > 0 ? 'border-amber-500/50 text-amber-300' : ''
            }`}
          >
            Pendentes
            {pendingCount > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-slate-950">
                {pendingCount}
              </span>
            )}
          </Button>
          <Button
            variant={filter === 'approved' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilter('approved')}
            className="rounded-full text-xs font-semibold"
          >
            Ativos ({approvedCount})
          </Button>
          <Button
            variant={filter === 'rejected' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilter('rejected')}
            className="rounded-full text-xs font-semibold"
          >
            Rejeitados ({rejectedCount})
          </Button>
        </div>

        {/* Approval Mode Toggle */}
        <div className="flex items-center gap-2 rounded-xl bg-slate-900/90 p-1 border border-slate-800 text-xs">
          <span className="px-2 text-slate-400 font-medium">Aprovação:</span>
          <button
            type="button"
            onClick={() => handleToggleApprovalMode('manual')}
            className={`rounded-lg px-2.5 py-1 font-semibold transition-all cursor-pointer ${
              settings.approval === 'manual'
                ? 'bg-sky-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Manual
          </button>
          <button
            type="button"
            onClick={() => handleToggleApprovalMode('automatic')}
            className={`rounded-lg px-2.5 py-1 font-semibold transition-all cursor-pointer ${
              settings.approval === 'automatic'
                ? 'bg-sky-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Automática
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, @link, ID do canal ou criador..."
          className="pl-10 h-11 bg-slate-900/90 border-slate-800 focus-visible:ring-sky-500 rounded-xl"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Empty State */}
      {filteredChats.length === 0 && (
        <Card className="p-8 text-center border-dashed border-slate-800">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/80 text-slate-400 mb-3">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-200">Nenhum canal encontrado</h3>
          <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
            {search
              ? 'Tente buscar com outro termo ou limpe o campo de busca.'
              : filter === 'pending'
              ? 'Não há solicitações pendentes no momento. Tudo limpo!'
              : 'Nenhum canal registrado nesta categoria.'}
          </p>
        </Card>
      )}

      {/* Chats List (Compact Accordion Cards) */}
      <div className="space-y-3">
        {filteredChats.map((chat) => {
          const isExpanded = expandedIds.has(chat.id);
          const isOwnerBanned = bannedUsers.has(chat.owner) || chat.isBanned;
          const currentStyle = resolveStyle(chat, settings);
          const belowMinMembers =
            settings.minMembers > 0 && chat.members != null && chat.members < settings.minMembers;

          return (
            <div
              key={chat.id}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isExpanded
                  ? 'border-sky-500/50 bg-slate-900 shadow-lg shadow-sky-500/5'
                  : 'border-slate-800/90 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              {/* Compact Header (Always visible) */}
              <div
                onClick={() => toggleExpand(chat.id)}
                className="flex items-center justify-between p-3.5 sm:p-4 cursor-pointer select-none"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Initials Avatar */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 font-bold text-xs text-slate-200 shadow-inner">
                    {initials(chat.title)}
                  </div>

                  {/* Title & Status */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-100 truncate">
                        {chat.title}
                      </span>
                      {chat.type === 'channel' ? (
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                          Canal
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                          Grupo
                        </Badge>
                      )}
                      {isOwnerBanned && (
                        <Badge variant="destructive" className="text-[10px] py-0 px-1.5 h-4">
                          Banido
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 truncate">
                      <span className="text-slate-400 font-mono">{chat.url?.replace('https://t.me/', '@')}</span>
                      <span>•</span>
                      <span>{categories[chat.category] || 'Padrão'}</span>
                    </div>
                  </div>
                </div>

                {/* Right side: quick status badge & toggle arrow */}
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <Badge
                    variant={
                      chat.status === 'approved'
                        ? 'success'
                        : chat.status === 'pending'
                        ? 'warning'
                        : 'destructive'
                    }
                    className="text-[11px]"
                  >
                    {LABELS[chat.status] || chat.status}
                  </Badge>

                  <div className="text-slate-400 hover:text-slate-200 p-1">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Card Content (Info# Box & Moderation Controls) */}
              {isExpanded && (
                <div className="border-t border-slate-800/80 p-4 pt-3 bg-slate-950/40 space-y-4 animate-in slide-in-from-top-2 duration-200">
                  {/* Info# Box (Styled Metadata Box) */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="font-semibold text-sky-400 flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5" />
                        Info#
                      </span>
                      <span className="font-mono text-slate-400 text-[11px]">ID: {chat.id}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                      {/* Usuário Criador */}
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>Criador:</span>
                        <a
                          href={`tg://user?id=${chat.owner}`}
                          onClick={(e) => {
                            e.preventDefault();
                            openTelegramLink(`tg://user?id=${chat.owner}`);
                          }}
                          className="text-sky-400 hover:underline font-medium truncate"
                        >
                          {chat.ownerName ? `${chat.ownerName} (${chat.owner})` : chat.owner}
                        </a>
                      </div>

                      {/* Link direto do Canal/Grupo */}
                      <div className="flex items-center gap-2">
                        <ExternalLink className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>Link:</span>
                        <a
                          href={chat.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => {
                            e.preventDefault();
                            openTelegramLink(chat.url);
                          }}
                          className="text-sky-400 hover:underline font-mono truncate"
                        >
                          {chat.url}
                        </a>
                      </div>

                      {/* Membros */}
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>Membros:</span>
                        <span className="font-semibold text-white">
                          {chat.members != null ? chat.members.toLocaleString('pt-BR') : 'Não checado'}
                        </span>
                        {belowMinMembers && (
                          <span className="text-[11px] font-semibold text-rose-400 flex items-center gap-0.5">
                            <AlertTriangle className="h-3 w-3" /> Abaixo do mínimo ({settings.minMembers})
                          </span>
                        )}
                      </div>

                      {/* Categoria */}
                      <div className="flex items-center gap-2">
                        <span>Categoria:</span>
                        <span className="font-medium text-slate-200">
                          {categories[chat.category] || 'Padrão'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Individual Button Color Selector */}
                  <div className="flex items-center justify-between rounded-xl bg-slate-900/80 p-2.5 border border-slate-800 text-xs">
                    <div className="flex items-center gap-2 text-slate-300 font-medium">
                      <Palette className="h-3.5 w-3.5 text-sky-400" />
                      <span>Cor do botão na lista:</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {COLOR_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleSetColor(chat.id, opt.value)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            (chat.style || '') === opt.value
                              ? 'bg-sky-500 text-slate-950 font-bold shadow'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    {/* Left: Edit & Remove */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingChat({ ...chat })}
                        className="h-8 text-xs text-slate-300 border-slate-700 hover:bg-slate-800"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Editar
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRemovingChat(chat)}
                        className="h-8 text-xs text-rose-400 hover:bg-rose-950/40 hover:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remover
                      </Button>
                    </div>

                    {/* Right: Moderation Actions (Approve, Disapprove, Accept All, Ban) */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Aceitar todos do usuário */}
                      {chat.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApproveAllUser(chat.owner)}
                          className="h-8 text-xs border-emerald-500/30 text-emerald-300 hover:bg-emerald-950/40"
                          title="Aprovar todos os canais pendentes deste mesmo usuário"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          Aceitar todos do usuário
                        </Button>
                      )}

                      {/* Ban / Unban User */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleBanUser(chat.owner, !isOwnerBanned)}
                        className={`h-8 text-xs ${
                          isOwnerBanned
                            ? 'text-emerald-400 hover:bg-emerald-950/40'
                            : 'text-rose-400 hover:bg-rose-950/40'
                        }`}
                      >
                        <Ban className="h-3.5 w-3.5" />
                        {isOwnerBanned ? 'Desbanir Usuário' : 'Banir Usuário'}
                      </Button>

                      {/* Approve / Disapprove toggle */}
                      {chat.status === 'approved' ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleModerate(chat.id, 'rejected')}
                          className="h-8 text-xs font-semibold"
                        >
                          <X className="h-3.5 w-3.5" />
                          Desaprovar
                        </Button>
                      ) : (
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => handleModerate(chat.id, 'approved')}
                          className="h-8 text-xs font-semibold"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Aprovar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Chat Modal */}
      {editingChat && (
        <Dialog open={Boolean(editingChat)} onOpenChange={() => setEditingChat(null)}>
          <DialogHeader>
            <DialogTitle>Editar Participante</DialogTitle>
            <DialogDescription>
              Ajuste o nome de exibição, link oficial e categoria deste canal/grupo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Título / Nome</label>
              <Input
                type="text"
                value={editingChat.title || ''}
                onChange={(e) => setEditingChat({ ...editingChat, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Link do Telegram</label>
              <Input
                type="url"
                value={editingChat.url || ''}
                onChange={(e) => setEditingChat({ ...editingChat, url: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Categoria</label>
              <select
                value={editingChat.category ?? 0}
                onChange={(e) => setEditingChat({ ...editingChat, category: Number(e.target.value) })}
                className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {categories.map((cat, idx) => (
                  <option key={idx} value={idx}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Estilo de cor do botão</label>
              <div className="grid grid-cols-4 gap-2">
                {COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEditingChat({ ...editingChat, style: opt.value })}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      (editingChat.style || '') === opt.value
                        ? 'border-sky-500 bg-sky-500/20 text-sky-300'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditingChat(null)}
                disabled={savingAction}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={savingAction}>
                {savingAction ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}

      {/* Remove Chat Confirmation Modal */}
      {removingChat && (
        <Dialog open={Boolean(removingChat)} onOpenChange={() => setRemovingChat(null)}>
          <DialogHeader>
            <DialogTitle>Remover Canal da Rede?</DialogTitle>
            <DialogDescription>
              O canal <strong>{removingChat.title}</strong> será excluído permanentemente da lista de canais cadastrados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRemovingChat(null)}
              disabled={savingAction}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => handleRemoveChat(removingChat.id)}
              disabled={savingAction}
            >
              {savingAction ? 'Removendo...' : 'Sim, Remover Canal'}
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
