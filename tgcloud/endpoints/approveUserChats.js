import { db, EndpointError } from 'sdk';
import { requireAdmin, getChat } from '../lib/store.js';
import { approveChat } from '../lib/moderation.js';
import { notifyChatOwner, updateChatSubmissionLog } from '../lib/chat_logs.js';

export default async function(input, ctx) {
 const auth = await requireAdmin(ctx);
 const reviewer = ctx?.initData?.user || { id: auth.id };
 let owner = Number(input.owner);
 if (!owner && input.id) {
  const c = await getChat(input.id);
  owner = c?.owner;
 }
 if (!Number.isSafeInteger(owner) || owner <= 0) throw new EndpointError('Usuário não informado.');

 const pending = await db.all("SELECT * FROM list_chats WHERE owner=:o AND status='pending'", { ':o': owner });
 if (!pending.length) return { ok: true, count: 0, message: 'Nenhum cadastro pendente para este usuário.' };

 let approvedCount = 0;
 for (const c of pending) {
  try {
   const result = await approveChat(c, auth.settings);
   if (!result.ok) {
    const reason = result.reason || 'Cadastro rejeitado automaticamente.';
    const updated = { ...c, status: 'rejected', error: reason };
    await notifyChatOwner(updated, 'rejected', reason, reviewer);
    await updateChatSubmissionLog(updated, 'rejected', reviewer, reason);
    continue;
   }
   approvedCount++;
   const updated = { ...c, status: 'approved', error: '' };
   await notifyChatOwner(updated, 'approved', '', reviewer);
   await updateChatSubmissionLog(updated, 'approved', reviewer);
  } catch {
   // A single invalid/banned/permission-broken chat must not block the others.
   continue;
  }
 }

 return { ok: true, count: approvedCount, total: pending.length };
}
