import { db, EndpointError } from 'sdk';
import { requireAdmin, getChat, putState } from '../lib/store.js';

export default async function(input, ctx) {
 await requireAdmin(ctx);
 const id = Number(input.id);
 if (!Number.isSafeInteger(id)) throw new EndpointError('ID de canal/grupo inválido.');
 const c = await getChat(id);
 if (!c) throw new EndpointError('Canal ou grupo não encontrado.');

 await db.run('DELETE FROM list_chats WHERE id=:id', { ':id': id });
 await putState(`config_menu:${id}:${id}`, null);
 return { ok: true, id };
}
