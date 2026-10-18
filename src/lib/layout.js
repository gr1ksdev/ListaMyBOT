// Layout engine shared with Telegram bot dispatch
export function layoutPattern(settings) {
  const p = settings.rowPattern;
  if (p === undefined) return [settings.columns || 2];
  if (!Array.isArray(p) || p.length < 1 || p.length > 20 || p.some(n => !Number.isInteger(n) || n < 1 || n > 5)) {
    throw new Error('Use de 1 a 20 linhas, com 1 a 5 botões em cada linha.');
  }
  return p;
}

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
      if (r === 0) for (const d of defs) d.placed = false; // re-arm slots every repeat
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
    if (index === before) break; // pattern fully occupied by slots; nothing can flow
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

export function resolveListAds(s, ads = [], seed = 0) {
  if (!s?.listAdsConfig?.enabled || !Array.isArray(ads) || !ads.length) {
    return { start: null, middle: null, end: null };
  }
  const cfg = s.listAdsConfig;
  const validAds = ads.filter((a) => a && a.title && a.url);
  if (!validAds.length) return { start: null, middle: null, end: null };
  const getAdKey = (a) => (a.id != null ? a.id : a.key);
  const adsById = new Map(validAds.map((a) => [getAdKey(a), a]));

  const activeSlots = [];
  if (cfg.slots?.start?.enabled) activeSlots.push('start');
  if (cfg.slots?.middle?.enabled) activeSlots.push('middle');
  if (cfg.slots?.end?.enabled) activeSlots.push('end');
  if (!activeSlots.length) return { start: null, middle: null, end: null };

  const result = { start: null, middle: null, end: null };

  if (cfg.mode === 'fixed') {
    if (cfg.sameAdAcrossSlots) {
      const targetId =
        cfg.fixedAdId ||
        cfg.slots?.start?.adId ||
        cfg.slots?.middle?.adId ||
        cfg.slots?.end?.adId;
      const targetAd = (targetId && adsById.get(targetId)) || validAds[0];
      for (const slot of activeSlots) result[slot] = targetAd;
    } else {
      const usedIds = new Set();
      for (const slot of activeSlots) {
        const explicitId = cfg.slots?.[slot]?.adId;
        if (explicitId && adsById.has(explicitId)) {
          result[slot] = adsById.get(explicitId);
          usedIds.add(explicitId);
        }
      }
      let fallbackIdx = 0;
      for (const slot of activeSlots) {
        if (!result[slot]) {
          let candidate = validAds.find((a) => !usedIds.has(getAdKey(a)));
          if (candidate) {
            result[slot] = candidate;
            usedIds.add(getAdKey(candidate));
          } else {
            result[slot] = validAds[fallbackIdx % validAds.length];
            fallbackIdx++;
          }
        }
      }
    }
  } else if (cfg.mode === 'random') {
    let pool = (cfg.randomPool || []).map((id) => adsById.get(id)).filter(Boolean);
    if (!pool.length) pool = validAds.slice();

    if (cfg.sameAdAcrossSlots) {
      const pickIndex = Math.abs(seed) % pool.length;
      const picked = pool[pickIndex];
      for (const slot of activeSlots) result[slot] = picked;
    } else {
      const shuffled = [...pool].sort((a, b) => {
        const hashA = (a.id * 31 + seed) % 1000;
        const hashB = (b.id * 31 + seed) % 1000;
        return hashA - hashB;
      });
      let i = 0;
      for (const slot of activeSlots) {
        result[slot] = shuffled[i % shuffled.length];
        i++;
      }
    }
  }

  return result;
}
