import * as React from 'react';
import {
  Grid,
  Eye,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Megaphone,
  Check,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/Dialog';
import { ColorPicker } from './ui/ColorPicker';
import { useToast } from './ui/Toast';
import { callEndpoint, saveSettingsSafe, haptic } from '@/lib/telegram';
import { layoutPattern, repeatRows, paginateRows } from '@/lib/layout';
import { resolveStyle } from '@/lib/utils';

export function OrganizeTab({ data, onRefresh, isDemo, onSyncVersion }) {
  const { toast } = useToast();
  const [subView, setSubView] = React.useState('organize'); // 'organize' | 'preview'
  const [rows, setRows] = React.useState([[1, 2]]);
  const [ads, setAds] = React.useState([]);
  const [removedAdIds, setRemovedAdIds] = React.useState(new Set());
  const [selectedTokenKey, setSelectedTokenKey] = React.useState(null);

  // Message & order
  const [messageText, setMessageText] = React.useState('');
  const [order, setOrder] = React.useState('alphabetical');
  const [groupCategories, setGroupCategories] = React.useState(false);

  // Preview state
  const [previewPage, setPreviewPage] = React.useState(0);
  const [previewColorMode, setPreviewColorMode] = React.useState('telegram');

  // Modals
  const [adsModalOpen, setAdsModalOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const tokenSerialRef = React.useRef(200);
  const nextKey = () => ++tokenSerialRef.current;

  // Initialize draft from data.settings & data.ads
  React.useEffect(() => {
    if (!data?.settings) return;
    const s = data.settings;
    setMessageText(s.text || '');
    setOrder(s.order || 'alphabetical');
    setGroupCategories(Boolean(s.groupCategories));

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

    // Place ads in their designated slots
    for (const ad of initialAds) {
      if (
        ad.slot_row != null &&
        ad.slot_row >= 0 &&
        ad.slot_row < initialRows.length &&
        ad.slot_col != null &&
        ad.slot_col >= 0 &&
        ad.slot_col < initialRows[ad.slot_row].length
      ) {
        initialRows[ad.slot_row][ad.slot_col] = {
          key: nextKey(),
          name: ad.title,
          adKey: ad.key,
        };
      }
    }

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

  // Save List Settings and Ads
  const handleSave = async () => {
    if (!currentPattern.length) {
      toast('Adicione pelo menos um botão ao padrão.', 'error');
      return;
    }

    const upsert = [];
    const remove = [...removedAdIds];

    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        const token = rows[r][c];
        if (token?.adKey) {
          const ad = ads.find((a) => a.key === token.adKey);
          if (ad) {
            const title = (ad.title || '').trim();
            if (!title) {
              toast('Dê um nome a todos os botões de divulgação.', 'error');
              return;
            }
            if (!/^https:\/\/t\.me\//.test(ad.url || '')) {
              toast(`Informe um link do Telegram (https://t.me/…) para “${title}”.`, 'error');
              return;
            }
            upsert.push({
              id: ad.id,
              title,
              url: ad.url.trim(),
              style: ad.style || '',
              row: r,
              col: c,
            });
          }
        }
      }
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
    title: `Canal ${i + 1}`,
    display: '',
    category: i % 4,
    type: i % 2 === 0 ? 'channel' : 'group',
    style: i % 3 === 0 ? 'primary' : i % 3 === 1 ? 'success' : '',
  }));

  const activeItems = (approvedChats.length ? approvedChats : fallbackChats).slice();

  if (order === 'manual') {
    activeItems.sort((a, b) => (a.position || 0) - (b.position || 0) || a.id - b.id);
  } else {
    activeItems.sort((a, b) => (a.display || a.title).localeCompare(b.display || b.title, 'pt-BR'));
  }
  if (groupCategories) {
    activeItems.sort((a, b) => (a.category || 0) - (b.category || 0));
  }

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
  const previewRows = repeatRows(activeItems, previewPattern, previewSlots);
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
                  <input
                    type="checkbox"
                    id="group-cat"
                    checked={groupCategories}
                    onChange={(e) => setGroupCategories(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-background text-primary focus:ring-primary cursor-pointer"
                  />
                  <label htmlFor="group-cat" className="text-xs text-foreground/90 cursor-pointer">
                    Agrupar por categoria
                  </label>
                </div>
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
            <div className="flex items-center gap-2 text-xs">
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
                  __html:
                    messageText ||
                    '<b>📢 Conheça nossos canais e grupos parceiros!</b>\n\n<blockquote>Toque nos botões abaixo para participar e conferir os conteúdos exclusivos.</blockquote>',
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
            Divulgações Parceiras
          </DialogTitle>
          <DialogDescription>
            Configure canais parceiros que aparecem em posições fixas na grade.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto space-y-3.5 pr-1">
          {ads.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-6">
              Nenhuma divulgação cadastrada.
            </p>
          ) : (
            ads.map((ad, idx) => (
              <div
                key={ad.key}
                className="rounded-xl border border-white/10 bg-background/50 p-3.5 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300">Parceiro #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (ad.id) setRemovedAdIds((prev) => new Set([...prev, ad.id]));
                      setAds((prev) => prev.filter((a) => a.key !== ad.key));
                      setRows((prev) =>
                        prev.map((row) => row.filter((t) => t.adKey !== ad.key))
                      );
                    }}
                    className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remover
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-foreground/80">Título</label>
                  <Input
                    type="text"
                    value={ad.title || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAds((prev) =>
                        prev.map((a) => (a.key === ad.key ? { ...a, title: val } : a))
                      );
                      setRows((prev) =>
                        prev.map((row) =>
                          row.map((t) => (t.adKey === ad.key ? { ...t, name: val } : t))
                        )
                      );
                    }}
                    placeholder="Ex: Canal Parceiro"
                    className="h-9 bg-white/5 border-white/10"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-foreground/80">Link</label>
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
                    className="h-9 bg-white/5 border-white/10"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-foreground/80">Cor</label>
                  <ColorPicker
                    value={ad.style || ''}
                    onChange={(val) => {
                      setAds((prev) =>
                        prev.map((a) => (a.key === ad.key ? { ...a, style: val } : a))
                      );
                    }}
                    inheritLabel="Padrão"
                  />
                </div>
              </div>
            ))
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const newAd = {
                key: nextKey(),
                title: 'Novo Parceiro',
                url: 'https://t.me/',
                style: 'primary',
              };
              setAds((prev) => [...prev, newAd]);
              // Add to first available row or new row
              setRows((prev) => {
                const next = prev.map((r) => [...r]);
                const token = { key: nextKey(), name: newAd.title, adKey: newAd.key };
                const free = next.find((r) => r.length < 5);
                if (free) free.push(token);
                else next.push([token]);
                return next;
              });
            }}
            className="w-full border-dashed border-white/20 text-foreground/80 hover:border-amber-500/50"
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Parceiro
          </Button>
        </div>

        <DialogFooter>
          <Button variant="primary" onClick={() => setAdsModalOpen(false)}>
            Pronto
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
