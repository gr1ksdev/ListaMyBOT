import {checkMembers,membershipBlocked} from './membership.js';
import { db, api } from 'sdk';
import { CATEGORIES, permissionErrors } from './domain.js';
import { config, getChat, state, putState, isBanned } from './store.js';
import { screen, escHtml } from './navigation.js';
export async function chatAdmin(chat,user){try{const m=await api.getChatMember({chat_id:chat,user_id:user});return ['creator','administrator'].includes(m.status);}catch{return false;}}
export async function rights(chat){const me=await api.getMe();return permissionErrors(chat,await api.getChatMember({chat_id:chat.id,user_id:me.id}));}
const STATUS = {
 draft: '📝 Cadastro em configuração',
 pending: '⏳ Aguardando aprovação',
 approved: '✅ Participação aprovada',
 rejected: '❌ Cadastro rejeitado',
 paused: '⏸ Participação pausada'
};

export function keyboard(c){
 const rows=[];
 for(let i=0;i<CATEGORIES.length;i+=2)rows.push(CATEGORIES.slice(i,i+2).map((text,j)=>({text:(c.category===i+j?'✓ ':'')+text,callback_data:`cat:${c.id}:${i+j}`})));
 rows.push([{text:'Continuar ›',callback_data:`cfg:${c.id}`}],[{text:'‹ Voltar',callback_data:`cfg:${c.id}`}]);
 return {inline_keyboard:rows};
}

export async function menu(c,target=c.id,message,view='summary'){
 const editable=!['approved','pending'].includes(c.status);
 const title=escHtml(c.title);
 const me=await api.getMe();
 const botLink=`tg://user?id=${me.id}`;
 const tgLink=t=>`<a href="${botLink}">${t}</a>`;
 const isChannel=c.type==='channel';
 const typeName=isChannel?'Canal':'Grupo';
 const typeIcon=isChannel?'📢':'💬';

 let text='';
 let rows=[];

 if(membershipBlocked(c)){
  text=`🚫 ${tgLink('Cadastro Rejeitado')} • <b><i>${title}</i></b>\n\n`+
   `<blockquote><b>⚠️ Critérios de Participação\n`+
   ` ┣ ${typeIcon} Tipo • ${tgLink(typeName)}\n`+
   ` ┣ ❌ Status • Rejeitado\n`+
   ` ┗ 💬 Motivo • ${escHtml(c.error)}\n</b></blockquote>\n\n`+
   `<b><i>💡 Ajuste os requisitos do seu ${tgLink(typeName)} e toque no botão abaixo para verificar novamente!</i></b>`;
  rows=[[{text:'↻ Verificar novamente',callback_data:`recheck:${c.id}`}]];
 }else if(view==='categories'&&editable){
  const selCat=CATEGORIES[c.category]||'Nenhuma selecionada';
  text=`🏷 ${tgLink('Categorias')} • <b><i>${title}</i></b>\n\n`+
   `<blockquote><b>📂 Configuração de Nicho\n`+
   ` ┣ ${typeIcon} Tipo • ${tgLink(typeName)}\n`+
   ` ┗ 🎯 Categoria • ${selCat}\n</b></blockquote>\n\n`+
   `<b><i>✨ Escolha a categoria do seu ${tgLink(typeName)} abaixo para direcionar o público na ${tgLink('Lista')}. Depois toque em Continuar:</i></b>`;
  rows=keyboard(c).inline_keyboard;
 }else if(view==='link'){
  if(editable){
   text=`🔗 ${tgLink('Link de Acesso')} • <b><i>${title}</i></b>\n\n`+
    `<blockquote><b>🌐 Configuração do Link\n`+
    ` ┣ ${typeIcon} Tipo • ${tgLink(typeName)}\n`+
    ` ┣ 🔗 Link Atual • ${c.url?escHtml(c.url):'Ainda não informado'}\n`+
    ` ┗ 📝 Formato • https://t.me/seunome ou link de convite\n</b></blockquote>\n\n`+
    `<b><i>💬 Envie o link do seu ${tgLink(typeName)} aqui no chat (ou use <code>/link URL</code>). Toque em Voltar para cancelar:</i></b>`;
  }else{
   text=`🔗 ${tgLink('Link de Acesso')} • <b><i>${title}</i></b>\n\n`+
    `<blockquote><b>🌐 Link Cadastrado\n`+
    ` ┣ ${typeIcon} Tipo • ${tgLink(typeName)}\n`+
    ` ┣ 🔗 Link • ${c.url?escHtml(c.url):'Indisponível'}\n`+
    ` ┗ 🔒 Status • Cadastro em análise ou aprovado\n</b></blockquote>\n\n`+
    `<b><i>✨ Este cadastro já foi enviado. Alterações posteriores podem ser solicitadas ao ${tgLink('Suporte')}.</i></b>`;
  }
  rows=[[{text:'‹ Voltar',callback_data:`cfg:${c.id}`}]];
 }else{
  const statusLabel=STATUS[c.status]||c.status;
  const catLabel=CATEGORIES[c.category]||'Ainda não selecionada';
  const urlLabel=c.url?escHtml(c.url):'Ainda não informado';

  text=`⚙️ ${tgLink('Configuração')} • <b><i>${title}</i></b>\n\n`+
   `<blockquote><b>${typeIcon} Painel do ${tgLink(typeName)}\n`+
   ` ┣ 📊 Status • ${statusLabel}\n`+
   ` ┣ 🏷 Categoria • ${catLabel}\n`+
   ` ┗ 🔗 Link • ${urlLabel}\n</b></blockquote>\n\n`+
   (editable
     ? `<b><i>✨ Defina a categoria e o link nos botões abaixo e depois envie para aprovação na ${tgLink('Lista')}!</i></b>`
     : `<b><i>✨ Seu cadastro foi enviado! Acompanhe o status e as divulgações pelo menu.</i></b>`);

  if(editable){
   rows=[
    [
     {text:'🏷 Escolher categoria',callback_data:`cats:${c.id}`},
     {text:'🔗 Editar link',callback_data:`link:${c.id}`}
    ],
    [
     {text:'✅ Enviar cadastro',callback_data:`submit:${c.id}`}
    ]
   ];
  }else{
   rows=[[{text:'↻ Atualizar status',callback_data:`cfg:${c.id}`}]];
  }
 }

 if(target>0){
  rows.push([
   {text:'👤 Meu Perfil',callback_data:'nav:profile'},
   {text:'🏠 Início',callback_data:'nav:home'}
  ]);
 }else{
  rows.push([{text:'Continuar no privado ↗',url:`https://t.me/${me.username}?start=${c.id}`}]);
 }

 const key=target>0?`private_menu:${target}`:`config_menu:${target}:${c.id}`;
 // Migrate the previous group menu so reopening does not post another message.
 if(!message&&target===c.menu_chat&&c.menu_id&&!await state(key,0))await putState(key,c.menu_id);
 const sent=await screen(target,key,text,rows,message);
 if(target===c.id)await db.run('UPDATE list_chats SET menu_chat=:chat,menu_id=:m WHERE id=:id',{':chat':target,':m':sent.message_id,':id':c.id});
 return sent;
}

export async function register(chat,actor){
 const missing=await rights(chat);
 if(missing.length){
  const me=await api.getMe();
  const botLink=`tg://user?id=${me.id}`;
  const tgLink=t=>`<a href="${botLink}">${t}</a>`;
  const isChannel=chat.type==='channel';
  const typeName=isChannel?'Canal':'Grupo';
  const typeIcon=isChannel?'📢':'💬';
  const permissionsList=missing.map(p=>` ┣ 🔑 ${p}`).join('\n');

  await api.sendMessage({
   chat_id:chat.id,
   text:`⚠️ ${tgLink('Permissões')} • <b><i>Configuração do ${tgLink(typeName)}</i></b>\n\n`+
    `<blockquote><b>${typeIcon} Permissões Necessárias\n`+
    `Para que este ${tgLink(typeName)} participe da ${tgLink('Lista')}, conceda:\n`+
    `${permissionsList}\n</b></blockquote>\n\n`+
    `<b><i>✨ Após conceder as permissões ao bot, envie <code>/configurar</code> no chat para continuar!</i></b>`,
   parse_mode:'HTML'
  });
  return;
 }
 if(actor && await isBanned(actor)){
  await api.sendMessage({chat_id:chat.id,text:'🚫 Este usuário está impedido de cadastrar canais e grupos na lista por decisão do administrador.'});
  return;
 }
 const old=await getChat(chat.id);const info=await api.getChat({chat_id:chat.id});
 const url=info.username?`https://t.me/${info.username}`:info.invite_link||old?.url||'';
 await db.run(`INSERT INTO list_chats(id,title,type,url,owner,updated) VALUES(:id,:title,:type,:url,:owner,:now)
 ON CONFLICT(id) DO UPDATE SET title=excluded.title,type=excluded.type,url=excluded.url,updated=excluded.updated`,{':id':chat.id,':title':chat.title||'Sem título',':type':chat.type,':url':url,':owner':actor,':now':Date.now()});
 let c=await getChat(chat.id);
 const {settings}=await config();
 try{const result=await checkMembers(c,settings);if(result.ok&&membershipBlocked(c)){await db.run("UPDATE list_chats SET status='draft',error='' WHERE id=:id AND status='rejected'",{':id':c.id});c=await getChat(c.id);}}catch(e){await screen(chat.id,`config_menu:${chat.id}:${chat.id}`,e.message,[[{text:'↻ Verificar novamente',callback_data:`recheck:${chat.id}`}]]);return;}
 try{await menu(c,c.id,undefined,c.category<0?'categories':'summary');}catch(e){if(actor){try{await menu(c,actor);}catch{console.log('Não foi possível abrir configuração; use /configurar no chat.');}}}
}
// Configuração concluída no chat: apaga o menu e limpa os registros para não ficar exposto.
export async function closeMenu(c,target,messageId){
 try{await api.deleteMessage({chat_id:target,message_id:messageId});}catch{return false;}
 await putState(`config_menu:${target}:${c.id}`,null);
 await db.run('UPDATE list_chats SET menu_chat=0,menu_id=0 WHERE id=:id AND menu_chat=:t',{':id':c.id,':t':target});
 return true;
}
export async function submit(c,user){
 if(user && await isBanned(user)) throw Error('Você está banido pelo administrador.');
 const {settings}=await config();const membership=await checkMembers(c,settings);if(!membership.ok)return 'rejected';
 if(c.category<0)throw Error('Selecione uma categoria primeiro.');
 const missing=await rights(c);if(missing.length)throw Error('Faltam permissões: '+missing.join(', '));
 if(!c.url)throw Error('Este chat precisa de um link. Envie /link https://t.me/+CONVITE no próprio chat ou peça ao admin do bot para cadastrá-lo no painel.');
 const status=settings.approval==='automatic'?'approved':'pending';
 const result=await db.run("UPDATE list_chats SET status=:s,owner=:u,error='',updated=:n WHERE id=:id AND status IN ('draft','rejected','paused')",{':s':status,':u':user,':n':Date.now(),':id':c.id});
 return result.rowsAffected?status:c.status;
}
