import {membershipBlocked} from '../lib/membership.js';
import { api, db } from 'sdk';
import { CATEGORIES } from '../lib/domain.js';
import { getChat, putState, isAdmin, state } from '../lib/store.js';
import { chatAdmin, menu, submit, register, closeMenu } from '../lib/registration.js';
import { privateScreen, escHtml } from '../lib/navigation.js';
import { submitPromotion, approvePromotion, rejectPromotion } from '../lib/promotions.js';
import { formatChatSubmissionMessage, chatSubmissionKeyboard } from '../lib/chat_logs.js';
import { startTicketService, closeTicket, reopenTicket } from '../lib/support.js';
export default async function(q){
 if(!q.message)return;
 const [action,raw,value]=String(q.data||'').split(':');const target=q.message.chat.id;const user=q.from.id;
 if(!['nav','cfg','cats','cat','link','submit','recheck','promo','chat_adm','cancel','ticket','support'].includes(action))return;
 let answered=false;const answer=async(text,alert=false)=>{if(!answered){await api.answerCallbackQuery({callback_query_id:q.id,...(text?{text,show_alert:alert}:{})});answered=true;}};
 try{
 if(action==='promo'){
  if(raw==='confirm_submit'){
   const draft=await state(`promo_draft:${user}`,null);
   if(!draft){await answer('Nenhum rascunho de divulgação encontrado. Envie os dados novamente.',true);return;}
   await answer();
   await putState(`promo_draft:${user}`,null);
   await submitPromotion(q.from,draft);
   try{await api.deleteMessage({chat_id:user,message_id:q.message.message_id});}catch{}
   await api.sendMessage({chat_id:user,text:'✅ <b>Sua divulgação foi enviada para análise!</b>\n\nNossos moderadores irão avaliar no grupo de logs. Você receberá uma notificação aqui assim que for aprovada.',parse_mode:'HTML'});
   return;
  }
  const isBotAdm=await isAdmin(user);
  const isChatAdm=target<0?await chatAdmin(target,user):false;
  if(!isBotAdm&&!isChatAdm){await answer('Apenas administradores podem avaliar divulgações.',true);return;}
  const promoId=value;
  if(raw==='approve'){
   await answer('Aprovando divulgação...');
   await approvePromotion(promoId,q.from);
   return;
  }
  if(raw==='reject'){
   await answer('Recusando divulgação...');
   await rejectPromotion(promoId,q.from);
   return;
  }
  return;
 }
 if(action==='chat_adm'){
  const isBotAdm=await isAdmin(user);
  const isChatAdm=target<0?await chatAdmin(target,user):false;
  if(!isBotAdm&&!isChatAdm){await answer('Apenas administradores do bot podem avaliar cadastros.',true);return;}
  const chatId=Number(value);
  if(!Number.isSafeInteger(chatId))return;
  const c=await getChat(chatId);
  if(!c){await answer('Cadastro não encontrado.',true);return;}
  let memberCount=0;
  try{memberCount=await api.getChatMemberCount({chat_id:chatId});}catch{}
  if(raw==='approve'){
   await answer('Aprovando cadastro...');
   await db.run("UPDATE list_chats SET status='approved', error='', updated=:n WHERE id=:id",{':n':Date.now(),':id':chatId});
   c.status='approved';
   try{
    await api.editMessageText({
     chat_id:target,
     message_id:q.message.message_id,
     text:formatChatSubmissionMessage(c,memberCount,c.owner,'approved',q.from),
     parse_mode:'HTML',
     disable_web_page_preview:true,
     reply_markup:chatSubmissionKeyboard(chatId,'approved')
    });
   }catch(e){console.warn('Erro ao atualizar mensagem de log:',e);}
   if(c.owner){
    try{
     await api.sendMessage({
      chat_id:c.owner,
      text:`🎉 <b>Boas notícias!</b>\n\nSeu canal/grupo <b>${escHtml(c.title)}</b> foi aprovado e agora faz parte da nossa lista oficial!`,
      parse_mode:'HTML'
     });
    }catch{}
   }
   return;
  }
  if(raw==='reject'){
   await answer('Rejeitando cadastro...');
   await db.run("UPDATE list_chats SET status='rejected', updated=:n WHERE id=:id",{':n':Date.now(),':id':chatId});
   c.status='rejected';
   try{
    await api.editMessageText({
     chat_id:target,
     message_id:q.message.message_id,
     text:formatChatSubmissionMessage(c,memberCount,c.owner,'rejected',q.from),
     parse_mode:'HTML',
     disable_web_page_preview:true,
     reply_markup:chatSubmissionKeyboard(chatId,'rejected')
    });
   }catch(e){console.warn('Erro ao atualizar mensagem de log:',e);}
   if(c.owner){
    try{
     await api.sendMessage({
      chat_id:c.owner,
      text:`⚠️ <b>Aviso sobre seu cadastro:</b>\n\nA solicitação de entrada de <b>${escHtml(c.title)}</b> na lista foi recusada pelos moderadores.`,
      parse_mode:'HTML'
     });
    }catch{}
   }
   return;
  }
  return;
 }
 if (action === 'support') {
  await answer();
  await privateScreen(user, 'support', q.message, q.from);
  return;
 }
 if (action === 'ticket') {
  if (raw === 'reply') {
   const isBotAdm = await isAdmin(user);
   const isChatAdm = target < 0 ? await chatAdmin(target, user) : false;
   if (!isBotAdm && !isChatAdm) {
    await answer('Apenas administradores podem atender chamados.', true);
    return;
   }
   await answer('Iniciando atendimento...');
   const res = await startTicketService(value, q.from);
   if (!res.ok) {
    await answer(res.error || 'Não foi possível iniciar o atendimento.', true);
   }
   return;
  }
  if (raw === 'close') {
   const isBotAdm = await isAdmin(user);
   const isChatAdm = target < 0 ? await chatAdmin(target, user) : false;
   if (!isBotAdm && !isChatAdm) {
    await answer('Apenas administradores podem encerrar chamados.', true);
    return;
   }
   await answer('Encerrando atendimento...');
   const res = await closeTicket(value, q.from, 'Encerrado pelo moderador');
   if (!res.ok) {
    await answer(res.error || 'Não foi possível encerrar.', true);
   }
   return;
  }
  if (raw === 'user_close') {
   await answer('Encerrando...');
   try {
    await api.deleteMessage({ chat_id: user, message_id: q.message.message_id });
   } catch {}
   const res = await closeTicket(value, q.from, 'Encerrado pelo usuário');
   if (!res.ok && res.alreadyClosed) {
    await privateScreen(user, 'support', undefined, q.from);
   } else if (!res.ok) {
    await answer(res.error || 'Não foi possível encerrar.', true);
   }
   return;
  }
  if (raw === 'reopen') {
   const isBotAdm = await isAdmin(user);
   const isChatAdm = target < 0 ? await chatAdmin(target, user) : false;
   if (!isBotAdm && !isChatAdm) {
    await answer('Apenas administradores podem reabrir chamados.', true);
    return;
   }
   await answer('Reabrindo atendimento...');
   const res = await reopenTicket(value, q.from);
   if (!res.ok) {
    await answer(res.error || 'Não foi possível reabrir o atendimento.', true);
   }
   return;
  }
  if (raw === 'user_reopen') {
   await answer('Reabrindo chamado...');
   try {
    await api.editMessageReplyMarkup({
     chat_id: user,
     message_id: q.message.message_id,
     reply_markup: { inline_keyboard: [[{ text: '🏠 Menu Principal', callback_data: 'nav:home' }]] }
    });
   } catch {}
   const res = await reopenTicket(value, q.from);
   if (!res.ok) {
    await answer(res.error || 'Não foi possível reabrir o chamado.', true);
   }
   return;
  }
  return;
 }
 if(action==='nav'){
  if(q.message.chat.type!=='private'||target!==user)return;
  await answer();
  const allowed=['home','help','chats','links','profile','schedule','support','search','channels','groups','divulgar'];
  await privateScreen(user,allowed.includes(raw)?raw:'home',q.message,q.from);
  return;
 }
 const id=Number(raw);if(!Number.isSafeInteger(id))return;const c=await getChat(id);
 if(!c||(target<0&&target!==c.id)||!await chatAdmin(id,user))throw Error('Somente administradores deste chat podem configurar.');
 if(action==='cancel'){
  await answer('Configuração cancelada.');
  if(target<0){
   await closeMenu(c,target,q.message.message_id);
   const me=await api.getMe();
   const botName=me.first_name||me.username||'ListaMyBOT';
   const chatTypeWord=c.type==='channel'?'canal':'grupo';
   try{
    await api.sendMessage({
     chat_id:target,
     text:`⚠️ Cadastro cancelado.\nO <b>${escHtml(botName)}</b> está saindo do ${chatTypeWord}...`,
     parse_mode:'HTML'
    });
   }catch{}
   try{await api.leaveChat({chat_id:target});}catch{}
   await db.run("UPDATE list_chats SET status='paused',error='Cadastro cancelado',updated=:n WHERE id=:id",{':n':Date.now(),':id':c.id});
  }else{
   await privateScreen(user,'chats',q.message,q.from);
  }
  return;
 }
 if(action==='recheck'){await answer();await register({id:c.id,title:c.title,type:c.type},user);return;}
 if(membershipBlocked(c)&&['cats','cat','link'].includes(action))throw Error(c.error);
 const editable=!['pending','approved'].includes(c.status);
 if(['cat','cats','submit'].includes(action)&&!editable)throw Error('Cadastro já enviado. Use Atualizar status para acompanhar.');
 await putState(`await_link:${target>0?user:target+':'+user}`,null);
 if(action==='cat'){
 const category=Number(value);if(!Number.isInteger(category)||!CATEGORIES[category])throw Error('Categoria inválida.');
 await db.run("UPDATE list_chats SET category=:c,updated=:n WHERE id=:id AND status NOT IN ('pending','approved')",{':c':category,':n':Date.now(),':id':id});c.category=category;await answer(CATEGORIES[category]);await menu(c,target,q.message,'categories');
 }else if(action==='submit'){
 c.status=await submit(c,user,q.from);await answer(c.status==='rejected'?'Cadastro rejeitado: membros abaixo do mínimo.':'Cadastro enviado!',c.status==='rejected');
 if(target<0&&['pending','approved'].includes(c.status)&&await closeMenu(c,target,q.message.message_id))return;
 await menu(c,target,q.message);
 }else{
 if(action==='link'&&editable)await putState(`await_link:${target>0?user:target+':'+user}`,{chat:id,expires:Date.now()+600000});
 await answer();await menu(c,target,q.message,action==='cats'?'categories':action==='link'?'link':'summary');
 }
 }catch(e){if(!answered)await answer(String(e.description||e.message).slice(0,190),true);else console.log('Falha ao atualizar menu: '+String(e.description||e.message));}
}
