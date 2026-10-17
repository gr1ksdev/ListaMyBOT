import { db, EndpointError } from 'sdk';
import { requireAdmin, config } from '../lib/store.js';
import { validateSettings } from '../lib/domain.js';

export default async function(input, ctx) {
 await requireAdmin(ctx);
 const user = Number(input.user || input.id);
 if (!Number.isSafeInteger(user) || user <= 0) throw new EndpointError('ID de usuário inválido.');

 const { settings, version } = await config();
 const bannedList = Array.isArray(settings.bannedUsers) ? [...settings.bannedUsers] : [];
 const shouldBan = input.ban !== false;

 let updatedList;
 if (shouldBan) {
  if (!bannedList.includes(user)) bannedList.push(user);
  updatedList = bannedList;
  await db.run("UPDATE list_chats SET status='rejected', error='Usuário banido pelo administrador', updated=:n WHERE owner=:u", {
   ':u': user,
   ':n': Date.now()
  });
 } else {
  updatedList = bannedList.filter(u => u !== user);
 }

 const newSettings = validateSettings({
  ...settings,
  bannedUsers: updatedList
 });

 await db.run('UPDATE list_settings SET value=:v, version=:ver WHERE id=1', {
  ':v': JSON.stringify(newSettings),
  ':ver': version + 1
 });

 return { ok: true, banned: shouldBan, user };
}
