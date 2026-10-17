import { api, db } from 'sdk';
import { APP_URL, validLink } from '../lib/domain.js';
import { getChat, isAdmin, state, putState, isBanned } from '../lib/store.js';
import { register, menu, chatAdmin } from '../lib/registration.js';
import { screen, privateScreen, escHtml } from '../lib/navigation.js';
// Explicit commands should answer at the bottom of the conversation. Inline
// callbacks keep editing their current menu, without producing new messages.
export default async function(m){
 const command=m.chat?.type==='private'&&(m.text||'').trim().startsWith('/');
 if(!command)return handleMessage(m);
 const key=`private_menu:${m.from.id}`;
 const previous=await state(key,0);
 await putState(key,0);
 try{
  await handleMessage(m);
 }catch(error){
  if(!await state(key,0))await putState(key,previous);
  throw error;
 }
 const current=await state(key,0);
 if(previous&&current&&previous!==current){
  try{await api.deleteMessage({chat_id:m.chat.id,message_id:previous});}catch{/* Old menus may already have been deleted. */}
 }else if(!current){await putState(key,previous);}
}
async function handleMessage(m){
 const text=(m.text||'').trim();const [word,...args]=text.split(/\s+/);const cmd=word.split('@')[0].toLowerCase();const user=m.from?.id;
 if(m.migrate_to_chat_id){await db.run('UPDATE list_chats SET id=:new,type=\'supergroup\' WHERE id=:old',{':new':m.migrate_to_chat_id,':old':m.chat.id});return;}
 const privateChat=m.chat.type==='private';
 if(privateChat && await isBanned(user)){
  await screen(user, `private_menu:${user}`, '🚫 <b><i>Acesso Suspenso</i></b>\n\n<blockquote><b><i>Você foi banido pelo administrador e não pode participar da lista de divulgação.</i></b></blockquote>\n\n<b><i>Caso tenha dúvidas, entre em contato com o suporte:</i></b>', [[{text:'💬 Suporte',callback_data:'nav:support'}]]);
  return;
 }
 const sessionKey=`await_link:${privateChat?user:m.chat.id+':'+(m.sender_chat?.id||user)}`;
 const waiting=await state(sessionKey,null);
 if(waiting&&waiting.expires>Date.now()&&(cmd==='/link'||(!text.startsWith('/')&&text))){
 const c=await getChat(waiting.chat);const anonymous=!privateChat&&m.sender_chat?.id===m.chat.id;
 if(!c||(!anonymous&&!await chatAdmin(c.id,user))){await putState(sessionKey,null);return;}
 const url=cmd==='/link'?args[0]:text;
 if(!['draft','paused','rejected'].includes(c.status)){await putState(sessionKey,null);await menu(c,m.chat.id);return;}
 if(!validLink(url)){await screen(m.chat.id,privateChat?`private_menu:${user}`:`config_menu:${c.id}:${c.id}`,'Esse link não é válido. Envie um link como https://t.me/meucanal ou https://t.me/+CONVITE.',[[{text:'‹ Voltar',callback_data:`cfg:${c.id}`}]]);return;}
 await db.run('UPDATE list_chats SET url=:url,updated=:n WHERE id=:id',{':url':url,':n':Date.now(),':id':c.id});await putState(sessionKey,null);c.url=url;await menu(c,m.chat.id);return;
 }
 if(text.startsWith('/'))await putState(sessionKey,null);
 if(privateChat){
 const searchKey=`await_search:${user}`;
 const waitingSearch=await state(searchKey,false);
 if(waitingSearch&&!text.startsWith('/')){
  await putState(searchKey,null);
  const term=`%${text}%`;
  const results=await db.all("SELECT id,title,display,url FROM list_chats WHERE status='approved' AND (title LIKE :t OR display LIKE :t) LIMIT 10",{':t':term});
  const me=await api.getMe();
  const botLink=`tg://user?id=${me.id}`;
  if(!results.length){
   await screen(user,`private_menu:${user}`,`🔍 <a href="${botLink}"><b><i>Pesquisar</i></b></a>\n\n<blockquote><b><i>Nenhum canal ou grupo encontrado para “${escHtml(text)}”.</i></b></blockquote>\n\n<b><i>Tente pesquisar por outro nome ou termo.</i></b>`,[[{text:'🔍 Pesquisar novamente',callback_data:'nav:search'}],[{text:'🏠 Início',callback_data:'nav:home'}]]);
   return;
  }
  const rows=results.map(c=>[{text:'📢 '+(c.display||c.title).slice(0,45),url:c.url}]);
  rows.push([{text:'🔍 Nova pesquisa',callback_data:'nav:search'},{text:'🏠 Início',callback_data:'nav:home'}]);
  await screen(user,`private_menu:${user}`,`🔍 <a href="${botLink}"><b><i>Resultados da Pesquisa</i></b></a>\n\n<blockquote><b><i>Encontramos ${results.length} resultado(s) para “${escHtml(text)}”:</i></b></blockquote>\n\n<b><i>Toque em um dos botões abaixo para acessar:</i></b>`,rows);
  return;
 }
 if(cmd==='/admin'){
 if(!await isAdmin(user)){await screen(user,`private_menu:${user}`,'Este painel é exclusivo dos administradores do bot.',[[{text:'🏠 Início',callback_data:'nav:home'}]]);return;}
 await screen(user,`private_menu:${user}`,'⚙️ Administração\n\nAbra o painel para aprovar participantes, editar sua lista e configurar os envios.',[[{text:'Abrir painel admin',web_app:{url:APP_URL}}],[{text:'🏠 Início',callback_data:'nav:home'}]]);return;}
 if(cmd==='/start'||cmd==='/configurar'){
 const id=/^-\d+$/.test(args[0]||'')?Number(args[0]):null;
 if(Number.isSafeInteger(id)){const c=await getChat(id);if(c&&await chatAdmin(c.id,user)){await putState(sessionKey,null);await menu(c,user);return;}}
 await privateScreen(user,cmd==='/start'?'home':'chats',undefined,m.from);return;
 }
 if(cmd==='/perfil'||cmd==='/meuperfil'){await privateScreen(user,'profile',undefined,m.from);return;}
 if(cmd==='/horarios'||cmd==='/horario'){await privateScreen(user,'schedule',undefined,m.from);return;}
 if(cmd==='/canais'){await privateScreen(user,'channels',undefined,m.from);return;}
 if(cmd==='/grupos'){await privateScreen(user,'groups',undefined,m.from);return;}
 if(cmd==='/pesquisar'){await privateScreen(user,'search',undefined,m.from);return;}
 if(cmd==='/suporte'){await privateScreen(user,'support',undefined,m.from);return;}
 if(cmd==='/link'){await privateScreen(user,'links',undefined,m.from);return;}
 if(cmd==='/ajuda'){await privateScreen(user,'help',undefined,m.from);return;}
 if(cmd==='/cancelar'){await privateScreen(user,'home',undefined,m.from);return;}
 if(text.startsWith('/'))await privateScreen(user,'home',undefined,m.from);
 return;
 }
 if(!['/configurar','/link'].includes(cmd))return;
 const anonymous=m.sender_chat?.id===m.chat.id;if(!anonymous&&!await chatAdmin(m.chat.id,user))return;
 await putState(sessionKey,null);
 if(cmd==='/configurar'){await register(m.chat,m.from?.is_bot?0:user||0);return;}
 const c=await getChat(m.chat.id);if(!c){await register(m.chat,m.from?.is_bot?0:user||0);return;}
 if(args[0]&&validLink(args[0])&&!['approved','pending'].includes(c.status)){
 await db.run('UPDATE list_chats SET url=:u,updated=:n WHERE id=:id',{':u':args[0],':n':Date.now(),':id':c.id});c.url=args[0];await menu(c);return;}
 if(!['approved','pending'].includes(c.status))await putState(sessionKey,{chat:c.id,expires:Date.now()+600000});
 await menu(c,c.id,undefined,'link');
}
