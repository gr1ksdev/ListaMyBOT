import { api } from 'sdk';
import { isOwner, normalizeMaintenance } from './domain.js';

export function isBotAdmin(settings, userId) {
 const id = Number(userId);
 return isOwner(id) || (Array.isArray(settings?.admins) && settings.admins.includes(id));
}

export function maintenanceGate(settings, userId) {
 const maintenance = normalizeMaintenance(settings?.maintenance);
 return {
  active: maintenance.enabled,
  blocked: maintenance.enabled && !isBotAdmin(settings, userId),
  message: maintenance.message
 };
}

function plainMaintenanceText(message) {
 return String(message || '')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<\/(?:p|div|blockquote)>/gi, ' ')
  .replace(/<[^>]*>/g, '')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();
}

// Telegram alert texts are limited to 200 characters and do not render HTML.
export function maintenanceAlertText(message) {
 return plainMaintenanceText(message).slice(0, 200);
}

export async function sendMaintenanceNotice(chatId, message) {
 if (!String(message || '').trim()) return;
 try {
  await api.sendMessage({
   chat_id: chatId,
   text: message,
   parse_mode: 'HTML',
   link_preview_options: { is_disabled: true }
  });
 } catch {
  try {
   const plain = plainMaintenanceText(message);
   if (plain) await api.sendMessage({ chat_id: chatId, text: plain });
  } catch {
   // Maintenance notices are best-effort; never break the update handler.
  }
 }
}
