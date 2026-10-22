// Mirrors tgcloud/lib/layout.js so the panel preview shows the same one-pass
// message that Telegram will receive.
export function defaultLayoutRows() {
  return Array.from({ length: 10 }, () => [{ kind: 'auto' }, { kind: 'auto' }]);
}

export function clampPageIndex(page, totalPages) {
  const total = Math.max(0, Number(totalPages) || 0);
  if (!total) return 0;
  const current = Math.floor(Number(page) || 0);
  return Math.max(0, Math.min(current, total - 1));
}

function seededScore(value, seed) {
  let x = (Number(value) | 0) ^ (Number(seed) | 0);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x ^= x >>> 16;
  return x >>> 0;
}

function seededOrder(items, seed) {
  return [...items].sort(
    (a, b) => seededScore(a.id ?? a.key, seed) - seededScore(b.id ?? b.key, seed)
  );
}

function rotate(items, offset) {
  if (!items.length) return items;
  const start = ((Number(offset) || 0) % items.length + items.length) % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}

export function buildLayoutRows(chats, layout, ads = [], seed = 0, options = {}) {
  if (!layout || !Array.isArray(layout.rows) || !layout.rows.length) return [];
  const targetType = options.targetType || '';
  const fill = targetType || layout.fill || 'random';
  const rotating = options.rotation === true || options.rotation?.enabled === true;
  const roundIndex = Number(options.roundIndex) || 0;
  const destinationId = Number(options.destinationId) || 0;

  const matchesType = (c) =>
    !targetType || (targetType === 'channel' ? c.type === 'channel' : c.type !== 'channel');
  const validChats = (chats || []).filter((c) => c && c.id != null && matchesType(c));
  const chatById = new Map(validChats.map((c) => [Number(c.id), c]));

  const getAdKey = (a) => Number(a.id ?? a.key);
  const validAds = (ads || []).filter((a) => a && a.title && a.url);
  const adsById = new Map(validAds.map((a) => [getAdKey(a), a]));

  const fixedChats = new Set();
  const fixedAds = new Set();
  for (const row of layout.rows) {
    for (const cell of row || []) {
      if (cell?.kind === 'chat' && Number.isSafeInteger(cell.chatId)) fixedChats.add(cell.chatId);
      if (cell?.kind === 'ad') {
        const adRef = Number.isSafeInteger(cell.adId) ? cell.adId : cell.adKey;
        if (Number.isSafeInteger(adRef)) fixedAds.add(adRef);
      }
    }
  }

  let chatPool = validChats.filter((c) => !fixedChats.has(Number(c.id)));
  if (fill === 'channel') chatPool = chatPool.filter((c) => c.type === 'channel');
  else if (fill === 'group') chatPool = chatPool.filter((c) => c.type !== 'channel');
  if (fill === 'random' && !rotating) chatPool = seededOrder(chatPool, seed);
  if (rotating) {
    chatPool = rotate(
      chatPool,
      roundIndex +
        destinationId * 5 +
        (seededScore(destinationId, 0x9e3779b9) % Math.max(1, chatPool.length))
    );
  }

  let adPool = validAds.filter((a) => !fixedAds.has(getAdKey(a)));
  if (!rotating) adPool = seededOrder(adPool, seed);
  if (rotating) {
    adPool = rotate(
      adPool,
      roundIndex +
        destinationId * 7 +
        (seededScore(destinationId + 7919, 0x85ebca6b) % Math.max(1, adPool.length))
    );
  }

  const placedChats = new Set();
  const placedAds = new Set();
  let chatIndex = 0;
  let adIndex = 0;
  const nextChat = () => {
    while (chatIndex < chatPool.length) {
      const chat = chatPool[chatIndex++];
      if (!placedChats.has(Number(chat.id))) {
        placedChats.add(Number(chat.id));
        return chat;
      }
    }
    return null;
  };
  const nextAd = () => {
    while (adIndex < adPool.length) {
      const ad = adPool[adIndex++];
      if (!placedAds.has(getAdKey(ad))) {
        placedAds.add(getAdKey(ad));
        return ad;
      }
    }
    return null;
  };

  const rows = [];
  for (const rawRow of layout.rows) {
    const cells = [];
    for (const rawCell of rawRow || []) {
      const kind = rawCell?.kind || 'auto';
      const style = rawCell?.style || '';
      const styleFields = style ? { style } : {};

      if (kind === 'chat') {
        const chat = chatById.get(Number(rawCell.chatId));
        if (chat && !placedChats.has(Number(chat.id))) {
          placedChats.add(Number(chat.id));
          cells.push({ kind: 'chat', chat, ...styleFields });
        } else {
          const auto = nextChat();
          if (auto) cells.push({ kind: 'chat', chat: auto, ...styleFields });
        }
        continue;
      }

      if (kind === 'ad') {
        const adRef = Number.isSafeInteger(rawCell.adId) ? rawCell.adId : rawCell.adKey;
        const ad = adsById.get(Number(adRef));
        if (ad && !placedAds.has(getAdKey(ad))) {
          placedAds.add(getAdKey(ad));
          cells.push({ kind: 'ad', ad, ...styleFields });
        }
        continue;
      }

      if (kind === 'adRandom') {
        const ad = nextAd();
        if (ad) cells.push({ kind: 'ad', ad, ...styleFields });
        continue;
      }

      const auto = nextChat();
      if (auto) cells.push({ kind: 'chat', chat: auto, ...styleFields });
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}
