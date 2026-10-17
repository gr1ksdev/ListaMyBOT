import {membershipBlocked} from '../lib/membership.js';
import { api, db } from 'sdk';
import { CATEGORIES } from '../lib/domain.js';
import { getChat, putState } from '../lib/store.js';
import { chatAdmin, menu, submit, register, closeMenu } from '../lib/registration.js';
import { privateScreen } from '../lib/navigation.js';
export default async function(q){
 if(!q.message)return;
 const [action,raw,value]=String(q.data||'').split(':');const target=q.message.chat.id;const user=q.from.id;
 if(!['nav','cfg','cats','cat','link','submit','recheck'].includes(action))return;
 let answered=false;const answer=async(text,alert=false)=>{if(!answered){await api.answerCallbackQuery({callback_query_id:q.id,...(text?{text,show_alert:alert}:{})});answered=true;}};
 try{
 if(action==='nav'){
  if(q.message.chat.type!=='private'||target!==user)return;
  await answer();
  const allowed=['home','help','chats','links','profile','schedule','support','search','channels','groups'];
  await privateScreen(user,allowed.includes(raw)?raw:'home',q.message,q.from);
  return;
 }
 const id=Number(raw);if(!Number.isSafeInteger(id))return;const c=await getChat(id);
 if(!c||(target<0&&target!==c.id)||!await chatAdmin(id,user))throw Error('Somente administradores deste chat podem configurar.');
 if(action==='recheck'){await answer();await register({id:c.id,title:c.title,type:c.type},user);return;}
 if(membershipBlocked(c)&&['cats','cat','link'].includes(action))throw Error(c.error);
 const editable=!['pending','approved'].includes(c.status);
 if(['cat','cats','submit'].includes(action)&&!editable)throw Error('Cadastro já enviado. Use Atualizar status para acompanhar.');
 await putState(`await_link:${target>0?user:target+':'+user}`,null);
 if(action==='cat'){
 const category=Number(value);if(!Number.isInteger(category)||!CATEGORIES[category])throw Error('Categoria inválida.');
 await db.run("UPDATE list_chats SET category=:c,updated=:n WHERE id=:id AND status NOT IN ('pending','approved')",{':c':category,':n':Date.now(),':id':id});c.category=category;await answer(CATEGORIES[category]);await menu(c,target,q.message,'categories');
 }else if(action==='submit'){
 c.status=await submit(c,user);await answer(c.status==='rejected'?'Cadastro rejeitado: membros abaixo do mínimo.':'Cadastro enviado!',c.status==='rejected');
 if(target<0&&['pending','approved'].includes(c.status)&&await closeMenu(c,target,q.message.message_id))return;
 await menu(c,target,q.message);
 }else{
 if(action==='link'&&editable)await putState(`await_link:${target>0?user:target+':'+user}`,{chat:id,expires:Date.now()+600000});
 await answer();await menu(c,target,q.message,action==='cats'?'categories':action==='link'?'link':'summary');
 }
 }catch(e){if(!answered)await answer(String(e.description||e.message).slice(0,190),true);else console.log('Falha ao atualizar menu: '+String(e.description||e.message));}
}
