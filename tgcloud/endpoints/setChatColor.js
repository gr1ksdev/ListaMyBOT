import { db, EndpointError } from 'sdk';
import { requireAdmin, getChat } from '../lib/store.js';
import { AD_STYLES } from '../lib/domain.js';

export default async function(input, ctx) {
 const { settings } = await requireAdmin(ctx);
 const id = Number(input.id);
 const c = await getChat(id);
 if (!c) throw new EndpointError('Participante não encontrado.');
 const style = typeof input.style === 'string' && (AD_STYLES.includes(input.style) || input.style === 'none') ? input.style : '';
 settings.chatColors = settings.chatColors || {};
 if (style) {
  settings.chatColors[id] = style;
 } else {
  delete settings.chatColors[id];
 }
 await db.run('UPDATE list_settings SET value=:v WHERE id=1', { ':v': JSON.stringify(settings) });
 return { ok: true, style };
}
