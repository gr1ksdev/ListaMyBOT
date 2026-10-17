import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
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
