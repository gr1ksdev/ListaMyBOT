import { db, EndpointError } from 'sdk';
import { requireAdmin, getChat } from '../lib/store.js';
import { AD_STYLES } from '../lib/domain.js';

export default async function(input, ctx) {
 const auth = await requireAdmin(ctx);
 const { settings } = auth;
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
 const expected = Number.isSafeInteger(input.version) ? input.version : auth.version;
 const result = await db.run(
  'UPDATE list_settings SET value=:v,version=version+1 WHERE id=1 AND version=:version',
  { ':v': JSON.stringify(settings), ':version': expected }
 );
 if (!result.rowsAffected) throw new EndpointError('As configurações mudaram. Atualize o painel e tente novamente.');
 return { ok: true, style };
}
