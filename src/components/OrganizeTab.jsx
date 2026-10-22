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
  SlidersHorizontal,
  Layers,
  Shuffle,
  Sparkles,
  Pencil,
  Tag,
  Users,
  Radio,
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
import { defaultLayoutRows, clampPageIndex } from '@/lib/layout';
import { buildPreviewPages } from '@/lib/preview';
import { sanitizeTelegramHtml, cn, isValidTelegramLink } from '@/lib/utils';

const BUTTON_STYLES = ['primary', 'success', 'danger'];

const STYLE_DOT_COLOR = {
  '': 'bg-slate-400',
  primary: 'bg-[#2481cc]',
  success: 'bg-[#2ea043]',
  danger: 'bg-[#e53935]',
};

const adOptionValue = (ad) =>
  Number.isSafeInteger(ad?.id) && ad.id > 0 ? String(ad.id) : `k${ad?.key}`;

const tokenAdValue = (token) =>
  Number.isSafeInteger(token?.adId) && token.adId > 0
    ? String(token.adId)
    : Number.isSafeInteger(token?.adKey)
    ? `k${token.adKey}`
    : '';

export function OrganizeTab({ data, onRefresh, isDemo, onSyncVersion }) {
  const { toast } = useToast();
  const [subView, setSubView] = React.useState('organize'); // 'organize' | 'preview'
  const [rows, setRows] = React.useState([[1, 2]]);
  const [ads, setAds] = React.useState([]);
  const [removedAdIds, setRemovedAdIds] = React.useState(new Set());
  const [selectedTokenKey, setSelectedTokenKey] = React.useState(null);
  const [expandedAdKeys, setExpandedAdKeys] = React.useState(() => new Set());

  // Custom button layout (the drawing used as the final list)
  const [layoutFill, setLayoutFill] = React.useState('random'); // 'random' | 'group' | 'channel'
  const [layoutRotate, setLayoutRotate] = React.useState(false);
  const [cellEditor, setCellEditor] = React.useState(null); // { rIdx, bIdx }
  const [cellKind, setCellKind] = React.useState('auto');
  const [cellChatId, setCellChatId] = React.useState('');
  const [cellAdId, setCellAdId] = React.useState('');
  const [cellStyle, setCellStyle] = React.useState('');

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
  const [testing, setTesting] = React.useState(false);

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
    setOrder(s.order === 'manual' ? 'manual' : 'alphabetical');
    setGroupCategories(Boolean(s.groupCategories));
    setLayoutFill(['random', 'group', 'channel'].includes(s.buttonLayout?.fill) ? s.buttonLayout.fill : 'random');
    setLayoutRotate(Boolean(s.buttonLayout?.rotate));
    setCellEditor(null);

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

    const savedLayout = Array.isArray(s.buttonLayout?.rows) ? s.buttonLayout.rows : [];
    const hadSavedLayout = savedLayout.length > 0;
    let initialRows = savedLayout.length
      ? savedLayout
          .map((row) =>
            row
              .map((cell) => {
                const style = BUTTON_STYLES.includes(cell?.style) ? cell.style : '';
                if (cell?.kind === 'chat' && Number.isSafeInteger(cell.chatId)) {
                  return { key: nextKey(), kind: 'chat', chatId: cell.chatId, style };
                }
                if (cell?.kind === 'ad' && Number.isSafeInteger(cell.adId)) {
                  const stillExists = initialAds.some((a) => Number(a.id) === cell.adId);
                  return stillExists
                    ? { key: nextKey(), kind: 'ad', adId: cell.adId, style }
                    : null;
                }
                if (cell?.kind === 'adRandom') {
                  return { key: nextKey(), kind: 'adRandom', style };
                }
                return { key: nextKey(), kind: 'auto', style };
              })
              .filter(Boolean)
          )
          .filter((row) => row.length)
      : [];

    if (!initialRows.length && !hadSavedLayout) {
      initialRows = defaultLayoutRows().map((row) =>
        row.map(() => ({ key: nextKey(), kind: 'auto' }))
      );
    }

    setRows(initialRows);
  }, [data]);

  const currentPattern = rows.filter((r) => r.length > 0).map((r) => r.length);
  const layoutAdCells = rows.flat().filter((t) => t.kind === 'ad' || t.kind === 'adRandom').length;
  const layoutChatCells = rows.flat().filter((t) => t.kind !== 'ad' && t.kind !== 'adRandom').length;

  // Row operations
  const handleAddRow = () => {
    if (rows.length >= 15) return;
    haptic('light');
    setRows((prev) => [...prev, [{ key: nextKey(), kind: 'auto' }]]);
  };

  const handleInsertRow = (rIdx) => {
    if (rows.length >= 15) {
      toast('Máximo de 15 linhas no layout.', 'warning');
      return;
    }
    haptic('light');
    setRows((prev) => {
      if (prev.length >= 15) return prev;
      const next = prev.map((row) => [...row]);
      next.splice(rIdx + 1, 0, [{ key: nextKey(), kind: 'auto' }]);
      return next;
    });
    setSelectedTokenKey(null);
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
      next[rIdx].push({ key: nextKey(), kind: 'auto' });
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
        kind: 'auto',
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
    setRows((prev) => {
      let next = prev
        .map((row) =>
          row.filter((t) => {
            const matches =
              t.kind === 'ad' &&
              ((ad.id && t.adId === ad.id) || t.adKey === ad.key);
            return !matches;
          })
        )
        .filter((row) => row.length);

      // Removing an ad can leave more random-ad positions than registered ads.
      // Trim the extra random positions from the end instead of converting them
      // into chat buttons.
      let excess =
        next.flat().filter((t) => t.kind === 'ad' || t.kind === 'adRandom').length -
        (ads.length - 1);
      for (let r = next.length - 1; r >= 0 && excess > 0; r--) {
        for (let b = next[r].length - 1; b >= 0 && excess > 0; b--) {
          if (next[r][b].kind === 'adRandom') {
            next[r].splice(b, 1);
            excess--;
          }
        }
      }
      return next.filter((row) => row.length);
    });
    setCellEditor(null);
  };

  const openCellEditor = (rIdx, bIdx) => {
    const token = rows[rIdx]?.[bIdx];
    if (!token) return;
    haptic('selection');
    setCellEditor({ rIdx, bIdx });
    setCellKind(token.kind || 'auto');
    setCellChatId(token.chatId != null ? String(token.chatId) : '');
    setCellAdId(tokenAdValue(token));
    setCellStyle(BUTTON_STYLES.includes(token.style) ? token.style : '');
  };

  const handleApplyCell = () => {
    if (!cellEditor) return;
    const { rIdx, bIdx } = cellEditor;
    const appliedStyle = BUTTON_STYLES.includes(cellStyle) ? cellStyle : undefined;
    const current = rows[rIdx]?.[bIdx];
    const currentIsAd = current?.kind === 'ad' || current?.kind === 'adRandom';
    const usedAdCells = rows.reduce(
      (total, row, ri) =>
        total +
        row.filter(
          (t, bi) =>
            !(ri === rIdx && bi === bIdx) &&
            (t.kind === 'ad' || t.kind === 'adRandom')
        ).length,
      0
    );
    if (cellKind === 'adRandom' && !ads.length) {
      toast('Cadastre uma divulgação antes de criar uma posição aleatória.', 'error');
      return;
    }
    if (
      (cellKind === 'ad' || cellKind === 'adRandom') &&
      !currentIsAd &&
      usedAdCells >= ads.length
    ) {
      toast(
        `Você tem ${ads.length} divulgação(ões) cadastrada(s). Remova uma posição de divulgação ou cadastre outra antes de adicionar mais.`,
        'error'
      );
      return;
    }
    if (cellKind === 'chat') {
      const id = Number(cellChatId);
      if (!Number.isSafeInteger(id) || id === 0) {
        toast('Selecione um canal ou grupo para fixar.', 'error');
        return;
      }
      const alreadyUsed = rows.some((row, ri) =>
        row.some(
          (t, bi) =>
            !(ri === rIdx && bi === bIdx) && t.kind === 'chat' && Number(t.chatId) === id
        )
      );
      if (alreadyUsed) {
        toast('Este canal/grupo já está fixado em outra posição.', 'warning');
        return;
      }
      setRows((prev) =>
        prev.map((row, ri) =>
          ri !== rIdx
            ? row
            : row.map((t, bi) =>
                bi !== bIdx
                  ? t
                  : {
                      ...t,
                      kind: 'chat',
                      chatId: id,
                      adId: undefined,
                      adKey: undefined,
                      style: appliedStyle,
                    }
              )
        )
      );
    } else if (cellKind === 'ad') {
      const ref = String(cellAdId || '');
      const selectedAd = ref.startsWith('k')
        ? ads.find((ad) => ad.key === Number(ref.slice(1)))
        : ads.find((ad) => Number(ad.id) === Number(ref));
      if (!selectedAd) {
        toast('Selecione uma divulgação para fixar.', 'error');
        return;
      }
      const selectedRef = adOptionValue(selectedAd);
      const alreadyUsed = rows.some((row, ri) =>
        row.some(
          (t, bi) =>
            !(ri === rIdx && bi === bIdx) &&
            t.kind === 'ad' &&
            tokenAdValue(t) === selectedRef
        )
      );
      if (alreadyUsed) {
        toast('Esta divulgação já está fixada em outra posição.', 'warning');
        return;
      }
      setRows((prev) =>
        prev.map((row, ri) =>
          ri !== rIdx
            ? row
            : row.map((t, bi) =>
                bi !== bIdx
                  ? t
                  : {
                      ...t,
                      kind: 'ad',
                      adId: selectedAd.id,
                      adKey: selectedAd.id ? undefined : selectedAd.key,
                      chatId: undefined,
                      style: appliedStyle,
                    }
              )
        )
      );
    } else if (cellKind === 'adRandom') {
      setRows((prev) =>
        prev.map((row, ri) =>
          ri !== rIdx
            ? row
            : row.map((t, bi) =>
                bi !== bIdx
                  ? t
                  : {
                      ...t,
                      kind: 'adRandom',
                      chatId: undefined,
                      adId: undefined,
                      adKey: undefined,
                      style: appliedStyle,
                    }
              )
        )
      );
    } else {
      setRows((prev) =>
        prev.map((row, ri) =>
          ri !== rIdx
            ? row
            : row.map((t, bi) =>
                bi !== bIdx
                  ? t
                  : {
                      ...t,
                      kind: 'auto',
                      chatId: undefined,
                      adId: undefined,
                      adKey: undefined,
                      style: appliedStyle,
                    }
              )
        )
      );
    }
    haptic('light');
    setCellEditor(null);
  };

  // Save List Settings and Ads
  const persistDraft = async ({ notify = true, refresh = true } = {}) => {
    if (!currentPattern.length) {
      toast('Adicione pelo menos um botão ao padrão.', 'error');
      return false;
    }

    if (!rows.some((row) => row.length > 0)) {
      toast('Adicione ao menos uma linha ao layout personalizado.', 'error');
      return false;
    }

    // Validate ads before saving
    for (const ad of ads) {
      const title = (ad.title || '').trim();
      if (!title) {
        toast('Dê um nome a todas as divulgações cadastradas.', 'error');
        return false;
      }
      if (!/^https:\/\/t\.me\//.test(ad.url || '')) {
        toast(`Informe um link do Telegram (https://t.me/…) para “${title}”.`, 'error');
        return false;
      }
    }
    if (layoutAdCells > ads.length) {
      toast(
        `Você tem ${ads.length} divulgação(ões) cadastrada(s) e ${layoutAdCells} posição(ões) de divulgação no layout. Remova ${layoutAdCells - ads.length} posição(ões) ou cadastre mais divulgações.`,
        'error'
      );
      return false;
    }

    const upsert = [];
    const remove = [...removedAdIds];

    // Row/col are only a stable storage slot for the ad editor. The custom
    // layout decides where each fixed/random ad actually appears, so ads do not
    // consume the list's C/G positions.
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
      if (notify) toast('Organização da lista salva! (Modo Demo)', 'success');
      return true;
    }

    try {
      setSaving(true);
      haptic('heavy');

      let adKeyToId = new Map();
      if (upsert.length || remove.length) {
        const result = await callEndpoint('saveAds', {
          upsert,
          remove: [...new Set(remove)],
        });
        const savedAds = Array.isArray(result?.ads) ? result.ads : [];
        if (savedAds.length) {
          const byId = new Map(savedAds.map((ad) => [ad.id, ad]));
          const byPosition = new Map(
            savedAds.map((ad) => [`${ad.slot_row}_${ad.slot_col}`, ad])
          );
          const nextAds = ads.map((ad, index) => {
            const row = 16 + Math.floor(index / 5);
            const col = index % 5;
            const savedAd =
              (Number.isSafeInteger(ad.id) && byId.get(ad.id)) ||
              byPosition.get(`${row}_${col}`) ||
              (savedAds.length === ads.length ? savedAds[index] : null);
            if (!savedAd) return ad;
            if (!Number.isSafeInteger(ad.id) || ad.id <= 0) {
              adKeyToId.set(ad.key, savedAd.id);
            }
            return {
              ...ad,
              id: savedAd.id,
              slot_row: savedAd.slot_row,
              slot_col: savedAd.slot_col,
            };
          });
          setAds(nextAds);
          setRows((prev) =>
            prev.map((row) =>
              row.map((token) =>
                token.kind === 'ad' && token.adKey && adKeyToId.has(token.adKey)
                  ? { ...token, adId: adKeyToId.get(token.adKey), adKey: undefined }
                  : token
              )
            )
          );
        }
      }

      const layoutRows = rows
        .filter((row) => row.length > 0)
        .map((row) =>
          row.map((token) => {
            const style = BUTTON_STYLES.includes(token.style) ? token.style : '';
            const styleFields = style ? { style } : {};
            if (token.kind === 'chat' && Number.isSafeInteger(token.chatId)) {
              return { kind: 'chat', chatId: token.chatId, ...styleFields };
            }
            if (token.kind === 'ad') {
              const adId =
                Number.isSafeInteger(token.adId) && token.adId > 0
                  ? token.adId
                  : adKeyToId.get(token.adKey);
              if (!Number.isSafeInteger(adId) || adId <= 0) {
                throw new Error('Salve a divulgação antes de fixá-la no layout.');
              }
              return { kind: 'ad', adId, ...styleFields };
            }
            if (token.kind === 'adRandom') {
              return { kind: 'adRandom', ...styleFields };
            }
            return { kind: 'auto', ...styleFields };
          })
        );

      const updatedSettings = {
        ...data?.settings,
        text: messageText,
        order,
        groupCategories,
        rowPattern: currentPattern,
        columns: Math.max(1, ...currentPattern),
        listType: 'mixed',
        buttonLayout: {
          enabled: true,
          fill: layoutFill,
          rotate: layoutRotate,
          rows: layoutRows,
        },
      };

      await saveSettingsSafe(updatedSettings, data?.version, onSyncVersion);
      if (notify) toast('Organização salva com sucesso!', 'success');
      if (refresh) onRefresh?.();
      return true;
    } catch (err) {
      toast(err.message || 'Falha ao salvar organização', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    await persistDraft();
  };

  const handleTestLayout = async () => {
    if (isDemo) {
      toast('Modo Demo: layout de teste enviado para seu privado!', 'info');
      return;
    }
    setTesting(true);
    try {
      haptic('medium');
      const saved = await persistDraft({ notify: false, refresh: false });
      if (!saved) return;
      await callEndpoint('testList', {});
      toast('Layout de teste enviado ao seu privado!', 'success');
      onRefresh?.();
    } catch (err) {
      toast(err.message || 'Falha ao enviar o teste do layout', 'error');
    } finally {
      setTesting(false);
    }
  };

  // Preview Generation
  const approvedChats = (data?.chats || []).filter(
    (c) => c.status === 'approved' && isValidTelegramLink(c.url)
  );
  const usingPreviewFallback = approvedChats.length === 0;
  const pinnableAds = ads;
  const fallbackChats = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    title: i % 2 === 0 ? `Canal ${i + 1}` : `Grupo ${i + 1}`,
    display: '',
    category: i % 4,
    type: i % 2 === 0 ? 'channel' : 'group',
    style: i % 3 === 0 ? 'primary' : i % 3 === 1 ? 'success' : '',
    url: `https://t.me/demo${i + 1}`,
    status: 'approved',
  }));

  const baseItems = (approvedChats.length ? approvedChats : fallbackChats).slice();
  const activeItems = baseItems;
  const previewTargetType = '';

  const draftLayoutRows = rows
    .filter((row) => row.length > 0)
    .map((row) =>
      row.map((token) => {
        const style = BUTTON_STYLES.includes(token.style) ? token.style : '';
        const styleFields = style ? { style } : {};
        if (token.kind === 'chat' && Number.isSafeInteger(token.chatId)) {
          return { kind: 'chat', chatId: token.chatId, ...styleFields };
        }
        if (token.kind === 'ad' && Number.isSafeInteger(token.adId)) {
          return { kind: 'ad', adId: token.adId, ...styleFields };
        }
        if (token.kind === 'ad' && Number.isSafeInteger(token.adKey)) {
          return { kind: 'ad', adKey: token.adKey, ...styleFields };
        }
        if (token.kind === 'adRandom') {
          return { kind: 'adRandom', ...styleFields };
        }
        return { kind: 'auto', ...styleFields };
      })
    );

  const previewSettings = {
    ...(data?.settings || {}),
    text: messageText,
    order,
    groupCategories,
    rowPattern: currentPattern,
    columns: Math.max(1, ...currentPattern),
    listType: 'mixed',
    buttonLayout: {
      enabled: true,
      fill: layoutFill,
      rotate: layoutRotate,
      rows: draftLayoutRows,
    },
  };

  const previewPages = buildPreviewPages({
    chats: activeItems,
    settings: previewSettings,
    ads,
    seed: 0,
    botUsername: data?.bot?.username || '',
    targetType: previewTargetType,
    roundIndex: 0,
    destinationId: activeItems[0]?.id || 0,
  });
  const currentPreviewPage = clampPageIndex(previewPage, previewPages.length);
  const currentPageRows = previewPages[currentPreviewPage]?.rows || [];
  const currentPageText =
    previewPages[currentPreviewPage]?.text ||
    messageText ||
    '<b>📢 Conheça nossos canais e grupos parceiros!</b>\n\n<blockquote>Toque nos botões abaixo para participar e conferir os conteúdos exclusivos.</blockquote>';

  React.useEffect(() => {
    setPreviewPage(0);
  }, [layoutFill, layoutRotate, order, groupCategories, rows]);

  React.useEffect(() => {
    setPreviewPage((page) => clampPageIndex(page, previewPages.length));
  }, [previewPages.length]);

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
              setPreviewPage(0);
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
          {/* Custom button layout */}
          <Card className="border-primary/40 bg-primary/5 transition">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Layout Personalizado da Lista
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                    Ativo
                  </Badge>
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                O desenho abaixo é a lista final. Fixe canais, grupos e divulgações em posições
                exatas; os botões automáticos são preenchidos na hora do envio. O excedente de
                canais/grupos fica fora desta mensagem.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 pt-1 space-y-3 animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground/90">
                    Preencher botões automáticos com
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/20 border border-white/10">
                    {[
                      { id: 'random', label: 'Mistos', icon: Shuffle },
                      { id: 'channel', label: 'Canais', icon: Megaphone },
                      { id: 'group', label: 'Grupos', icon: Users },
                    ].map((option) => {
                      const Icon = option.icon;
                      const active = layoutFill === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            haptic('selection');
                            setLayoutFill(option.id);
                          }}
                          className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                            active
                              ? 'bg-primary text-white shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <Icon className="h-3 w-3" />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {layoutFill === 'random'
                      ? 'Canais e grupos aprovados disputam os botões automáticos, sem repetir o mesmo C/G nesta lista.'
                      : layoutFill === 'channel'
                      ? 'Apenas canais aprovados ocupam os botões automáticos. C/G fixos continuam nas posições definidas.'
                      : 'Apenas grupos aprovados ocupam os botões automáticos. C/G fixos continuam nas posições definidas.'}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Shuffle className="h-3.5 w-3.5 text-primary" />
                      Lista rotativa
                    </span>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Os botões automáticos e as divulgações aleatórias variam por canal/grupo na
                      mesma rodada e avançam a cada rodada. Os fixos não mudam.
                    </p>
                  </div>
                  <Switch
                    id="button-layout-rotate"
                    checked={layoutRotate}
                    onChange={(checked) => {
                      haptic('selection');
                      setLayoutRotate(checked);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>
                    C/G nesta lista: <strong className="text-foreground">{layoutChatCells}</strong>
                  </span>
                  <span>
                    Divulgações: <strong className="text-foreground">{layoutAdCells}</strong> de{' '}
                    <strong className="text-foreground">{ads.length}</strong> cadastrada(s)
                  </span>
                </div>

                <p className="text-[11px] leading-relaxed rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-amber-200/90">
                  A lista terá no máximo {layoutChatCells} botões de canal/grupo. Quem não couber
                  fica fora desta mensagem e não gera uma segunda parte. O rodapé não conta nesse
                  limite.
                </p>
                {layoutChatCells === 0 && (
                  <p className="text-[11px] leading-relaxed rounded-xl border border-rose-500/25 bg-rose-500/10 p-2.5 text-rose-200">
                    O layout está sem botões de C/G. Adicione uma linha se quiser canais ou grupos
                    nesta lista.
                  </p>
                )}
                {layoutAdCells > ads.length && (
                  <p className="text-[11px] leading-relaxed rounded-xl border border-rose-500/25 bg-rose-500/10 p-2.5 text-rose-200">
                    Há {layoutAdCells} posições de divulgação para {ads.length} divulgação(ões)
                    cadastrada(s). Remova posições ou cadastre mais divulgações para salvar.
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestLayout}
                  disabled={saving || testing}
                  className="w-full h-8 text-xs border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Radio className="h-3.5 w-3.5 mr-1" />
                  {testing ? 'Enviando teste...' : 'Salvar e testar no Telegram'}
                </Button>
              </CardContent>
          </Card>

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
                    const ad =
                      token.kind === 'ad'
                        ? ads.find(
                            (a) =>
                              (Number.isSafeInteger(token.adId) && a.id === token.adId) ||
                              (Number.isSafeInteger(token.adKey) && a.key === token.adKey)
                          )
                        : null;
                    const chat =
                      token.kind === 'chat'
                        ? (data?.chats || []).find((c) => Number(c.id) === Number(token.chatId))
                        : null;
                    const isAuto = !token.kind || token.kind === 'auto';
                    const isAdRandom = token.kind === 'adRandom';
                    const label = isAuto
                      ? `Automático ${bIdx + 1}`
                      : isAdRandom
                      ? 'Divulgação aleatória'
                      : ad
                      ? ad.title || 'Divulgação'
                      : chat
                      ? chat.display || chat.title
                      : token.kind === 'chat'
                      ? `Chat ${token.chatId}`
                      : 'Indisponível';

                    return (
                      <div
                        key={token.key}
                        onClick={() => handleTokenClick(rIdx, bIdx, token)}
                        className={`group relative flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer select-none ${
                          isSelected
                            ? 'border-primary bg-primary/20 text-white ring-2 ring-primary/40'
                            : ad || isAdRandom
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-200 hover:border-amber-400'
                            : chat
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400'
                            : 'border-dashed border-white/15 bg-white/5 text-muted-foreground hover:bg-white/10 hover:border-white/25'
                        }`}
                      >
                        <span className="truncate flex items-center gap-1.5">
                          {ad ? (
                            <Megaphone className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                          ) : isAdRandom ? (
                            <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                          ) : chat ? (
                            chat.type === 'channel' ? (
                              <Megaphone className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <Users className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            )
                          ) : (
                            <Shuffle className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                          )}
                          <span className="truncate">{label}</span>
                          {token.style && (
                            <span
                              className={cn(
                                'h-2 w-2 rounded-full shrink-0 ring-1 ring-white/20',
                                STYLE_DOT_COLOR[token.style] || 'bg-slate-400'
                              )}
                              title="Cor personalizada deste botão"
                            />
                          )}
                        </span>

                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openCellEditor(rIdx, bIdx);
                            }}
                            className="opacity-60 group-hover:opacity-100 hover:text-primary p-0.5 rounded transition"
                            title="Configurar este botão"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
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

                {rows.length < 15 && (
                  <button
                    type="button"
                    onClick={() => handleInsertRow(rIdx)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-white/10 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:border-white/25 hover:bg-white/5 transition cursor-pointer"
                    title="Inserir uma nova linha abaixo desta"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nova Linha
                  </button>
                )}
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

        </div>
      )}

      {/* VIEW: LIVE TELEGRAM PREVIEW */}
      {subView === 'preview' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-card border border-white/10">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {usingPreviewFallback && (
                <Badge variant="warning" className="text-[10px]">
                  Dados fictícios
                </Badge>
              )}
              {layoutRotate && (
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                  Lista rotativa: variação de exemplo
                </Badge>
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
                  onClick={() => setPreviewPage((p) => Math.max(0, clampPageIndex(p, previewPages.length) - 1))}
                  disabled={currentPreviewPage === 0}
                  className="h-7 px-2 border-white/10"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="font-mono text-muted-foreground">
                  {currentPreviewPage + 1} / {previewPages.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewPage((p) => Math.min(previewPages.length - 1, clampPageIndex(p, previewPages.length) + 1))}
                  disabled={currentPreviewPage === previewPages.length - 1}
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
                  __html: sanitizeTelegramHtml(currentPageText),
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
                    const rawStyle = previewColorMode === 'plain' ? '' : btn.style || '';

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
                        <span className="truncate">{btn.text}</span>
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
            Cadastre os parceiros e escolha as posições no Layout Personalizado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0 -mr-1 overscroll-contain">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-200/90">
            Use o lápis de um botão do layout para fixar uma divulgação ou marcar a posição como
            aleatória. Cada divulgação aparece no máximo uma vez por lista.
          </div>

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

      {/* Cell editor: pins a specific chat/ad or leaves the slot automatic */}
      <Dialog open={Boolean(cellEditor)} onOpenChange={(open) => !open && setCellEditor(null)}>
        <DialogHeader>
          <DialogTitle>Configurar Botão</DialogTitle>
          <DialogDescription>
            Defina o que aparece nesta posição do desenho. Os botões automáticos são preenchidos
            pelo bot no momento do envio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-black/20 border border-white/10">
            {[
              { id: 'auto', label: 'Automático', icon: Shuffle },
              { id: 'chat', label: 'C/G fixo', icon: Tag },
              { id: 'ad', label: 'Divulgação fixa', icon: Megaphone },
              { id: 'adRandom', label: 'Div. aleatória', icon: Sparkles },
            ].map((option) => {
              const Icon = option.icon;
              const active = cellKind === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    haptic('selection');
                    setCellKind(option.id);
                  }}
                  className={`py-2 px-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                    active
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {option.label}
                </button>
              );
            })}
          </div>

          {cellKind === 'chat' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/90">
                Canal ou grupo aprovado
              </label>
              <select
                value={cellChatId}
                onChange={(e) => setCellChatId(e.target.value)}
                className="w-full h-10 rounded-lg border border-white/10 bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Selecione...</option>
                {approvedChats
                  .slice()
                  .sort((a, b) => (a.display || a.title).localeCompare(b.display || b.title, 'pt-BR'))
                  .filter((chat) => {
                    if (Number(chat.id) === Number(cellChatId)) return true;
                    return !rows.some((row) =>
                      row.some((t) => t.kind === 'chat' && Number(t.chatId) === Number(chat.id))
                    );
                  })
                  .map((chat) => (
                    <option key={chat.id} value={chat.id}>
                      {chat.type === 'channel' ? '📢' : '💬'} {chat.display || chat.title}
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                O botão fica fixo nesta posição. Se o cadastro deixar de estar aprovado, o bot
                preenche a posição automaticamente.
              </p>
            </div>
          )}

          {cellKind === 'ad' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/90">Divulgação</label>
              {pinnableAds.length ? (
                <select
                  value={cellAdId}
                  onChange={(e) => setCellAdId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-white/10 bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Selecione...</option>
                  {pinnableAds
                    .filter((ad) => {
                      const option = adOptionValue(ad);
                      if (option === cellAdId) return true;
                      return !rows.some((row) =>
                        row.some(
                          (t) => t.kind === 'ad' && tokenAdValue(t) === option
                        )
                      );
                    })
                    .map((ad) => (
                      <option key={ad.key} value={adOptionValue(ad)}>
                        🔆 {ad.title || 'Sem título'}
                        {!Number.isSafeInteger(ad.id) || ad.id <= 0 ? ' (novo)' : ''}
                      </option>
                    ))}
                </select>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-muted-foreground">
                  Nenhuma divulgação cadastrada. Adicione uma em “Configurar Divulgações” para
                  fixá-la no layout.
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                A divulgação aparece neste botão apenas uma vez por lista. Divulgações novas são
                salvas junto com a organização.
              </p>
            </div>
          )}

          {cellKind === 'adRandom' && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200/90 leading-relaxed space-y-1">
              <p>
                Esta posição recebe uma divulgação ainda não usada nesta lista. Quando a lista
                rotativa está ativa, o parceiro escolhido varia por canal/grupo e a cada rodada.
              </p>
              <p className="text-[11px] text-amber-200/70">
                {ads.length} divulgação(ões) cadastrada(s) • {layoutAdCells} posição(ões) de
                divulgação no layout.
              </p>
            </div>
          )}

          {cellKind === 'auto' && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-muted-foreground leading-relaxed">
              Esta posição será preenchida automaticamente com um canal/grupo aprovado, seguindo a
              opção escolhida no layout (mistos, canais ou grupos). O mesmo C/G não se repete nesta
              lista.
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground/90">Cor deste botão</label>
            <ColorPicker
              value={cellStyle}
              onChange={setCellStyle}
              inheritLabel="Herdar"
            />
            <p className="text-[11px] text-muted-foreground">
              {cellKind === 'chat'
                ? 'Se o C/G tiver uma cor individual definida na aba Canais, ela continua tendo prioridade.'
                : cellKind === 'ad' || cellKind === 'adRandom'
                ? 'Esta cor prevalece sobre a cor cadastrada na divulgação.'
                : 'Aplicada ao C/G sorteado. Se ele tiver cor individual na aba Canais, ela prevalece.'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setCellEditor(null)}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleApplyCell}
            className="w-full sm:w-auto font-semibold"
          >
            Aplicar
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
