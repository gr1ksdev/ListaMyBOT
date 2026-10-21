import { db, EndpointError } from 'sdk';
import { resolveCategories, validLink } from './domain.js';
import { checkMembers } from './membership.js';
import { rights } from './registration.js';

// Single place to validate a participant before it becomes visible in the list.
// Both the dashboard and the Telegram log buttons must use this path.
export async function approveChat(c, settings) {
 if (!c) throw new EndpointError('Cadastro não encontrado.');
 if (c.status === 'approved') return { ok: true, alreadyApproved: true };

 const banned = Array.isArray(settings?.bannedUsers) &&
  settings.bannedUsers.map(Number).includes(Number(c.owner));
 if (banned) throw new EndpointError('O dono deste cadastro está banido. Desbane o usuário antes de aprovar.');

 if (!validLink(c.url) || !resolveCategories(settings)[c.category]) {
  throw new EndpointError('Complete o link e a categoria em Editar antes de aprovar.');
 }

 let members;
 try {
  members = await checkMembers(c, settings);
 } catch (e) {
  throw new EndpointError(e.message || 'Não foi possível conferir os membros no Telegram. Tente novamente.');
 }
 if (!members.ok) return { ok: false, status: 'rejected', reason: members.reason };

 let missing;
 try {
  missing = await rights(c);
 } catch (e) {
  throw new EndpointError(e.message || 'Não foi possível conferir as permissões do bot no chat.');
 }
 if (missing.length) throw new EndpointError('Faltam permissões: ' + missing.join(', '));

 const result = await db.run(
  "UPDATE list_chats SET status='approved',error='',updated=:n WHERE id=:id AND status=:status",
  { ':n': Date.now(), ':id': c.id, ':status': c.status }
 );
 if (!result.rowsAffected) throw new EndpointError('Este cadastro mudou durante a revisão. Atualize a lista.');
 return { ok: true };
}
