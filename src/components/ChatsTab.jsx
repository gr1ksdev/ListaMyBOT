import * as React from 'react';
import {
  Search,
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
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/Dialog';
import { ColorPicker } from './ui/ColorPicker';
import { useToast } from './ui/Toast';
import { callEndpoint, haptic, openTelegramLink } from '@/lib/telegram';
import { initials, LABELS, resolveStyle } from '@/lib/utils';

export function ChatsTab({ data, initialFilter = 'all', onRefresh, isDemo, initialChatId }) {
  const { toast } = useToast();
  const [filter, setFilter] = React.useState(initialFilter);
  const [search, setSearch] = React.useState('');
  const [expandedIds, setExpandedIds] = React.useState(new Set());
  const [editingChat, setEditingChat] = React.useState(null);
  const [removingChat, setRemovingChat] = React.useState(null);
  const [savingAction, setSavingAction] = React.useState(false);
  const [highlightedChatId, setHighlightedChatId] = React.useState(null);

  // Sync initialFilter prop if changed
  React.useEffect(() => {
    if (initialFilter) setFilter(initialFilter);
  }, [initialFilter]);

  // Handle deep linking for initialChatId
  React.useEffect(() => {
    if (initialChatId != null && initialChatId !== '') {
      const targetId = Number(initialChatId);
      if (!Number.isNaN(targetId)) {
        setFilter('all');
        setExpandedIds((prev) => new Set([...prev, targetId]));
        setHighlightedChatId(targetId);

        const timer = setTimeout(() => {
          const el = document.getElementById(`chat-card-${targetId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 350);
        return () => clearTimeout(timer);
      }
    }
  }, [initialChatId, data?.chats?.length]);

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

  const handleModerate = async (id, status) => {
    if (isDemo) {
      const target = chats.find((c) => c.id === id);
      if (target) {
        if (
          target.members != null &&
          settings.minMembers > 0 &&
          target.members < settings.minMembers &&
          status === 'approved'
        ) {
          toast(
            `Não é possível aprovar: canal tem ${target.members} membros (mínimo ${settings.minMembers})`,
            'error'
          );
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
      chats
        .filter((c) => c.owner === owner && c.status === 'pending')
        .forEach((c) => (c.status = 'approved'));
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
    // Update locally immediately
    const target = chats.find((c) => c.id === id);
    if (target) {
      target.style = color;
    }

    if (isDemo) {
      toast('Cor do botão atualizada (Demo)', 'info');
      return;
    }

    try {
      haptic('selection');
      await callEndpoint('setChatColor', { id, style: color });
      toast('Cor do botão salva!', 'success');
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
    <div className="space-y-4 pb-20 animate-in fade-in duration-300">
      {/* Top Filter Pills (Aprovação removida conforme solicitado) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <Button
          variant={filter === 'all' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
          className="rounded-full text-xs font-semibold px-3.5 h-8 border-white/10"
        >
          Todos ({chats.length})
        </Button>
        <Button
          variant={filter === 'pending' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setFilter('pending')}
          className={`rounded-full text-xs font-semibold px-3.5 h-8 border-white/10 ${
            filter !== 'pending' && pendingCount > 0 ? 'border-amber-500/50 text-amber-300' : ''
          }`}
        >
          Pendentes
          {pendingCount > 0 && (
            <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-black">
              {pendingCount}
            </span>
          )}
        </Button>
        <Button
          variant={filter === 'approved' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setFilter('approved')}
          className="rounded-full text-xs font-semibold px-3.5 h-8 border-white/10"
        >
          Ativos ({approvedCount})
        </Button>
        <Button
          variant={filter === 'rejected' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setFilter('rejected')}
          className="rounded-full text-xs font-semibold px-3.5 h-8 border-white/10"
        >
          Rejeitados ({rejectedCount})
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar canal ou grupo..."
          className="pl-10 h-10 bg-white/5 border-white/10 rounded-xl"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Empty State */}
      {filteredChats.length === 0 && (
        <Card className="p-8 text-center border-dashed border-white/10 bg-white/5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white/60 mb-3">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Nenhum canal encontrado</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            {search
              ? 'Tente buscar com outro termo ou limpe o campo de busca.'
              : filter === 'pending'
              ? 'Nenhum canal aguardando aprovação no momento.'
              : 'Nenhum canal registrado nesta visualização.'}
          </p>
        </Card>
      )}

      {/* Chats List (Compact Accordion Cards WITHOUT nested div inside) */}
      <div className="space-y-2.5">
        {filteredChats.map((chat) => {
          const isExpanded = expandedIds.has(chat.id);
          const isOwnerBanned = bannedUsers.has(chat.owner) || chat.isBanned;
          const currentStyle = resolveStyle(chat, settings);
          const belowMinMembers =
            settings.minMembers > 0 && chat.members != null && chat.members < settings.minMembers;

          const isTargetHighlight = highlightedChatId === chat.id;

          return (
            <div
              key={chat.id}
              id={`chat-card-${chat.id}`}
              className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                isTargetHighlight
                  ? 'border-primary ring-2 ring-primary/60 bg-card shadow-xl shadow-primary/10'
                  : isExpanded
                  ? 'border-white/20 bg-card shadow-lg'
                  : 'border-white/10 bg-card/70 hover:border-white/20'
              }`}
            >
              {/* Compact Header (Always visible) */}
              <div
                onClick={() => toggleExpand(chat.id)}
                className="flex items-center justify-between p-3.5 cursor-pointer select-none"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Initials Avatar */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 font-bold text-xs text-foreground shadow-inner">
                    {initials(chat.title)}
                  </div>

                  {/* Title & Status */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground truncate">
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
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 truncate">
                      <span className="font-mono">{chat.url?.replace('https://t.me/', '@')}</span>
                      <span>•</span>
                      <span>{categories[chat.category] || 'Padrão'}</span>
                    </div>
                  </div>
                </div>

                {/* Right side: quick status badge & toggle arrow */}
                <div className="flex items-center gap-2.5 shrink-0 ml-2">
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

                  <div className="opacity-60 hover:opacity-100 p-1">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Card Content (FLAT layout without redundant inner container boxes) */}
              {isExpanded && (
                <div className="border-t border-white/10 p-4 pt-3 space-y-4 animate-in slide-in-from-top-1 duration-150">
                  {/* Info# Details Grid directly inside the card */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-foreground/80">
                    {/* ID do canal */}
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-muted-foreground">ID do Chat:</span>
                      <span className="font-mono font-medium text-foreground">{chat.id}</span>
                    </div>

                    {/* Usuário Criador */}
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 opacity-60 shrink-0" />
                      <span className="font-semibold text-muted-foreground">Criador:</span>
                      <a
                        href={`tg://user?id=${chat.owner}`}
                        onClick={(e) => {
                          e.preventDefault();
                          openTelegramLink(`tg://user?id=${chat.owner}`);
                        }}
                        className="text-primary hover:underline font-medium truncate"
                      >
                        {chat.ownerName ? `${chat.ownerName} (${chat.owner})` : chat.owner}
                      </a>
                    </div>

                    {/* Link direto do Canal/Grupo */}
                    <div className="flex items-center gap-2">
                      <ExternalLink className="h-3.5 w-3.5 opacity-60 shrink-0" />
                      <span className="font-semibold text-muted-foreground">Link:</span>
                      <a
                        href={chat.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => {
                          e.preventDefault();
                          openTelegramLink(chat.url);
                        }}
                        className="text-primary hover:underline font-mono truncate"
                      >
                        {chat.url}
                      </a>
                    </div>

                    {/* Membros */}
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 opacity-60 shrink-0" />
                      <span className="font-semibold text-muted-foreground">Membros:</span>
                      <span className="font-semibold text-foreground">
                        {chat.members != null ? chat.members.toLocaleString('pt-BR') : 'Não checado'}
                      </span>
                      {belowMinMembers && (
                        <span className="text-[11px] font-semibold text-rose-400 flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" /> Abaixo do mínimo ({settings.minMembers})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Individual Button Color Selector (Clean Swatches) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5">
                    <div className="flex items-center gap-2 text-xs font-medium text-foreground/80">
                      <Palette className="h-3.5 w-3.5 text-primary" />
                      <span>Cor do botão na lista:</span>
                    </div>

                    <ColorPicker
                      value={chat.style || ''}
                      onChange={(color) => handleSetColor(chat.id, color)}
                      inheritLabel="Padrão"
                    />
                  </div>

                  {/* Actions Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                    {/* Left: Edit & Remove */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingChat({ ...chat })}
                        className="h-8 text-xs border-white/10"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Editar
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRemovingChat(chat)}
                        className="h-8 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remover
                      </Button>
                    </div>

                    {/* Right: Moderation Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      {chat.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApproveAllUser(chat.owner)}
                          className="h-8 text-xs border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                          title="Aprovar todos os canais pendentes deste usuário"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          Aceitar todos do usuário
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleBanUser(chat.owner, !isOwnerBanned)}
                        className={`h-8 text-xs ${
                          isOwnerBanned
                            ? 'text-emerald-400 hover:bg-emerald-500/10'
                            : 'text-rose-400 hover:bg-rose-500/10'
                        }`}
                      >
                        <Ban className="h-3.5 w-3.5" />
                        {isOwnerBanned ? 'Desbanir Usuário' : 'Banir Usuário'}
                      </Button>

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
              <label className="text-xs font-semibold text-foreground/80">Título / Nome</label>
              <Input
                type="text"
                value={editingChat.title || ''}
                onChange={(e) => setEditingChat({ ...editingChat, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/80">Link do Telegram</label>
              <Input
                type="url"
                value={editingChat.url || ''}
                onChange={(e) => setEditingChat({ ...editingChat, url: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/80">Categoria</label>
              <select
                value={editingChat.category ?? 0}
                onChange={(e) => setEditingChat({ ...editingChat, category: Number(e.target.value) })}
                className="w-full h-10 rounded-lg border border-white/10 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {categories.map((cat, idx) => (
                  <option key={idx} value={idx}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/80">Cor do botão</label>
              <div>
                <ColorPicker
                  value={editingChat.style || ''}
                  onChange={(val) => setEditingChat({ ...editingChat, style: val })}
                  inheritLabel="Herdar (Padrão)"
                />
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
              O canal <strong>{removingChat.title}</strong> será excluído permanentemente da lista.
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
