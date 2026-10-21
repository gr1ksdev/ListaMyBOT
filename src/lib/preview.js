import { layoutPattern, repeatRows, resolveListAds, buildLayoutRows, paginateRows } from './layout.js';
import { isValidTelegramLink, resolveStyle } from './utils.js';

const STYLES = ['primary', 'danger', 'success'];

function categoriesFor(settings) {
  const list = Array.isArray(settings?.categories)
    ? settings.categories.map((value) => String(value ?? '').trim())
    : [];
  return list;
}

// Mirrors tgcloud/lib/domain.js makePages so the panel preview shows exactly
// what the bot will send for the same settings.
export function buildPreviewPages({
  chats = [],
  settings = {},
  ads = [],
  seed = 0,
  botUsername = '',
  targetType = '',
} = {}) {
  let list = chats
    .filter((chat) => chat && chat.status === 'approved' && isValidTelegramLink(chat.url))
    .slice();

  if (settings.order === 'manual') {
    list.sort((a, b) => a.position - b.position || a.id - b.id);
  } else {
    list.sort((a, b) =>
      (a.display || a.title).localeCompare(b.display || b.title, 'pt-BR')
    );
  }
  if (settings.order === 'rotate' && list.length) {
    const offset = Math.abs(seed) % list.length;
    list = [...list.slice(offset), ...list.slice(0, offset)];
  }
  if (settings.groupCategories) list.sort((a, b) => a.category - b.category);

  const categories = categoriesFor(settings);
  const makeChatButton = (chat, layoutStyle = '') => {
    const category = categories[chat.category];
    const prefix = settings.groupCategories && category ? `${category.split(' ')[0]} ` : '';
    const style = resolveStyle(chat, settings, layoutStyle);
    return {
      text: (prefix + (chat.display || chat.title)).slice(0, 60),
      url: chat.url,
      ...(style ? { style } : {}),
    };
  };
  const makeAdButton = (ad, layoutStyle = '') => {
    const style = STYLES.includes(layoutStyle) ? layoutStyle : ad.style;
    return {
      text: String(ad.title).slice(0, 60),
      url: ad.url,
      isPreviewAd: true,
      ...(STYLES.includes(style) ? { style } : {}),
    };
  };

  let rows;
  if (settings.buttonLayout?.enabled) {
    const layoutRows = buildLayoutRows(list, settings.buttonLayout, ads, seed, { targetType });
    rows = layoutRows.map((row) =>
      row.map((cell) =>
        cell.kind === 'ad'
          ? makeAdButton(cell.ad, cell.style)
          : makeChatButton(cell.chat, cell.style)
      )
    );
  } else {
    const buttons = list.map((chat) => makeChatButton(chat));
    const promoSlots = resolveListAds(settings, ads, seed);
    const hasNewAds = Boolean(promoSlots.start || promoSlots.middle || promoSlots.end);

    if (hasNewAds) {
      rows = repeatRows(buttons, layoutPattern(settings), []);
      if (promoSlots.end) rows.push([makeAdButton(promoSlots.end)]);
      if (promoSlots.middle) {
        if (rows.length === 0) {
          rows.push([makeAdButton(promoSlots.middle)]);
        } else {
          const midIndex = Math.max(1, Math.floor(rows.length / 2));
          rows.splice(midIndex, 0, [makeAdButton(promoSlots.middle)]);
        }
      }
      if (promoSlots.start) rows.unshift([makeAdButton(promoSlots.start)]);
    } else {
      const slots = (ads || [])
        .filter((ad) => ad.title && ad.url)
        .map((ad) => ({
          row: ad.slot_row,
          col: ad.slot_col,
          button: makeAdButton(ad),
        }));
      rows = repeatRows(buttons, layoutPattern(settings), slots);
    }
  }

  if (settings.footerButtons !== false) {
    const actualBotUsername = botUsername || settings.botUsername || 'ListaMyBOT';
    const botAddUrl = `https://t.me/${actualBotUsername}?startgroup=true&admin=post_messages+edit_messages+delete_messages+pin_messages+invite_users`;
    rows.push([
      {
        text: 'Adicionar no meu Canal/Grupo',
        url: botAddUrl,
        style: 'success',
        isPreviewAd: true,
      },
    ]);
  }

  const groups = paginateRows(rows);
  return groups.map((pageRows, index) => ({
    text: `${settings.text || ''}${groups.length > 1 ? `\n\nParte ${index + 1}/${groups.length}` : ''}`,
    rows: pageRows,
  }));
}
