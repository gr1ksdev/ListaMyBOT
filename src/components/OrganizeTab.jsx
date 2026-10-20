import * as React from 'react';
import {
  Grid,
  Eye,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Megaphone,
  Check,
  RotateCcw,
  SlidersHorizontal,
  Layers,
  Shuffle,
  Pin,
  Sparkles,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/Dialog';
import { ColorPicker } from './ui/ColorPicker';
import { Checkbox } from './ui/Checkbox';
import { Switch } from './ui/Switch';
import { useToast } from './ui/Toast';
import { callEndpoint, saveSettingsSafe, haptic } from '@/lib/telegram';
import { layoutPattern, repeatRows, paginateRows, resolveListAds } from '@/lib/layout';
import { resolveStyle, sanitizeTelegramHtml, cn } from '@/lib/utils';

const STYLE_DOT_COLOR = {
  '': 'bg-slate-400',
  primary: 'bg-[#2481cc]',
  success: 'bg-[#2ea043]',
  danger: 'bg-[#e53935]',
};

export function OrganizeTab({ data, onRefresh, isDemo, onSyncVersion }) {
  const { toast } = useToast();
  const [subView, setSubView] = React.useState('organize'); // 'organize' | 'preview'
  const [rows, setRows] = React.useState([[1, 2]]);
  const [ads, setAds] = React.useState([]);
  const [removedAdIds, setRemovedAdIds] = React.useState(new Set());
  const [selectedTokenKey, setSelectedTokenKey] = React.useState(null);
  const [expandedAdKeys, setExpandedAdKeys] = React.useState(() => new Set());

  // List Type & Final List Promotions
  const [listType, setListType] = React.useState('mixed'); // 'mixed' | 'simple'
  const [listAdsConfig, setListAdsConfig] = React.useState({
    enabled: false,
    mode: 'fixed',
    sameAdAcrossSlots: true,
    slots: {
      start: { enabled: true, adId: null },
      middle: { enabled: false, adId: null },
      end: { enabled: true, adId: null },
    },
    randomPool: [],
    fixedAdId: null,
  });

  // Message & order
  const [messageText, setMessageText] = React.useState('');
  const [order, setOrder] = React.useState('alphabetical');
  const [groupCategories, setGroupCategories] = React.useState(false);

  // Preview state
  const [previewPage, setPreviewPage] = React.useState(0);
  const [previewColorMode, setPreviewColorMode] = React.useState('telegram');
  const [previewSimpleFilter, setPreviewSimpleFilter] = React.useState('channel'); // 'channel' | 'group'

  // Modals
  const [adsModalOpen, setAdsModalOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const tokenSerialRef = React.useRef(200);
  const nextKey = () => ++tokenSerialRef.current;

  const toggleExpandAd = (key) => {
    haptic('light');
    setExpandedAdKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleToggleExpandAll = () => {
    haptic('light');
    if (expandedAdKeys.size === ads.length) {
      setExpandedAdKeys(new Set());
    } else {
      setExpandedAdKeys(new Set(ads.map((a) => a.key)));
    }
  };

  // Initialize draft from data.settings & data.ads
  React.useEffect(() => {
    if (!data?.settings) return;
    const s = data.settings;
    setMessageText(s.text || '');
    setOrder(s.order || 'alphabetical');
    setGroupCategories(Boolean(s.groupCategories));
    setListType(s.listType || 'mixed');

    const lac = s.listAdsConfig || {};
    setListAdsConfig({
      enabled: Boolean(lac.enabled),
      mode: lac.mode === 'random' ? 'random' : 'fixed',
      sameAdAcrossSlots: Boolean(lac.sameAdAcrossSlots ?? true),
      slots: {
        start: { enabled: Boolean(lac.slots?.start?.enabled ?? true), adId: lac.slots?.start?.adId || null },
        middle: { enabled: Boolean(lac.slots?.middle?.enabled ?? false), adId: lac.slots?.middle?.adId || null },
        end: { enabled: Boolean(lac.slots?.end?.enabled ?? true), adId: lac.slots?.end?.adId || null },
      },
      randomPool: Array.isArray(lac.randomPool) ? lac.randomPool : [],
      fixedAdId: lac.fixedAdId || null,
    });

    const initialAds = (data.ads || []).map((a) => ({
      id: a.id,
      title: a.title,
      url: a.url,
      style: a.style || '',
      slot_row: a.slot_row,
      slot_col: a.slot_col,
      key: nextKey(),
    }));
    setAds(initialAds);
    setRemovedAdIds(new Set());

    const pattern = layoutPattern(s);
    const initialRows = pattern.map((count) =>
      Array.from({ length: count }, () => ({
        key: nextKey(),
        name: `Canal Exemplo`,
      }))
    );

    // InitialRows strictly represents the channel layout pattern (e.g. 2 -> 2, 1 -> 2 -> 1).
    // Partnerships are managed independently via strategic slots and off-grid positions,
    // preventing ads from repeating or vanishing when patterns cycle or paginate.
    if (!initialRows.length) initialRows.push([{ key: nextKey(), name: 'Canal Exemplo' }]);
    setRows(initialRows);
  }, [data]);

  const currentPattern = rows.filter((r) => r.length > 0).map((r) => r.length);

  // Row operations
  const handleAddRow = () => {
    if (rows.length >= 15) return;
    haptic('light');
    setRows((prev) => [...prev, [{ key: nextKey(), name: 'Canal Exemplo' }]]);
  };

  const handleRemoveRow = (rIdx) => {
    if (rows.length <= 1) return;
    haptic('light');
    setRows((prev) => prev.filter((_, idx) => idx !== rIdx));
    setSelectedTokenKey(null);
  };

  const handleAddButtonToRow = (rIdx) => {
    if (rows[rIdx].length >= 5) {
      toast('Máximo de 5 botões por linha no Telegram.', 'warning');
      return;
    }
    haptic('light');
    setRows((prev) => {
      const next = prev.map((r) => [...r]);
      next[rIdx].push({ key: nextKey(), name: 'Canal Exemplo' });
      return next;
    });
  };

  const handleRemoveButton = (rIdx, bIdx) => {
    haptic('light');
    setRows((prev) => {
      const next = prev.map((r) => [...r]);
      next[rIdx].splice(bIdx, 1);
      // Remove empty row if not last row
      if (next[rIdx].length === 0 && next.length > 1) {
        next.splice(rIdx, 1);
      }
      return next;
    });
    setSelectedTokenKey(null);
  };

  const handleApplyPreset = (preset) => {
    haptic('medium');
    const newRows = preset.map((count) =>
      Array.from({ length: count }, () => ({
        key: nextKey(),
        name: 'Canal Exemplo',
      }))
    );
    setRows(newRows);
    setSelectedTokenKey(null);
    toast(`Padrão ${preset.join(' → ')} aplicado!`, 'info');
  };

  // Move token between slots
  const handleTokenClick = (rIdx, bIdx, token) => {
    if (selectedTokenKey === token.key) {
      setSelectedTokenKey(null);
      return;
    }

    if (selectedTokenKey) {
      // Swap or move
      haptic('light');
      setRows((prev) => {
        const next = prev.map((r) => [...r]);
        let fromR = -1;
        let fromB = -1;
        let moved = null;

        for (let r = 0; r < next.length; r++) {
          const idx = next[r].findIndex((t) => t.key === selectedTokenKey);
          if (idx >= 0) {
            fromR = r;
            fromB = idx;
            moved = next[r][idx];
            break;
          }
        }

        if (moved) {
          // Swap positions
          next[fromR][fromB] = token;
          next[rIdx][bIdx] = moved;
        }
        return next;
      });
      setSelectedTokenKey(null);
      return;
    }

    // Select token
    haptic('selection');
    setSelectedTokenKey(token.key);
  };

  // Partner reordering
  const handleMoveAd = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= ads.length) return;
    haptic('light');
    setAds((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  // Partner removal
  const handleRemoveAd = (ad) => {
    haptic('light');
    const idVal = ad.id || ad.key;
    if (ad.id) setRemovedAdIds((prev) => new Set([...prev, ad.id]));
    setAds((prev) => prev.filter((a) => a.key !== ad.key));
    setExpandedAdKeys((prev) => {
      const next = new Set(prev);
      next.delete(ad.key);
      return next;
    });
    // Safely replace any ad token in the grid with a standard channel token instead of deleting the cell
    setRows((prev) =>
      prev.map((row) =>
        row.map((t) => (t.adKey === ad.key ? { key: nextKey(), name: 'Canal Exemplo' } : t))
      )
    );
    setListAdsConfig((prev) => {
      const updated = { ...prev };
      if (updated.fixedAdId === idVal) updated.fixedAdId = null;
      if (updated.randomPool) {
        updated.randomPool = updated.randomPool.filter((x) => x !== idVal);
      }
      if (updated.slots) {
        const s = { ...updated.slots };
        if (s.start?.adId === idVal) s.start = { ...s.start, adId: null };
        if (s.middle?.adId === idVal) s.middle = { ...s.middle, adId: null };
        if (s.end?.adId === idVal) s.end = { ...s.end, adId: null };
        updated.slots = s;
      }
      return updated;
    });
  };

  // Save List Settings and Ads
  const handleSave = async () => {
    if (!currentPattern.length) {
      toast('Adicione pelo menos um botão ao padrão.', 'error');
      return;
    }

    // Validate ads before saving
    for (const ad of ads) {
      const title = (ad.title || '').trim();
      if (!title) {
        toast('Dê um nome a todas as divulgações cadastradas.', 'error');
        return;
      }
      if (!/^https:\/\/t\.me\//.test(ad.url || '')) {
        toast(`Informe um link do Telegram (https://t.me/…) para “${title}”.`, 'error');
        return;
      }
    }

    const upsert = [];
    const remove = [...removedAdIds];

    // Auto assign unique row/col starting at [16, 0] for partnerships. Rows 16+
    // stay outside the channel pattern grid, so partnership order is preserved
    // when the list pattern repeats or paginates. Partnerships have their own
    // 100-item limit and do not consume the list's C/G positions.
    for (let i = 0; i < ads.length; i++) {
      const ad = ads[i];
      upsert.push({
        id: ad.id,
        title: (ad.title || '').trim(),
        url: (ad.url || '').trim(),
        style: ad.style || '',
        row: 16 + Math.floor(i / 5),
        col: i % 5,
      });
    }

    if (isDemo) {
      toast('Organização da lista salva! (Modo Demo)', 'success');
      return;
    }

    try {
      setSaving(true);
      haptic('heavy');

      if (upsert.length || remove.length) {
        await callEndpoint('saveAds', { upsert, remove: [...new Set(remove)] });
      }

      const updatedSettings = {
        ...data?.settings,
        text: messageText,
        order,
        groupCategories,
        rowPattern: currentPattern,
        columns: Math.max(1, ...currentPattern),
        listType,
        listAdsConfig,
      };

      await saveSettingsSafe(updatedSettings, data?.version, onSyncVersion);
      toast('Organização salva com sucesso!', 'success');
      onRefresh?.();
    } catch (err) {
      toast(err.message || 'Falha ao salvar organização', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Preview Generation
  const approvedChats = (data?.chats || []).filter((c) => c.status === 'approved');
  const fallbackChats = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    title: i % 2 === 0 ? `Canal ${i + 1}` : `Grupo ${i + 1}`,
    display: '',
    category: i % 4,
    type: i % 2 === 0 ? 'channel' : 'group',
    style: i % 3 === 0 ? 'primary' : i % 3 === 1 ? 'success' : '',
  }));

  const baseItems = (approvedChats.length ? approvedChats : fallbackChats).slice();

  if (order === 'manual') {
    baseItems.sort((a, b) => (a.position || 0) - (b.position || 0) || a.id - b.id);
  } else {
    baseItems.sort((a, b) => (a.display || a.title).localeCompare(b.display || b.title, 'pt-BR'));
  }
  if (groupCategories) {
    baseItems.sort((a, b) => (a.category || 0) - (b.category || 0));
  }

  const channelChats = baseItems.filter((c) => c.type === 'channel');
  const groupChats = baseItems.filter((c) => c.type === 'group' || c.type === 'supergroup');

  const activeItems = listType === 'simple'
    ? (previewSimpleFilter === 'group'
        ? (groupChats.length ? groupChats : baseItems)
        : (channelChats.length ? channelChats : baseItems))
    : baseItems;

  // Build slots from placed ads
  const previewSlots = [];
  rows.forEach((row, r) => {
    row.forEach((t, col) => {
      if (t?.adKey) {
        const ad = ads.find((a) => a.key === t.adKey);
        if (ad && ad.title) {
          previewSlots.push({
            row: r,
            col,
            button: {
              text: `🔆 ${ad.title}`,
              url: ad.url,
              style: ad.style || '',
              isPreviewAd: true,
            },
          });
        }
      }
    });
  });

  const previewPattern = currentPattern.length ? currentPattern : [1];
  const promoSlots = resolveListAds({ listAdsConfig }, ads, 0);
  const hasNewAds = Boolean(promoSlots.start || promoSlots.middle || promoSlots.end);

  let previewRows;
  if (hasNewAds) {
    previewRows = repeatRows(activeItems, previewPattern, []);
    const makePreviewButton = (ad) => ({
      text: `🔆 ${ad.title}`,
      url: ad.url,
      style: ad.style || '',
      isPreviewAd: true,
    });
    if (promoSlots.end) {
      previewRows.push([makePreviewButton(promoSlots.end)]);
    }
    if (promoSlots.middle) {
      if (previewRows.length === 0) {
        previewRows.push([makePreviewButton(promoSlots.middle)]);
      } else {
        const midIdx = Math.max(1, Math.floor(previewRows.length / 2));
        previewRows.splice(midIdx, 0, [makePreviewButton(promoSlots.middle)]);
      }
    }
    if (promoSlots.start) {
      previewRows.unshift([makePreviewButton(promoSlots.start)]);
    }
  } else {
    previewRows = repeatRows(activeItems, previewPattern, previewSlots);
  }

  // Default action buttons at the end of the list
  const botUsername = data?.bot?.username || 'ListaMyBOT';
  const botAddUrl = `https://t.me/${botUsername}?startgroup=true&admin=post_messages+edit_messages+delete_messages+pin_messages+invite_users`;
  previewRows.push([
    {
      text: 'Add-me em C/G',
      url: botAddUrl,
      style: 'primary',
      isPreviewAd: true,
    },
    {
      text: 'Canal Oficial',
      url: 'https://t.me/ChannelLogBM',
      style: 'success',
      isPreviewAd: true,
    },
  ]);

  const previewPages = paginateRows(previewRows, 40, 20);
  const currentPageRows = previewPages[previewPage] || [];

  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-300">
      {/* Top Bar: Clean Tab Switcher & Save Button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-xl bg-white/5 p-1 border border-white/10">
          <button
            type="button"
            onClick={() => {
              haptic('selection');
              setSubView('organize');
            }}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              subView === 'organize'
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Grid className="h-3.5 w-3.5" />
            Grade de Botões
          </button>
          <button
            type="button"
            onClick={() => {
              haptic('selection');
              setSubView('preview');
            }}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              subView === 'preview'
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Prévia no Telegram
          </button>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="shadow-sm font-semibold"
        >
          {saving ? 'Salvando...' : 'Salvar Organização'}
        </Button>
      </div>

      {/* VIEW: ORGANIZE GRID */}
      {subView === 'organize' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Quick Presets & Add Row Action */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl bg-card border border-white/10">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground mr-1">Padrões:</span>
              <button
                type="button"
                onClick={() => handleApplyPreset([1, 2, 1])}
                className="rounded-lg bg-white/10 px-2.5 py-1 text-foreground hover:bg-white/15 transition cursor-pointer font-medium"
              >
                1 → 2 → 1
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset([2, 2])}
                className="rounded-lg bg-white/10 px-2.5 py-1 text-foreground hover:bg-white/15 transition cursor-pointer font-medium"
              >
                2 → 2
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset([1, 1, 1])}
                className="rounded-lg bg-white/10 px-2.5 py-1 text-foreground hover:bg-white/15 transition cursor-pointer font-medium"
              >
                1 → 1 → 1
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAdsModalOpen(true)}
                className="h-8 text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
              >
                <Megaphone className="h-3.5 w-3.5 mr-1" />
                Divulgações ({ads.length})
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleAddRow}
                disabled={rows.length >= 15}
                className="h-8 text-xs border-white/10"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Nova Linha
              </Button>
            </div>
          </div>

          {/* Clean Spacious Rows Visualizer */}
          <div className="space-y-3">
            {rows.map((row, rIdx) => (
              <div
                key={rIdx}
                className="p-3.5 rounded-2xl bg-card border border-white/10 space-y-2.5"
              >
                {/* Row Header with Clean Controls */}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-muted-foreground">
                    Linha {rIdx + 1} ({row.length} {row.length === 1 ? 'botão' : 'botões'})
                  </span>

                  <div className="flex items-center gap-1.5">
                    {row.length < 5 && (
                      <button
                        type="button"
                        onClick={() => handleAddButtonToRow(rIdx)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-foreground font-medium transition cursor-pointer"
                        title="Adicionar mais um botão nesta linha"
                      >
                        <Plus className="h-3 w-3" />
                        Botão
                      </button>
                    )}

                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(rIdx)}
                        className="p-1 text-rose-400 hover:text-rose-300 opacity-70 hover:opacity-100 transition cursor-pointer"
                        title="Remover esta linha"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Buttons in this row (Spacious grid) */}
                <div
                  className="grid gap-3"
                  style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
                >
                  {row.map((token, bIdx) => {
                    const isSelected = selectedTokenKey === token.key;
                    const ad = token.adKey ? ads.find((a) => a.key === token.adKey) : null;

                    return (
                      <div
                        key={token.key}
                        onClick={() => handleTokenClick(rIdx, bIdx, token)}
                        className={`group relative flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer select-none ${
                          isSelected
                            ? 'border-primary bg-primary/20 text-white ring-2 ring-primary/40'
                            : ad
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-200 hover:border-amber-400'
                            : 'border-white/10 bg-white/5 text-foreground hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        <span className="truncate flex items-center gap-1.5">
                          {ad ? <Megaphone className="h-3.5 w-3.5 text-amber-400 shrink-0" /> : null}
                          {ad ? ad.title || 'Divulgação' : `Botão ${bIdx + 1}`}
                        </span>

                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          {row.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveButton(rIdx, bIdx);
                              }}
                              className="opacity-0 group-hover:opacity-100 hover:text-rose-400 p-0.5 rounded transition"
                              title="Remover botão"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Selected Token Helper */}
          {selectedTokenKey && (
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between text-xs text-primary">
              <span>Botão selecionado. Toque em outro botão para trocar de posição.</span>
              <button
                type="button"
                onClick={() => setSelectedTokenKey(null)}
                className="underline hover:opacity-80"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* Textarea: Mensagem da Publicação */}
          <Card className="border-white/10 bg-card">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                Mensagem e Ordenação
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground/80">
                  Texto da publicação no Telegram
                </label>
                <textarea
                  rows={3}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Mensagem oficial enviada junto com os botões..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground/80">Ordem dos canais</label>
                  <select
                    value={order}
                    onChange={(e) => setOrder(e.target.value)}
                    className="w-full h-9 rounded-lg border border-white/10 bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="alphabetical">Alfabética (A-Z)</option>
                    <option value="manual">Posição manual cadastrada</option>
                    <option value="rotate">Alternar a cada rodada</option>
                  </select>
                </div>

                <div className="flex items-center gap-2.5 pt-5">
                  <Checkbox
                    id="group-cat"
                    checked={groupCategories}
                    onCheckedChange={setGroupCategories}
                  >
                    Agrupar por categoria
                  </Checkbox>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CARD: TIPO DE ENTREGA DA LISTA */}
          <Card className="border-white/10 bg-card">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Tipo de Entrega da Lista
              </CardTitle>
              <CardDescription className="text-xs">
                Defina como a lista final será distribuída aos canais e grupos participantes.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div
                  onClick={() => {
                    haptic('selection');
                    setListType('mixed');
                  }}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all space-y-1 ${
                    listType === 'mixed'
                      ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/40'
                      : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <span className="text-primary font-bold">🌐 Lista Mista</span>
                      <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                        Padrão
                      </Badge>
                    </span>
                    {listType === 'mixed' && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Canais e grupos são reunidos juntos na mesma lista final. Entregue igualmente para ambos.
                  </p>
                </div>

                <div
                  onClick={() => {
                    haptic('selection');
                    setListType('simple');
                  }}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all space-y-1 ${
                    listType === 'simple'
                      ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/40'
                      : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <span className="text-emerald-400 font-bold">📑 Lista Simples</span>
                      <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                        Separada
                      </Badge>
                    </span>
                    {listType === 'simple' && <Check className="h-4 w-4 text-emerald-400" />}
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Lista dividida: canais recebem exclusivamente uma lista de canais, e grupos recebem uma lista só de grupos.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CARD: DIVULGAÇÕES DA LISTA FINAL */}
          <Card className="border-white/10 bg-card">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-amber-400" />
                  Divulgações na Lista Final
                </CardTitle>
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    listAdsConfig.enabled
                      ? 'border-amber-500/40 text-amber-300 bg-amber-500/10'
                      : 'border-white/10 text-muted-foreground'
                  }`}
                >
                  {listAdsConfig.enabled ? 'Ativadas' : 'Desativadas'}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Posicione até 3 slots de divulgação no Início, Meio e Fim da lista entregue.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
                <div className="space-y-0.5">
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    <span>Slots estratégicos:</span>
                    <span className="text-amber-300">
                      {[
                        listAdsConfig.slots?.start?.enabled && 'Início (Topo)',
                        listAdsConfig.slots?.middle?.enabled && 'Meio (Centro)',
                        listAdsConfig.slots?.end?.enabled && 'Fim (Rodapé)',
                      ]
                        .filter(Boolean)
                        .join(', ') || 'Nenhum ativo'}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Modo: {listAdsConfig.mode === 'random' ? 'Aleatório (Sorteio)' : 'Fixo'} • Distribuição: {listAdsConfig.sameAdAcrossSlots ? 'Mesma em todos' : 'Diferente por slot'}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAdsModalOpen(true)}
                  className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-xs h-8 font-semibold"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
                  Configurar Divulgações
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* VIEW: LIVE TELEGRAM PREVIEW */}
      {subView === 'preview' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-card border border-white/10">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {listType === 'simple' && (
                <div className="flex rounded-lg bg-black/20 p-1 border border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      haptic('selection');
                      setPreviewSimpleFilter('channel');
                      setPreviewPage(0);
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      previewSimpleFilter === 'channel'
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>📢 Canais</span>
                    <span className="text-[10px] opacity-80">({channelChats.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      haptic('selection');
                      setPreviewSimpleFilter('group');
                      setPreviewPage(0);
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      previewSimpleFilter === 'group'
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>💬 Grupos</span>
                    <span className="text-[10px] opacity-80">({groupChats.length})</span>
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Cores:</span>
                <div className="flex rounded-lg bg-black/20 p-1 border border-white/10">
                  <button
                    type="button"
                    onClick={() => setPreviewColorMode('telegram')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                      previewColorMode === 'telegram'
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    🎨 Cores Telegram
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewColorMode('plain')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                      previewColorMode === 'plain'
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    ⚪ Neutro
                  </button>
                </div>
              </div>
            </div>

            {previewPages.length > 1 && (
              <div className="flex items-center gap-1.5 text-xs">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewPage((p) => Math.max(0, p - 1))}
                  disabled={previewPage === 0}
                  className="h-7 px-2 border-white/10"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="font-mono text-muted-foreground">
                  {previewPage + 1} / {previewPages.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewPage((p) => Math.min(previewPages.length - 1, p + 1))}
                  disabled={previewPage === previewPages.length - 1}
                  className="h-7 px-2 border-white/10"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Telegram Wallpaper Preview Frame */}
          <div className="telegram-chat-wallpaper rounded-3xl p-4 sm:p-6 shadow-inner border border-white/10 flex flex-col items-center">
            {/* Message Bubble */}
            <div className="w-full max-w-md rounded-2xl bg-[#1e2c3a] p-4 text-[#e1e9f0] shadow-md border border-[#2b3c4f]/50 space-y-3">
              <div
                className="text-sm leading-relaxed whitespace-pre-wrap break-words"
                dangerouslySetInnerHTML={{
                  __html: sanitizeTelegramHtml(
                    messageText ||
                    '<b>📢 Conheça nossos canais e grupos parceiros!</b>\n\n<blockquote>Toque nos botões abaixo para participar e conferir os conteúdos exclusivos.</blockquote>'
                  ),
                }}
              />
              <div className="flex justify-end items-center gap-1 text-[11px] text-slate-400">
                <span>12:00</span>
                <span className="text-sky-400 font-bold">✓✓</span>
              </div>
            </div>

            {/* Keyboard Buttons */}
            <div className="w-full max-w-md mt-2 space-y-2">
              {currentPageRows.map((row, rIdx) => (
                <div
                  key={rIdx}
                  className="grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
                >
                  {row.map((btn, bIdx) => {
                    const isAd = Boolean(btn.isPreviewAd);
                    const rawStyle = isAd
                      ? btn.style
                      : previewColorMode === 'plain'
                      ? ''
                      : resolveStyle(btn, data?.settings);

                    return (
                      <div
                        key={bIdx}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer truncate select-none ${
                          rawStyle === 'primary'
                            ? 'bg-[#2481cc] hover:bg-[#2b8cd6] text-white'
                            : rawStyle === 'success'
                            ? 'bg-[#2ea043] hover:bg-[#34ad4a] text-white'
                            : rawStyle === 'danger'
                            ? 'bg-[#e53935] hover:bg-[#ed423e] text-white'
                            : 'bg-[#2b3c4f] hover:bg-[#34475e] text-slate-100'
                        }`}
                      >
                        <span className="truncate">
                          {isAd ? btn.text : btn.display || btn.title}
                        </span>
                        <ExternalLink className="h-3 w-3 shrink-0 ml-1 opacity-70" />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DIVULGAÇÕES (ADS) */}
      <Dialog open={adsModalOpen} onOpenChange={setAdsModalOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-amber-400" />
            Divulgações Parceiras na Lista Final
          </DialogTitle>
          <DialogDescription>
            Configure até 3 slots de divulgação (Início, Meio e Fim) com opções fixas ou aleatórias.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0 -mr-1 overscroll-contain">
          {/* ATIVAÇÃO GERAL */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                Ativar Divulgações Estratégicas
              </span>
              <p className="text-[11px] text-amber-200/80">
                Exibe botões patrocinados em linhas exclusivas no Início, Meio e Fim da lista.
              </p>
            </div>
            <Switch
              id="strategic-ads-toggle"
              checked={listAdsConfig.enabled}
              onChange={(checked) => {
                setListAdsConfig((prev) => ({ ...prev, enabled: checked }));
              }}
            />
          </div>

          {/* SLOTS, MODO E DISTRIBUIÇÃO QUANDO ATIVADO */}
          {listAdsConfig.enabled && (
            <div className="space-y-3.5 p-3.5 rounded-2xl bg-white/5 border border-white/10 animate-in fade-in duration-200">
              {/* POSIÇÕES / SLOTS */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground/90">
                  Posições na Lista Final (Até 3 slots):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'start', label: 'Início', sub: 'Topo da lista' },
                    { id: 'middle', label: 'Meio', sub: 'Centro da lista' },
                    { id: 'end', label: 'Fim', sub: 'Rodapé da lista' },
                  ].map((slot) => {
                    const isActive = Boolean(listAdsConfig.slots?.[slot.id]?.enabled);
                    return (
                      <div
                        key={slot.id}
                        onClick={() => {
                          haptic('selection');
                          setListAdsConfig((prev) => ({
                            ...prev,
                            slots: {
                              ...prev.slots,
                              [slot.id]: {
                                ...prev.slots?.[slot.id],
                                enabled: !isActive,
                              },
                            },
                          }));
                        }}
                        className={`p-2.5 rounded-xl border text-center cursor-pointer transition select-none ${
                          isActive
                            ? 'border-amber-500/50 bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40'
                            : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'
                        }`}
                      >
                        <div className="text-xs font-bold">{slot.label}</div>
                        <div className="text-[10px] opacity-75">{slot.sub}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* MODO & DISTRIBUIÇÃO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Modo */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground/90">Modo de Exibição</label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-black/20 border border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        haptic('selection');
                        setListAdsConfig((prev) => ({ ...prev, mode: 'fixed' }));
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                        listAdsConfig.mode === 'fixed'
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Pin className="h-3 w-3" /> Fixo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        haptic('selection');
                        setListAdsConfig((prev) => ({ ...prev, mode: 'random' }));
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                        listAdsConfig.mode === 'random'
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Shuffle className="h-3 w-3" /> Aleatório
                    </button>
                  </div>
                </div>

                {/* Distribuição */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground/90">Distribuição nos Slots</label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-black/20 border border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        haptic('selection');
                        setListAdsConfig((prev) => ({ ...prev, sameAdAcrossSlots: true }));
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                        listAdsConfig.sameAdAcrossSlots
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <RotateCcw className="h-3 w-3" /> Mesma
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        haptic('selection');
                        setListAdsConfig((prev) => ({ ...prev, sameAdAcrossSlots: false }));
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                        !listAdsConfig.sameAdAcrossSlots
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Layers className="h-3 w-3" /> Diferente
                    </button>
                  </div>
                </div>
              </div>

              {/* SELEÇÃO DO PARCEIRO FIXO OU POOL ALEATÓRIO */}
              {listAdsConfig.mode === 'fixed' && listAdsConfig.sameAdAcrossSlots && (
                <div className="space-y-1 pt-1">
                  <label className="text-xs font-semibold text-foreground/90">
                    Parceiro exibido em todos os slots:
                  </label>
                  <select
                    value={listAdsConfig.fixedAdId || ''}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      setListAdsConfig((prev) => ({ ...prev, fixedAdId: val }));
                    }}
                    className="w-full h-9 rounded-lg border border-white/10 bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">(Primeiro parceiro da lista)</option>
                    {ads.map((a) => (
                      <option key={a.key} value={a.id || a.key}>
                        {a.title || 'Sem título'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {listAdsConfig.mode === 'fixed' && !listAdsConfig.sameAdAcrossSlots && (
                <div className="space-y-2 pt-1">
                  {listAdsConfig.slots?.start?.enabled && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground/90">
                        Parceiro para o Início (Topo):
                      </label>
                      <select
                        value={listAdsConfig.slots?.start?.adId || ''}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null;
                          setListAdsConfig((prev) => ({
                            ...prev,
                            slots: { ...prev.slots, start: { ...prev.slots?.start, adId: val } },
                          }));
                        }}
                        className="w-full h-9 rounded-lg border border-white/10 bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">(Automático / Primeiro disponível)</option>
                        {ads.map((a) => (
                          <option key={a.key} value={a.id || a.key}>
                            {a.title || 'Sem título'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {listAdsConfig.slots?.middle?.enabled && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground/90">
                        Parceiro para o Meio (Centro):
                      </label>
                      <select
                        value={listAdsConfig.slots?.middle?.adId || ''}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null;
                          setListAdsConfig((prev) => ({
                            ...prev,
                            slots: { ...prev.slots, middle: { ...prev.slots?.middle, adId: val } },
                          }));
                        }}
                        className="w-full h-9 rounded-lg border border-white/10 bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">(Automático / Segundo disponível)</option>
                        {ads.map((a) => (
                          <option key={a.key} value={a.id || a.key}>
                            {a.title || 'Sem título'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {listAdsConfig.slots?.end?.enabled && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground/90">
                        Parceiro para o Fim (Rodapé):
                      </label>
                      <select
                        value={listAdsConfig.slots?.end?.adId || ''}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null;
                          setListAdsConfig((prev) => ({
                            ...prev,
                            slots: { ...prev.slots, end: { ...prev.slots?.end, adId: val } },
                          }));
                        }}
                        className="w-full h-9 rounded-lg border border-white/10 bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">(Automático / Terceiro disponível)</option>
                        {ads.map((a) => (
                          <option key={a.key} value={a.id || a.key}>
                            {a.title || 'Sem título'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {listAdsConfig.mode === 'random' && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-foreground/90">
                    Parceiros no Sorteio Aleatório:
                  </label>
                  <div className="space-y-1 max-h-36 overflow-y-auto p-2 rounded-xl bg-black/20 border border-white/10">
                    {ads.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground p-1">Nenhum parceiro cadastrado.</p>
                    ) : (
                      ads.map((a) => {
                        const idVal = a.id || a.key;
                        const isChecked = listAdsConfig.randomPool?.includes(idVal);
                        return (
                          <div
                            key={a.key}
                            className="flex items-center p-1.5 rounded-lg hover:bg-white/5 transition"
                          >
                            <Checkbox
                              id={`pool-${a.key}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                setListAdsConfig((prev) => {
                                  const current = prev.randomPool || [];
                                  const updated = checked
                                    ? [...new Set([...current, idVal])]
                                    : current.filter((x) => x !== idVal);
                                  return { ...prev, randomPool: updated };
                                });
                              }}
                              className="w-full"
                            >
                              <span className="truncate">{a.title || 'Sem título'}</span>
                            </Checkbox>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {listAdsConfig.randomPool?.length
                      ? `${listAdsConfig.randomPool.length} parceiro(s) selecionado(s) para o sorteio.`
                      : 'Nenhum parceiro marcado: todos os cadastrados entrarão no sorteio.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* LISTA DE PARCEIROS CADASTRADOS (RETRACTABLE LIST VIEW) */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Megaphone className="h-3.5 w-3.5 text-amber-400" />
                Parceiros Cadastrados ({ads.length})
              </span>
              {ads.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleExpandAll}
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition cursor-pointer"
                >
                  {expandedAdKeys.size === ads.length ? 'Recolher todos' : 'Expandir todos'}
                </button>
              )}
            </div>

            {ads.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-4">
                Nenhum parceiro cadastrado ainda.
              </p>
            ) : (
              ads.map((ad, idx) => {
                const isExpanded = expandedAdKeys.has(ad.key);
                const dotColor = STYLE_DOT_COLOR[ad.style || ''] || 'bg-slate-400';

                return (
                  <div
                    key={ad.key}
                    className={cn(
                      "rounded-xl border transition-all duration-200",
                      isExpanded
                        ? "border-amber-500/30 bg-background/70 shadow-sm"
                        : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]"
                    )}
                  >
                    {/* Compact Retractable Header */}
                    <div
                      onClick={() => toggleExpandAd(ad.key)}
                      className="flex items-center justify-between p-3 cursor-pointer select-none gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Badge
                          variant="outline"
                          className="border-amber-500/30 text-amber-300 text-[11px] font-bold shrink-0 px-1.5 py-0.5"
                        >
                          #{idx + 1}
                        </Badge>

                        <span className={cn("h-2.5 w-2.5 rounded-full shrink-0 shadow-sm ring-1 ring-white/20", dotColor)} />

                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-foreground truncate">
                            {ad.title || 'Sem título'}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                            {ad.url || 'https://t.me/...'}
                          </div>
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveAd(idx, idx - 1)}
                          className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition cursor-pointer"
                          title="Mover para cima"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === ads.length - 1}
                          onClick={() => handleMoveAd(idx, idx + 1)}
                          className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition cursor-pointer"
                          title="Mover para baixo"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveAd(ad)}
                          className="p-1 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition cursor-pointer ml-0.5"
                          title="Remover parceiro"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleExpandAd(ad.key)}
                          className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition cursor-pointer ml-0.5"
                          title={isExpanded ? "Recolher detalhes" : "Expandir detalhes"}
                        >
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform duration-200",
                              isExpanded && "rotate-180 text-amber-400"
                            )}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Retractable / Collapsible Form Details */}
                    {isExpanded && (
                      <div className="border-t border-white/10 p-3 pt-2.5 space-y-3 bg-black/10 rounded-b-xl animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-foreground/80">Título do Botão</label>
                          <Input
                            type="text"
                            value={ad.title || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setAds((prev) =>
                                prev.map((a) => (a.key === ad.key ? { ...a, title: val } : a))
                              );
                            }}
                            placeholder="Ex: Canal Parceiro"
                            className="h-9 bg-white/5 border-white/10 text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-foreground/80">Link do Telegram</label>
                          <Input
                            type="url"
                            value={ad.url || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setAds((prev) =>
                                prev.map((a) => (a.key === ad.key ? { ...a, url: val } : a))
                              );
                            }}
                            placeholder="https://t.me/..."
                            className="h-9 bg-white/5 border-white/10 text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-foreground/80">Cor do Botão</label>
                          <ColorPicker
                            value={ad.style || ''}
                            onChange={(val) => {
                              setAds((prev) =>
                                prev.map((a) => (a.key === ad.key ? { ...a, style: val } : a))
                              );
                            }}
                            inheritLabel="Padrão"
                            className="w-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (ads.length >= 100) {
                  toast('Limite de 100 divulgações por lista.', 'warning');
                  return;
                }
                const newKey = nextKey();
                const newAd = {
                  key: newKey,
                  title: `Novo Parceiro ${ads.length + 1}`,
                  url: 'https://t.me/',
                  style: 'primary',
                };
                setAds((prev) => [...prev, newAd]);
                setExpandedAdKeys((prev) => new Set([...prev, newKey]));
              }}
              className="w-full border-dashed border-white/20 text-foreground/80 hover:border-amber-500/50"
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar Novo Parceiro
            </Button>
          </div>
        </div>

        <DialogFooter className="pt-3">
          <Button
            variant="primary"
            onClick={() => setAdsModalOpen(false)}
            className="w-full sm:w-auto font-semibold"
          >
            Pronto
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
