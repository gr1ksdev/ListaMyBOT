// Shared by the Telegram dispatcher and the browser preview. The panel draws
// the final message once: every cell is either fixed or resolved in this pass.
export function layoutPattern(settings) {
  const p = settings.rowPattern;
  if (p === undefined) return [settings.columns || 2];
  if (!Array.isArray(p) || p.length < 1 || p.length > 20 || p.some(n => !Number.isInteger(n) || n < 1 || n > 5)) {
    throw Error('Use de 1 a 20 linhas, com 1 a 5 botões em cada linha.');
  }
  return p;
}

// Legacy helpers used by the old panel bundle that still ships in frontend/.
// The current React panel and dispatcher use buildLayoutRows below.
export function repeatRows(items, pattern, slots = []) {
  const defs = (slots || [])
    .filter(s => Number.isInteger(s.row) && Number.isInteger(s.col) && s.row >= 0 && s.row < pattern.length && s.col >= 0 && s.col < pattern[s.row])
    .map(s => ({ ...s, placed: false }));
  const rows = [];
  let index = 0;
  if (!defs.length) {
    let row = 0;
    while (index < items.length) {
      const count = pattern[row++ % pattern.length];
      rows.push(items.slice(index, index + count));
      index += count;
    }
    return rows;
  }
  while (index < items.length) {
    const before = index;
    for (let r = 0; r < pattern.length; r++) {
      if (r === 0) for (const d of defs) d.placed = false;
      const cells = [];
      const inRow = defs.filter(s => s.row === r).sort((a, b) => a.col - b.col);
      for (let i = 0; i < pattern[r]; i++) {
        const slot = inRow.find(s => s.col === i && !s.placed);
        if (slot) {
          slot.placed = true;
          cells.push(slot.button);
        } else if (index < items.length) {
          cells.push(items[index++]);
        }
      }
      if (cells.length) rows.push(cells);
    }
    if (index === before) break;
  }
  return rows;
}

export function paginateRows(rows, maxButtons = 40, maxRows = 20) {
  const pages = [];
  let page = [];
  let count = 0;
  for (const row of rows) {
    if (page.length && (count + row.length > maxButtons || page.length === maxRows)) {
      pages.push(page);
      page = [];
      count = 0;
    }
    page.push(row);
    count += row.length;
  }
  if (page.length) pages.push(page);
  return pages;
}

export function defaultLayoutRows() {
  return Array.from({ length: 10 }, () => [{ kind: 'auto' }, { kind: 'auto' }]);
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

// One-pass layout:
// - fixed chats/ads keep their cells;
// - auto cells receive each eligible chat at most once;
// - random-ad cells receive each valid ad at most once;
// - fixed ads are removed from the random pool;
// - rotating lists offset the eligible pool by destination + round.
export function buildLayoutRows(chats, layout, ads = [], seed = 0, options = {}) {
  if (!layout || !Array.isArray(layout.rows) || !layout.rows.length) return [];
  const targetType = options.targetType || '';
  const fill = targetType || layout.fill || 'random';
  const rotating = options.rotation === true || options.rotation?.enabled === true;
  const roundIndex = Number(options.roundIndex) || 0;
  const destinationId = Number(options.destinationId) || 0;

  const matchesType = c =>
    !targetType || (targetType === 'channel' ? c.type === 'channel' : c.type !== 'channel');
  const validChats = (chats || []).filter(c => c && c.id != null && matchesType(c));
  const chatById = new Map(validChats.map(c => [Number(c.id), c]));

  const getAdKey = a => Number(a.id ?? a.key);
  const validAds = (ads || []).filter(a => a && a.title && a.url);
  const adsById = new Map(validAds.map(a => [getAdKey(a), a]));

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

  let chatPool = validChats.filter(c => !fixedChats.has(Number(c.id)));
  if (fill === 'channel') chatPool = chatPool.filter(c => c.type === 'channel');
  else if (fill === 'group') chatPool = chatPool.filter(c => c.type !== 'channel');
  // With rotation enabled the base order stays exactly as configured
  // (alphabetical/manual); only the window start moves.
  if (fill === 'random' && !rotating) {
    chatPool = seededOrder(chatPool, seed);
  }
  if (rotating) {
    chatPool = rotate(
      chatPool,
      roundIndex + destinationId * 5 + (seededScore(destinationId, 0x9e3779b9) % Math.max(1, chatPool.length))
    );
  }

  let adPool = validAds.filter(a => !fixedAds.has(getAdKey(a)));
  if (!rotating) adPool = seededOrder(adPool, seed);
  if (rotating) {
    adPool = rotate(
      adPool,
      roundIndex + destinationId * 7 + (seededScore(destinationId + 7919, 0x85ebca6b) % Math.max(1, adPool.length))
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
        // A removed/invalid fixed ad leaves its position empty instead of
        // becoming a chat button, preserving the "used ad disappears" rule.
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
