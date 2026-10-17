import * as React from 'react';
import {
  Grid,
  Eye,
  Plus,
  Minus,
  Move,
  Trash2,
  Sparkles,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  SlidersHorizontal,
  Megaphone,
  Check,
  RotateCcw,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/Dialog';
import { useToast } from './ui/Toast';
import { callEndpoint, haptic } from '@/lib/telegram';
import { layoutPattern, repeatRows, paginateRows } from '@/lib/layout';
import { resolveStyle, COLOR_OPTIONS } from '@/lib/utils';

export function OrganizeTab({ data, onRefresh, isDemo }) {
  const { toast } = useToast();
  const [subView, setSubView] = React.useState('organize'); // 'organize' | 'preview'
  const [editorColumns, setEditorColumns] = React.useState(2);
  const [rows, setRows] = React.useState([[]]);
  const [ads, setAds] = React.useState([]);
  const [removedAdIds, setRemovedAdIds] = React.useState(new Set());
  const [selectedTokenKey, setSelectedTokenKey] = React.useState(null);
  const [selectedAdKey, setSelectedAdKey] = React.useState(null);
  const [selectedRowIndex, setSelectedRowIndex] = React.useState(null);

  // Message & order settings
  const [messageText, setMessageText] = React.useState('');
  const [order, setOrder] = React.useState('alphabetical');
  const [groupCategories, setGroupCategories] = React.useState(false);

  // Preview state
  const [previewPage, setPreviewPage] = React.useState(0);
  const [previewColorMode, setPreviewColorMode] = React.useState('telegram'); // 'telegram' | 'plain'

  // Modals
  const [adsModalOpen, setAdsModalOpen] = React.useState(false);
  const [pickerModalOpen, setPickerModalOpen] = React.useState(false);
  const [pickerTargetRow, setPickerTargetRow] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  // Key generator for local tokens
  const tokenSerialRef = React.useRef(100);
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
    const cols = Math.max(2, Math.max(...pattern, 2));
    setEditorColumns(cols);

    // Build rows with sample tokens
    const initialRows = pattern.map((count) =>
      Array.from({ length: count }, () => ({
        key: nextKey(),
        name: `Canal ${tokenSerialRef.current % 100}`,
      }))
    );

    // Inject ads into their slots
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

    while (initialRows.length < 4) initialRows.push([]);
    setRows(initialRows);
  }, [data]);

  // Derived pattern
  const currentPattern = rows.filter((r) => r.length > 0).map((r) => r.length);

  // Find if an ad has a token placed in the grid
  const getAdPlacement = (adKey) => {
    for (let r = 0; r < rows.length; r++) {
      const c = rows[r].findIndex((t) => t?.adKey === adKey);
      if (c >= 0) return { row: r, col: c };
    }
    return null;
  };

  const unplacedAds = ads.filter((ad) => !getAdPlacement(ad.key));

  // Stepper handlers
  const handleAddRow = () => {
    if (rows.length >= 20) return;
    haptic('light');
    setRows((prev) => [...prev, []]);
  };

  const handleRemoveRow = (idx = rows.length - 1) => {
    if (rows.length <= 1) return;
    haptic('light');
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setSelectedRowIndex(null);
    setSelectedTokenKey(null);
  };

  const handleAddColumn = () => {
    if (editorColumns >= 5) return;
    haptic('light');
    setEditorColumns((c) => Math.min(5, c + 1));
  };

  const handleRemoveColumn = () => {
    if (editorColumns <= 1) return;
    if (rows.some((r) => r.length >= editorColumns)) {
      toast('Mova ou remova botões antes de reduzir as colunas.', 'warning');
      return;
    }
    haptic('light');
    setEditorColumns((c) => Math.max(1, c - 1));
  };

  // Move token
  const handleSlotClick = (rowIndex, colIndex, existingToken) => {
    // If an ad chip is selected, place it here
    if (selectedAdKey) {
      const ad = ads.find((a) => a.key === selectedAdKey);
      if (!ad) return;
      haptic('light');
      setRows((prev) => {
        const next = prev.map((r) => [...r]);
        const targetRow = next[rowIndex];
        const token = { key: nextKey(), name: ad.title, adKey: ad.key };
        targetRow.splice(colIndex, 0, token);
        return next;
      });
      setSelectedAdKey(null);
      setSelectedTokenKey(null);
      return;
    }

    // If moving an existing token
    if (selectedTokenKey) {
      if (existingToken && existingToken.key === selectedTokenKey) {
        setSelectedTokenKey(null);
        return;
      }

      haptic('light');
      setRows((prev) => {
        const next = prev.map((r) => [...r]);
        let tokenToMove = null;

        for (const row of next) {
          const idx = row.findIndex((t) => t.key === selectedTokenKey);
          if (idx >= 0) {
            tokenToMove = row.splice(idx, 1)[0];
            break;
          }
        }

        if (tokenToMove) {
          if (next[rowIndex].length >= editorColumns) {
            toast('Linha cheia. Aumente as colunas ou remova um botão.', 'warning');
            return prev;
          }
          next[rowIndex].splice(colIndex, 0, tokenToMove);
        }
        return next;
      });
      setSelectedTokenKey(null);
      return;
    }

    // If clicking on existing token, select it
    if (existingToken) {
      haptic('selection');
      setSelectedTokenKey(existingToken.key);
      return;
    }

    // Empty slot: open button picker for this row
    setPickerTargetRow(rowIndex);
    setPickerModalOpen(true);
  };

  const handleApplyPreset = (preset) => {
    haptic('medium');
    setRows(
      preset.map((n) =>
        Array.from({ length: n }, () => ({
          key: nextKey(),
          name: `Canal ${tokenSerialRef.current % 100}`,
        }))
      )
    );
    setEditorColumns(Math.max(2, ...preset));
    setSelectedTokenKey(null);
    setSelectedAdKey(null);
    toast(`Padrão ${preset.join(' → ')} aplicado!`, 'info');
  };

  // Save List Settings and Ads
  const handleSave = async (e) => {
    e?.preventDefault();
    if (!currentPattern.length) {
      toast('Adicione pelo menos um botão ao padrão.', 'error');
      return;
    }

    // Validate ads
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

    // Ads not placed in the grid are removed
    for (const ad of ads) {
      if (ad.id > 0 && !getAdPlacement(ad.key)) {
        remove.push(ad.id);
      }
    }

    if (isDemo) {
      toast('Organização da lista salva com sucesso! (Modo Demo)', 'success');
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

      await callEndpoint('saveSettings', {
        settings: updatedSettings,
        version: data?.version,
      });

      toast('Organização da lista salva com sucesso!', 'success');
      onRefresh?.();
    } catch (err) {
      toast(err.message || 'Falha ao salvar organização', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Preview Generation
  const approvedChats = (data?.chats || []).filter((c) => c.status === 'approved');
  const demoFallbackChats = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    title: `Canal Exemplo ${i + 1}`,
    display: '',
    category: i % 4,
    type: i % 2 === 0 ? 'channel' : 'group',
    style: i % 3 === 0 ? 'primary' : i % 3 === 1 ? 'success' : '',
  }));

  const activeItems = (approvedChats.length ? approvedChats : demoFallbackChats).slice();

  // Sort
  if (order === 'manual') {
    activeItems.sort((a, b) => (a.position || 0) - (b.position || 0) || a.id - b.id);
  } else {
    activeItems.sort((a, b) => (a.display || a.title).localeCompare(b.display || b.title, 'pt-BR'));
  }
  if (groupCategories) {
    activeItems.sort((a, b) => (a.category || 0) - (b.category || 0));
  }

  // Build preview slots from placed ads
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
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      {/* Top View Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-xl bg-slate-900/90 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => {
              haptic('selection');
              setSubView('organize');
            }}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              subView === 'organize'
                ? 'bg-sky-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Grid className="h-3.5 w-3.5" />
            Organizar Grade
          </button>
          <button
            type="button"
            onClick={() => {
              haptic('selection');
              setSubView('preview');
            }}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              subView === 'preview'
                ? 'bg-sky-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-slate-200'
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
          className="shadow-md shadow-sky-500/20"
        >
          {saving ? 'Salvando...' : 'Salvar Organização'}
        </Button>
      </div>

      {/* VIEW: ORGANIZE GRID */}
      {subView === 'organize' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Controls: Steppers & Presets */}
          <Card className="border-slate-800">
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Linhas Stepper */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-300">Linhas (X):</span>
                  <div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveRow()}
                      disabled={rows.length <= 1}
                      className="h-7 w-7 text-slate-400 hover:text-slate-100"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-8 text-center text-xs font-bold text-white">
                      {rows.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleAddRow}
                      disabled={rows.length >= 20}
                      className="h-7 w-7 text-slate-400 hover:text-slate-100"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Colunas Stepper */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-300">Colunas (Y):</span>
                  <div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRemoveColumn}
                      disabled={editorColumns <= 1}
                      className="h-7 w-7 text-slate-400 hover:text-slate-100"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-8 text-center text-xs font-bold text-white">
                      {editorColumns}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleAddColumn}
                      disabled={editorColumns >= 5}
                      className="h-7 w-7 text-slate-400 hover:text-slate-100"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Presets */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="text-xs font-medium mr-1">Exemplos:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset([1, 2, 1])}
                    className="rounded-lg bg-slate-800 px-2.5 py-1 text-slate-200 hover:bg-slate-700 transition cursor-pointer"
                  >
                    1 → 2 → 1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset([2, 2])}
                    className="rounded-lg bg-slate-800 px-2.5 py-1 text-slate-200 hover:bg-slate-700 transition cursor-pointer"
                  >
                    2 → 2
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset([1, 1, 1])}
                    className="rounded-lg bg-slate-800 px-2.5 py-1 text-slate-200 hover:bg-slate-700 transition cursor-pointer"
                  >
                    1 → 1 → 1
                  </button>
                </div>
              </div>

              {/* Pattern Summary */}
              <div className="flex items-center justify-between rounded-xl bg-slate-950/60 p-3 border border-slate-800/80 text-xs">
                <span className="text-slate-400">Padrão atual de repetição:</span>
                <span className="font-mono font-bold text-sky-400">
                  {currentPattern.join(' → ') || 'Vazio'} (repete na lista)
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Interactive Grid Canvas */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
            {/* Column Header Labels */}
            <div
              className="grid gap-2 text-center text-[11px] font-mono font-semibold text-slate-400 pb-1"
              style={{
                gridTemplateColumns: `50px repeat(${editorColumns}, minmax(0, 1fr))`,
              }}
            >
              <span className="text-left">Linhas</span>
              {Array.from({ length: editorColumns }, (_, i) => (
                <span key={i}>Y{i + 1}</span>
              ))}
            </div>

            {/* Rows */}
            {rows.map((row, rIdx) => (
              <div
                key={rIdx}
                className="grid gap-2 items-center"
                style={{
                  gridTemplateColumns: `50px repeat(${editorColumns}, minmax(0, 1fr))`,
                }}
              >
                {/* Row Label / Action */}
                <button
                  type="button"
                  onClick={() => handleRemoveRow(rIdx)}
                  className="flex h-11 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-slate-400 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-900 transition"
                  title="Clique para excluir esta linha"
                >
                  X{rIdx + 1}
                </button>

                {/* Slots in this row */}
                {Array.from({ length: editorColumns }, (_, cIdx) => {
                  const token = row[cIdx];
                  const isSelected = selectedTokenKey === token?.key;
                  const ad = token?.adKey ? ads.find((a) => a.key === token.adKey) : null;

                  return (
                    <div key={cIdx} className="h-11">
                      {token ? (
                        <button
                          type="button"
                          onClick={() => handleSlotClick(rIdx, cIdx, token)}
                          className={`w-full h-full flex items-center justify-between px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer truncate ${
                            isSelected
                              ? 'border-sky-400 bg-sky-500/20 text-sky-200 ring-2 ring-sky-500/40'
                              : ad
                              ? 'border-amber-500/40 bg-amber-950/30 text-amber-200 hover:border-amber-400'
                              : 'border-slate-700 bg-slate-800 text-slate-100 hover:border-slate-600'
                          }`}
                        >
                          <span className="truncate flex items-center gap-1.5">
                            {ad ? <Megaphone className="h-3 w-3 text-amber-400 shrink-0" /> : null}
                            {token.name}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0 ml-1">⋮⋮</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSlotClick(rIdx, cIdx, null)}
                          className={`w-full h-full flex items-center justify-center rounded-xl border border-dashed transition-all cursor-pointer ${
                            selectedTokenKey || selectedAdKey
                              ? 'border-sky-500 bg-sky-950/30 text-sky-300 animate-pulse hover:bg-sky-900/40'
                              : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                          }`}
                          title="Clique para inserir botão aqui"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Unplaced Ads Chips Banner */}
          {unplacedAds.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 space-y-2">
              <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                <Megaphone className="h-3.5 w-3.5" />
                Divulgações fora do padrão — toque para posicionar na grade:
              </span>
              <div className="flex flex-wrap gap-2">
                {unplacedAds.map((ad) => (
                  <button
                    key={ad.key}
                    type="button"
                    onClick={() => {
                      haptic('selection');
                      setSelectedAdKey(selectedAdKey === ad.key ? null : ad.key);
                      setSelectedTokenKey(null);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all cursor-pointer ${
                      selectedAdKey === ad.key
                        ? 'border-amber-400 bg-amber-500 text-slate-950 font-bold'
                        : 'border-amber-500/40 bg-amber-900/30 text-amber-200 hover:bg-amber-900/50'
                    }`}
                  >
                    🔆 {ad.title || 'Sem título'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Row: Ads Manager & Add Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAdsModalOpen(true)}
                className="border-slate-700 bg-slate-900/80 text-amber-300 hover:bg-amber-950/30 hover:border-amber-500/40"
              >
                <Megaphone className="h-3.5 w-3.5 mr-1 text-amber-400" />
                Gerenciar Divulgações ({ads.length})
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPickerTargetRow(undefined);
                  setPickerModalOpen(true);
                }}
                className="border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Adicionar Botões
              </Button>
            </div>

            {selectedTokenKey && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setRows((prev) =>
                    prev.map((row) => row.filter((t) => t.key !== selectedTokenKey))
                  );
                  setSelectedTokenKey(null);
                  toast('Botão removido da grade.', 'info');
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Remover selecionado
              </Button>
            )}
          </div>

          {/* Collapsible Details: Publication Message & Channel Order */}
          <Card className="border-slate-800">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-sky-400" />
                Mensagem e Regras de Ordenação
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Texto da publicação (suporta HTML do Telegram: &lt;b&gt;, &lt;i&gt;, &lt;blockquote&gt;)
                </label>
                <textarea
                  rows={4}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Escreva a mensagem oficial que acompanha os botões..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Ordem dos participantes</label>
                  <select
                    value={order}
                    onChange={(e) => setOrder(e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="alphabetical">Alfabética (A-Z)</option>
                    <option value="manual">Posição manual cadastrada</option>
                    <option value="rotate">Alternar / Rodízio a cada envio</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="group-categories"
                    checked={groupCategories}
                    onChange={(e) => setGroupCategories(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500 cursor-pointer"
                  />
                  <label
                    htmlFor="group-categories"
                    className="text-xs font-medium text-slate-200 cursor-pointer"
                  >
                    Agrupar botões por categoria
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* VIEW: LIVE TELEGRAM PREVIEW */}
      {subView === 'preview' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Controls Bar for Preview */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900/90 p-3 border border-slate-800">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">Estilo de cores:</span>
              <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setPreviewColorMode('telegram')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                    previewColorMode === 'telegram'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🎨 Cores Telegram
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewColorMode('plain')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                    previewColorMode === 'plain'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ⚪ Neutro
                </button>
              </div>
            </div>

            {previewPages.length > 1 && (
              <div className="flex items-center gap-2 text-xs">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewPage((p) => Math.max(0, p - 1))}
                  disabled={previewPage === 0}
                  className="h-7 px-2"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="font-mono text-slate-300">
                  {previewPage + 1} de {previewPages.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewPage((p) => Math.min(previewPages.length - 1, p + 1))}
                  disabled={previewPage === previewPages.length - 1}
                  className="h-7 px-2"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Telegram Wallpaper Container */}
          <div className="telegram-chat-wallpaper rounded-3xl p-4 sm:p-6 shadow-inner border border-slate-800 overflow-hidden flex flex-col items-center">
            {/* Telegram Speech Bubble */}
            <div className="w-full max-w-md rounded-2xl bg-[#1e2c3a] p-4 text-[#e1e9f0] shadow-md border border-[#2b3c4f]/50 space-y-3">
              {/* Message text with HTML formatting */}
              <div
                className="text-sm leading-relaxed whitespace-pre-wrap break-words"
                dangerouslySetInnerHTML={{
                  __html:
                    messageText ||
                    '<b>📢 Conheça nossos canais e grupos parceiros!</b>\n\n<blockquote>Toque nos botões abaixo para participar e conferir os conteúdos exclusivos.</blockquote>',
                }}
              />

              {previewPages.length > 1 && (
                <div className="text-[11px] text-sky-300 font-semibold pt-1">
                  Parte {previewPage + 1} de {previewPages.length}
                </div>
              )}

              {/* Time & Double Checkmarks */}
              <div className="flex justify-end items-center gap-1 text-[11px] text-slate-400 pt-1">
                <span>12:00</span>
                <span className="text-sky-400 font-bold">✓✓</span>
              </div>
            </div>

            {/* Telegram Inline Keyboard Buttons */}
            <div className="w-full max-w-md mt-2 space-y-1.5">
              {currentPageRows.map((row, rIdx) => (
                <div
                  key={rIdx}
                  className="grid gap-1.5"
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
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer truncate select-none ${
                          rawStyle === 'primary'
                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                            : rawStyle === 'success'
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : rawStyle === 'danger'
                            ? 'bg-rose-600 hover:bg-rose-500 text-white'
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

      {/* MODAL: ADS (DIVULGAÇÕES) MANAGER */}
      <Dialog open={adsModalOpen} onOpenChange={setAdsModalOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-amber-400" />
            Divulgações Parceiras
          </DialogTitle>
          <DialogDescription>
            Botões fixos de parceiros que aparecem em posições estratégicas na grade do Telegram.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1">
          {ads.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-6">
              Nenhuma divulgação cadastrada ainda.
            </p>
          ) : (
            ads.map((ad, idx) => (
              <div
                key={ad.key}
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-3"
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
                  <label className="text-[11px] font-semibold text-slate-300">Título no Botão</label>
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
                    placeholder="Ex: Canal Parceiro Oficial"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Link do Telegram</label>
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
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Cor do Botão</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {COLOR_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setAds((prev) =>
                            prev.map((a) => (a.key === ad.key ? { ...a, style: opt.value } : a))
                          );
                        }}
                        className={`py-1.5 rounded-lg text-xs font-semibold border transition ${
                          (ad.style || '') === opt.value
                            ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                            : 'border-slate-800 bg-slate-900 text-slate-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
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
            }}
            className="w-full border-dashed border-slate-700 text-slate-300 hover:border-amber-500/50"
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Nova Divulgação
          </Button>
        </div>

        <DialogFooter>
          <Button variant="primary" onClick={() => setAdsModalOpen(false)}>
            Concluir
          </Button>
        </DialogFooter>
      </Dialog>

      {/* MODAL: BUTTON PICKER */}
      <Dialog open={pickerModalOpen} onOpenChange={setPickerModalOpen}>
        <DialogHeader>
          <DialogTitle>Adicionar Botões à Grade</DialogTitle>
          <DialogDescription>
            Escolha entre canais cadastrados ou gere botões fictícios para desenhar o layout.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl bg-slate-950 p-4 border border-slate-800 space-y-3">
            <span className="text-xs font-semibold text-slate-300 block">
              Inserir botões de exemplo (Fictícios):
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const token = {
                    key: nextKey(),
                    name: `Exemplo ${tokenSerialRef.current % 100}`,
                  };
                  setRows((prev) => {
                    const next = prev.map((r) => [...r]);
                    const target = pickerTargetRow != null ? next[pickerTargetRow] : next[0];
                    if (target) target.push(token);
                    return next;
                  });
                  setPickerModalOpen(false);
                  toast('Botão adicionado!', 'info');
                }}
              >
                + 1 Botão
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const tokens = Array.from({ length: 2 }, () => ({
                    key: nextKey(),
                    name: `Exemplo ${tokenSerialRef.current % 100}`,
                  }));
                  setRows((prev) => {
                    const next = prev.map((r) => [...r]);
                    const target = pickerTargetRow != null ? next[pickerTargetRow] : next[0];
                    if (target) target.push(...tokens);
                    return next;
                  });
                  setPickerModalOpen(false);
                  toast('2 Botões adicionados!', 'info');
                }}
              >
                + 2 Botões
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setPickerModalOpen(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
