import { db, api } from 'sdk';
import { register } from '../lib/registration.js';
import { config } from '../lib/store.js';
import { maintenanceGate } from '../lib/maintenance.js';

export default async function(u){
 if(!['group','supergroup','channel'].includes(u.chat?.type))return;
 const { settings } = await config();
 const maintenance = maintenanceGate(settings, u.from?.id);
 if (maintenance.blocked) {
  // Keep the local status accurate when the bot is removed, but do not run
  // registration or send messages while maintenance mode is active.
  if (!['administrator', 'member', 'restricted'].includes(u.new_chat_member?.status)) {
   await db.run("UPDATE list_chats SET status='paused',error='Bot removido ou sem administração',updated=:n WHERE id=:id",{':n':Date.now(),':id':u.chat.id});
  }
  return;
 }
 if(u.new_chat_member?.status!=='administrator'){
  if(u.new_chat_member?.status==='member'){
   const me=await api.getMe();
   const botName=me.first_name||me.username||'ListaMyBOT';
   const chatTypeWord=u.chat.type==='channel'?'canal':'grupo';
   await api.sendMessage({
    chat_id:u.chat.id,
    text:`⚠️ Este ${chatTypeWord} precisa que o bot seja administrador.\nO <b>${botName}</b> requer permissões de administrador para operar. Saindo...`,
    parse_mode:'HTML'
   });
   try{await api.leaveChat({chat_id:u.chat.id});}catch{}
   await db.run("UPDATE list_chats SET status='paused',error='Bot sem administração',updated=:n WHERE id=:id",{':n':Date.now(),':id':u.chat.id});
  }else{
   await db.run("UPDATE list_chats SET status='paused',error='Bot removido ou sem administração',updated=:n WHERE id=:id",{':n':Date.now(),':id':u.chat.id});
  }
  return;
 }

 const minimum=settings.minMembers??0;
 if(minimum>0){
  try{
   const count=await api.getChatMemberCount({chat_id:u.chat.id});
   if(count<minimum){
    const me=await api.getMe();
    const botName=me.first_name||me.username||'ListaMyBOT';
    const chatTypeWord=u.chat.type==='channel'?'canal':'grupo';
    await api.sendMessage({
     chat_id:u.chat.id,
     text:`⚠️ Este ${chatTypeWord} tem menos de <b>${minimum}</b> membros.\nO <b>${botName}</b> requer no mínimo <b>${minimum}</b> membros para operar. Saindo...`,
     parse_mode:'HTML'
    });
    try{await api.leaveChat({chat_id:u.chat.id});}catch{}
    return;
   }
  }catch{}
 }

 await register(u.chat,u.from?.id||0);
}
