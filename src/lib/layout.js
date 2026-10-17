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
