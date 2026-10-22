import { buildLayoutRows, defaultLayoutRows } from './layout.js';
import { isValidTelegramLink, resolveStyle, truncateButtonText } from './utils.js';

const STYLES = ['primary', 'danger', 'success'];

function categoriesFor(settings) {
  const list = Array.isArray(settings?.categories)
    ? settings.categories.map((value) => String(value ?? '').trim())
    : [];
  return list;
}

// Mirrors tgcloud/lib/domain.js makePages so the panel shows the same one-pass
// message for a sample destination.
export function buildPreviewPages({
  chats = [],
  settings = {},
  ads = [],
  seed = 0,
  botUsername = '',
  targetType = '',
  roundIndex = 0,
  destinationId = 0,
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
  if (settings.groupCategories) list.sort((a, b) => a.category - b.category);

  const categories = categoriesFor(settings);
  const makeChatButton = (chat, layoutStyle = '') => {
    const category = categories[chat.category];
    const prefix = settings.groupCategories && category ? `${category.split(' ')[0]} ` : '';
    const style = resolveStyle(chat, settings, layoutStyle);
    return {
      text: truncateButtonText(prefix + (chat.display || chat.title), 60),
      url: chat.url,
      ...(style ? { style } : {}),
    };
  };
  const makeAdButton = (ad, layoutStyle = '') => {
    const style = STYLES.includes(layoutStyle) ? layoutStyle : ad.style;
    return {
      text: truncateButtonText(ad.title, 60),
      url: ad.url,
      isPreviewAd: true,
      ...(STYLES.includes(style) ? { style } : {}),
    };
  };

  const configuredRows = Array.isArray(settings.buttonLayout?.rows)
    ? settings.buttonLayout.rows
    : [];
  const layout = configuredRows.length
    ? { ...settings.buttonLayout, enabled: true, rows: configuredRows }
    : { enabled: true, fill: 'random', rotate: false, rows: defaultLayoutRows() };

  const layoutRows = buildLayoutRows(list, layout, ads, seed, {
    targetType,
    rotation: layout.rotate === true,
    roundIndex,
    destinationId,
  });
  const rows = layoutRows.map((row) =>
    row.map((cell) =>
      cell.kind === 'ad'
        ? makeAdButton(cell.ad, cell.style)
        : makeChatButton(cell.chat, cell.style)
    )
  );

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

  if (!rows.length) return [];
  return [{ text: settings.text || '', rows }];
}
