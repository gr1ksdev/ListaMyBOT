import { db, EndpointError } from 'sdk';
import { requireAdmin, getChat } from '../lib/store.js';
import { validLink, CATEGORIES } from '../lib/domain.js';
import { checkMembers } from '../lib/membership.js';
import { rights } from '../lib/registration.js';

export default async function(input, ctx) {
 const { settings } = await requireAdmin(ctx);
 let owner = Number(input.owner);
 if (!owner && input.id) {
  const c = await getChat(input.id);
  owner = c?.owner;
 }
 if (!Number.isSafeInteger(owner) || owner <= 0) throw new EndpointError('Usuário não informado.');

 const pending = await db.all("SELECT * FROM list_chats WHERE owner=:o AND status='pending'", { ':o': owner });
 if (!pending.length) return { ok: true, count: 0, message: 'Nenhum cadastro pendente para este usuário.' };

 let approvedCount = 0;
 const now = Date.now();
 for (const c of pending) {
  if (!validLink(c.url) || !CATEGORIES[c.category]) continue;
  try {
   const missing = await rights(c);
   if (missing.length) continue;
   const mem = await checkMembers(c, settings);
   if (!mem.ok) continue;
  } catch {
   continue;
  }
  await db.run("UPDATE list_chats SET status='approved', error='', updated=:n WHERE id=:id AND status='pending'", {
   ':n': now,
   ':id': c.id
  });
  approvedCount++;
 }

 return { ok: true, count: approvedCount, total: pending.length };
}
