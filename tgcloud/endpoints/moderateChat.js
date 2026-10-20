import { db, EndpointError } from 'sdk';
import { requireAdmin, getChat } from '../lib/store.js';
import { approveChat } from '../lib/moderation.js';
import { notifyChatOwner, updateChatSubmissionLog } from '../lib/chat_logs.js';

export default async function(input,ctx){
 const auth=await requireAdmin(ctx);
 const reviewer=ctx?.initData?.user||{id:auth.id};
 if(!['approved','rejected','disapproved','pending'].includes(input.status))throw new EndpointError('Ação inválida.');

 const c=await getChat(input.id);
 if(!c)throw new EndpointError('Cadastro não encontrado.');

 if(input.status==='approved'){
  const result=await approveChat(c,auth.settings);
  if(result.alreadyApproved)return {ok:true,status:'approved'};
  if(!result.ok){
   const reason=result.reason||'Cadastro rejeitado automaticamente.';
   const updated={...c,status:'rejected',error:reason};
   await notifyChatOwner(updated,'rejected',reason,reviewer);
   await updateChatSubmissionLog(updated,'rejected',reviewer,reason);
   return {ok:true,status:'rejected',reason};
  }
  const updated={...c,status:'approved',error:''};
  await notifyChatOwner(updated,'approved','',reviewer);
  await updateChatSubmissionLog(updated,'approved',reviewer);
  return {ok:true,status:'approved'};
 }

 if(input.status==='rejected'){
  if(c.status!=='pending')throw new EndpointError('Este cadastro não está mais pendente. Atualize a lista.');
  const r=await db.run("UPDATE list_chats SET status='rejected',error='',updated=:n WHERE id=:id AND status='pending'",{':n':Date.now(),':id':c.id});
  if(!r.rowsAffected)throw new EndpointError('Este cadastro já foi revisado. Atualize a lista.');
  const updated={...c,status:'rejected',error:''};
  await notifyChatOwner(updated,'rejected','',reviewer);
  await updateChatSubmissionLog(updated,'rejected',reviewer);
  return {ok:true,status:'rejected'};
 }

 // 'disapproved' and 'pending' are aliases for returning an approved chat to review.
 if(c.status!=='approved')throw new EndpointError('Somente cadastros aprovados podem ser desaprovados.');
 const r=await db.run("UPDATE list_chats SET status='pending',error='',updated=:n WHERE id=:id AND status='approved'",{':n':Date.now(),':id':c.id});
 if(!r.rowsAffected)throw new EndpointError('Este cadastro já foi revisado. Atualize a lista.');
 const updated={...c,status:'pending',error:''};
 await notifyChatOwner(updated,'pending','',reviewer);
 await updateChatSubmissionLog(updated,'pending',reviewer);
 return {ok:true,status:'pending'};
}
