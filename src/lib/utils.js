import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const TELEGRAM_ALLOWED_TAGS = new Set([
  'B', 'STRONG', 'I', 'EM', 'U', 'INS', 'S', 'STRIKE', 'DEL',
  'A', 'CODE', 'PRE', 'BLOCKQUOTE', 'SPAN', 'TG-SPOILER', 'TG-EMOJI', 'BR'
]);
const TELEGRAM_DROP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META',
  'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'OPTION'
]);

// Telegram accepts a small HTML subset in messages. The preview uses that HTML,
// so strip event handlers, scripts and any tag Telegram would not render.
export function sanitizeTelegramHtml(html) {
  const raw = String(html ?? '');
  const Parser = globalThis.DOMParser || globalThis.window?.DOMParser;
  if (typeof Parser !== 'function') {
    return raw.replace(/<[^>]*>/g, '');
  }

  const doc = new Parser().parseFromString(`<div>${raw}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) continue;
      if (child.nodeType !== 1) {
        child.remove();
        continue;
      }
      const tag = child.tagName.toUpperCase();
      if (TELEGRAM_DROP_TAGS.has(tag)) {
        child.remove();
        continue;
      }
      if (!TELEGRAM_ALLOWED_TAGS.has(tag)) {
        walk(child);
        while (child.firstChild) child.parentNode.insertBefore(child.firstChild, child);
        child.remove();
        continue;
      }
      for (const attr of [...child.attributes]) {
        const name = attr.name.toLowerCase();
        const value = attr.value;
        if (name === 'href' && tag === 'A') {
          if (!/^(https?:\/\/|tg:\/\/|mailto:)/i.test(value.trim())) child.removeAttribute(attr.name);
          continue;
        }
        if (name === 'class' && (tag === 'SPAN' || tag === 'TG-SPOILER')) {
          if (value !== 'tg-spoiler') child.removeAttribute(attr.name);
          continue;
        }
        if (name === 'class' && (tag === 'CODE' || tag === 'PRE')) {
          if (!/^language-[\w-]+$/i.test(value)) child.removeAttribute(attr.name);
          continue;
        }
        if (name === 'emoji-id' && tag === 'TG-EMOJI') {
          if (!/^\d+$/.test(value)) child.removeAttribute(attr.name);
          continue;
        }
        child.removeAttribute(attr.name);
      }
      walk(child);
    }
  };
  walk(root);
  return root.innerHTML;
}

export function initials(title) {
  return String(title || 'Canal')
    .trim()
    .split(/\s+/)
    .filter(w => !['de', 'da', 'do', 'das', 'dos'].includes(w.toLowerCase()))
    .slice(0, 2)
    .map(w => Array.from(w)[0])
    .join('')
    .toUpperCase();
}

export function formatDate(n) {
  if (!n) return '—';
  return new Date(n).toLocaleString('pt-BR', {
    timeZone: 'America/Fortaleza',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function displayDate(n) {
  if (!n) return '—';
  const opts = { timeZone: 'America/Fortaleza' };
  const isToday =
    new Date(n).toLocaleDateString('pt-BR', opts) ===
    new Date().toLocaleDateString('pt-BR', opts);
  return isToday
    ? 'Hoje, às ' +
        new Date(n).toLocaleTimeString('pt-BR', {
          ...opts,
          hour: '2-digit',
          minute: '2-digit',
        })
    : formatDate(n);
}

export const LABELS = {
  draft: 'Em configuração',
  pending: 'Pendente',
  approved: 'Ativo',
  rejected: 'Rejeitado',
  paused: 'Pausado',
  sent: 'Enviado',
  failed: 'Falhou',
  uncertain: 'Conferir envio',
  skipped: 'Ignorado',
  sending: 'Enviando',
  active: 'Em andamento',
  done: 'Concluído',
};

export const COLOR_OPTIONS = [
  { value: '', label: 'Padrão' },
  { value: 'primary', label: 'Azul' },
  { value: 'success', label: 'Verde' },
  { value: 'danger', label: 'Vermelho' },
];

export function resolveStyle(c, s) {
  if (!c) return '';
  const direct = c.style || s?.chatColors?.[c.id] || s?.chatColors?.[String(c.id)];
  if (direct && ['primary', 'danger', 'success'].includes(direct)) return direct;
  if (direct === 'none') return '';
  const isChannel = c.type === 'channel';
  const isGroup = c.type === 'group' || c.type === 'supergroup';
  if (isChannel && s?.channelColor && ['primary', 'danger', 'success'].includes(s.channelColor))
    return s.channelColor;
  if (isGroup && s?.groupColor && ['primary', 'danger', 'success'].includes(s.groupColor))
    return s.groupColor;
  if (s?.buttonColor && ['primary', 'danger', 'success'].includes(s.buttonColor))
    return s.buttonColor;
  return '';
}
