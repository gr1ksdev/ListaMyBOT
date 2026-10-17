import {checkMembers} from '../lib/membership.js';
import { db, EndpointError } from 'sdk';
import { requireAdmin, getChat } from '../lib/store.js';
import { validLink, CATEGORIES } from '../lib/domain.js';
import { rights } from '../lib/registration.js';
export default async function(input,ctx){
 const {settings}=await requireAdmin(ctx);
 if(!['approved','rejected','disapproved','pending'].includes(input.status))throw new EndpointError('Ação inválida.');
 if(input.status==='disapproved'||input.status==='pending'){
  const c=await getChat(input.id);if(!c)throw new EndpointError('Cadastro não encontrado.');
  if(c.status!=='approved')throw new EndpointError('Somente cadastros aprovados podem ser desaprovados.');
  await db.run("UPDATE list_chats SET status='pending',error='',updated=:n WHERE id=:id",{':n':Date.now(),':id':c.id});
  return {ok:true,status:'pending'};
 }
 const c=await getChat(input.id);if(!c||c.status!=='pending')throw new EndpointError('Este cadastro não está mais pendente. Atualize a lista.');
 if(input.status==='approved'){let members;try{members=await checkMembers(c,settings);}catch(e){throw new EndpointError(e.message);}if(!members.ok)return {ok:true,status:'rejected',reason:members.reason};
 if(!validLink(c.url)||!CATEGORIES[c.category])throw new EndpointError('Complete o link e a categoria em Editar antes de aprovar.');
 const missing=await rights(c);if(missing.length)throw new EndpointError('Faltam permissões: '+missing.join(', '));
 }
 const r=await db.run("UPDATE list_chats SET status=:s,error='',updated=:n WHERE id=:id AND status='pending'",{':s':input.status,':n':Date.now(),':id':c.id});
 if(!r.rowsAffected)throw new EndpointError('Este cadastro já foi revisado. Atualize a lista.');return {ok:true};
}
