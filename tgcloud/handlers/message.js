import { api, db } from 'sdk';
import { APP_URL, validLink, OWNER, OWNERS, isOwner, normalizeMaintenance, validateSettings, truncateButtonText } from '../lib/domain.js';
import { getChat, isAdmin, state, putState, isBanned, config } from '../lib/store.js';
import { register, menu, chatAdmin } from '../lib/registration.js';
import { screen, privateScreen, escHtml } from '../lib/navigation.js';
import { parsePromoPayload, isPayloadLike, submitPromotion, promoTemplate, updatePromoConfig } from '../lib/promotions.js';
import { setupLogTopics, bindLogTopic, captureLogTopic } from '../lib/log_topics.js';
import { getTicketByThreadId, getActiveTicketForUser, createTicket, closeTicket, relayUserMessage, relayAdminMessage } from '../lib/support.js';
import { parseSendCommand, handleSendCommand, getSendHelpText, trackUser } from '../lib/broadcast.js';
import { maintenanceGate, sendMaintenanceNotice } from '../lib/maintenance.js';
// Explicit commands should answer at the bottom of the conversation. Inline
// callbacks keep editing their current menu, without producing new messages.
export default async function(m){
 const rawText = (m.text || m.caption || '').trim();
 const { settings } = await config();
 // Capture topic-creation service messages even during maintenance. This is a
 // safety net for updates that time out right after createForumTopic.
 if (m.forum_topic_created) {
  try { await captureLogTopic(m); } catch (error) { console.warn('Falha ao registrar tópico criado:', error); }
  if (!rawText) return;
 }
 const commandName = rawText.startsWith('/') ? rawText.split(/\s+/)[0].split('@')[0].toLowerCase() : '';
 // Setup commands are authorized separately and must keep working during
 // maintenance, including for administrators of the log group.
 const setupCommands = ['/setlogs', '/setcanal', '/setdivulgacao', '/settopic'];
 const maintenance = maintenanceGate(settings, m.from?.id);
 if (maintenance.blocked && !setupCommands.includes(commandName)) {
  // Do not flood groups/channels: outside private chats, only answer commands.
  const isPrivate = m.chat?.type === 'private';
  const isGroupCommand = ['group', 'supergroup'].includes(m.chat?.type) && rawText.startsWith('/');
  if (isPrivate || isGroupCommand) {
   await sendMaintenanceNotice(m.chat.id, maintenance.message);
  }
  return;
 }
 const command = m.chat?.type === 'private' && rawText.startsWith('/');
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
 const text=(m.text||m.caption||'').trim();const [word,...args]=text.split(/\s+/);const cmd=word.split('@')[0].toLowerCase();const user=m.from?.id;
 if (m.from && !m.from.is_bot) await trackUser(m.from);
 if(m.migrate_to_chat_id){await db.run('UPDATE list_chats SET id=:new,type=\'supergroup\' WHERE id=:old',{':new':m.migrate_to_chat_id,':old':m.chat.id});return;}
 const privateChat=m.chat.type==='private';
 if (!privateChat && m.message_thread_id && !m.from?.is_bot) {
  const ticket = await getTicketByThreadId(m.message_thread_id);
  if (ticket && ticket.log_chat_id === m.chat.id) {
   // Only administrators of the log group may talk to the user or close a ticket.
   // Being able to post in the support topic is not enough.
   if (!m.from || m.from.is_bot || !await chatAdmin(m.chat.id, m.from.id)) return;
   if (['/encerrar', '/fecharticket', '/fechar'].includes(cmd)) {
    await closeTicket(ticket.code, m.from, 'Encerrado pelo moderador via comando');
    return;
   }
   await relayAdminMessage(ticket, m);
   return;
  }
 }
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
 if (cmd === '/setlogs') {
  const isBotAdm = await isAdmin(user);
  const isChatAdm = m.chat.id < 0 ? await chatAdmin(m.chat.id, user) : false;
  if (!isBotAdm && !isChatAdm) {
   await api.sendMessage({ chat_id: m.chat.id, text: 'Apenas administradores podem configurar o grupo de logs.' });
   return;
  }
  const targetId = /^-\d+$/.test(args[0] || '') ? Number(args[0]) : (m.chat.id < 0 ? m.chat.id : null);
  if (!targetId) {
   await api.sendMessage({ chat_id: m.chat.id, text: 'Envie o comando dentro do grupo de logs ou informe o ID: <code>/setlogs -100xxxxxxxxxx</code>', parse_mode: 'HTML' });
   return;
  }
  let result;
  try {
   result = await setupLogTopics(targetId);
  } catch (err) {
   result = { ok: false, error: err?.message || 'Erro inesperado ao configurar os tópicos.' };
  }
  if (!result.ok) {
   await api.sendMessage({
    chat_id: m.chat.id,
    text: `❌ <b>Não foi possível configurar o grupo de logs.</b>\n\n${escHtml(result.error || 'Erro inesperado')}\n\n<i>Confira se o bot é administrador do grupo com a permissão "Gerenciar tópicos" e se o grupo tem tópicos ativados.</i>`,
    parse_mode: 'HTML'
   });
   return;
  }
  const statusLabels = { existing: 'Já configurado', created: 'Criado', recreated: 'Recriado' };
  const lines = result.topics.map(topic => {
   if (topic.status === 'failed') {
    return `• ${topic.name}: <b>Falhou</b> — <i>${escHtml(topic.error || 'erro desconhecido')}</i>`;
   }
   return `• ${topic.name} (ID: <code>${topic.topicId}</code>) <i>[${statusLabels[topic.status] || topic.status}]</i>`;
  });
  const failed = result.topics.filter(topic => topic.status === 'failed');
  const title = failed.length
   ? '⚠️ <b>Grupo de logs configurado parcialmente.</b>'
   : '✅ <b>Grupo de logs configurado!</b>';
  const summary = failed.length
   ? `\n\n⚠️ <i>${failed.length} tópico(s) não puderam ser criados. Execute <code>/setlogs ${targetId}</code> novamente para tentar somente os que faltam.</i>`
   : '\n\nTodas as solicitações de divulgação, cadastros e suporte serão enviadas para seus respectivos tópicos.';
  await api.sendMessage({
   chat_id: m.chat.id,
   text: `${title}\n\n🆔 Chat ID: <code>${targetId}</code>\n📌 <b>Status dos tópicos:</b>\n${lines.join('\n')}${summary}`,
   parse_mode: 'HTML'
  });
  return;
 }
 if (cmd === '/settopic' || cmd === '/settopicos') {
  const isBotAdm = await isAdmin(user);
  const isChatAdm = m.chat.id < 0 ? await chatAdmin(m.chat.id, user) : false;
  if (!isBotAdm && !isChatAdm) {
   await api.sendMessage({ chat_id: m.chat.id, text: 'Apenas administradores podem vincular tópicos.' });
   return;
  }
  const aliases = {
   promo: 'promo', divulgacao: 'promo', divulgacoes: 'promo', divulgação: 'promo', divulgações: 'promo',
   chats: 'chats', cadastro: 'chats', cadastros: 'chats',
   support: 'support', suporte: 'support', duvida: 'support', duvidas: 'support', dúvida: 'support', dúvidas: 'support'
  };
  const kind = aliases[(args[0] || '').toLowerCase()];
  if (!kind) {
   await api.sendMessage({
    chat_id: m.chat.id,
    text: `ℹ️ <b>Vincular tópico existente</b>\n\n` +
     `Use <code>/settopic promo</code>, <code>/settopic cadastros</code> ou <code>/settopic suporte</code> dentro do tópico correspondente.\n\n` +
     `Também é possível informar o ID: <code>/settopic suporte 12345</code> (no grupo) ou <code>/settopic suporte 12345 -100...</code> (no privado).`,
    parse_mode: 'HTML'
   });
   return;
  }
  let groupId = m.chat.id < 0 ? m.chat.id : 0;
  let topicId = m.message_thread_id || 0;
  for (const value of args.slice(1)) {
   if (!/^-?\d+$/.test(value)) continue;
   const number = Number(value);
   if (number < 0) groupId = number;
   else if (!topicId) topicId = number;
  }
  if (!groupId || !topicId) {
   await api.sendMessage({
    chat_id: m.chat.id,
    text: `ℹ️ Abra o tópico no grupo de logs e envie <code>/settopic ${args[0] || 'suporte'}</code>, ou informe os IDs: <code>/settopic ${args[0] || 'suporte'} 12345 -100...</code>`,
    parse_mode: 'HTML'
   });
   return;
  }
  const result = await bindLogTopic(groupId, kind, topicId);
  if (!result.ok) {
   await api.sendMessage({ chat_id: m.chat.id, text: `❌ <b>Não foi possível vincular o tópico.</b>\n\n${escHtml(result.error || 'Erro inesperado')}`, parse_mode: 'HTML' });
   return;
  }
  await api.sendMessage({
   chat_id: m.chat.id,
   text: `✅ <b>Tópico vinculado!</b>\n\n📌 ${result.name}\n🆔 Tópico: <code>${result.topicId}</code>\n🆔 Grupo: <code>${groupId}</code>`,
   parse_mode: 'HTML'
  });
  return;
 }
 if (cmd === '/setcanal' || cmd === '/setdivulgacao') {
  if (!await isAdmin(user)) {
   await api.sendMessage({ chat_id: m.chat.id, text: 'Apenas administradores do bot podem configurar o canal de divulgação.' });
   return;
  }
  const targetChannel = args[0] || (m.chat.id < 0 ? String(m.chat.id) : '');
  if (!targetChannel) {
   await api.sendMessage({ chat_id: m.chat.id, text: 'Informe o ID ou username do canal: <code>/setcanal -100xxxxxxxxxx</code> ou <code>/setcanal @canal</code>', parse_mode: 'HTML' });
   return;
  }
  await updatePromoConfig({ promoChannel: targetChannel });
  await api.sendMessage({
   chat_id: m.chat.id,
   text: `✅ <b>Canal de divulgação vinculado com sucesso!</b>\n\n📢 Canal: <code>${escHtml(targetChannel)}</code>\nAs divulgações aprovadas pelos moderadores serão postadas automaticamente aqui com os botões interativos.`,
   parse_mode: 'HTML'
  });
  return;
 }
 if (cmd === '/statusdivulgacao' || cmd === '/promostatus') {
  if (!await isAdmin(user)) return;
  const c = await config();
  await api.sendMessage({
   chat_id: m.chat.id,
   text: `📊 <b>Status dos Grupos & Divulgação</b>\n\n` +
         `• <b>Grupo de Logs:</b> <code>${c.settings.promoLogChat || 'Não configurado'}</code>\n` +
         `• <b>Tópico de Divulgações:</b> <code>${c.settings.promoLogTopic || 'Nenhum (chat principal)'}</code>\n` +
         `• <b>Tópico de Cadastros:</b> <code>${c.settings.chatsLogTopic || 'Nenhum (chat principal)'}</code>\n` +
         `• <b>Tópico de Suporte:</b> <code>${c.settings.supportLogTopic || 'Nenhum (chat principal)'}</code>\n` +
         `• <b>Canal Vinculado:</b> <code>${c.settings.promoChannel || 'Não vinculado'}</code>\n\n` +
         `<i>Use /setlogs no grupo de logs e /setcanal no canal de publicação.</i>`,
   parse_mode: 'HTML'
  });
  return;
 }
 if (cmd === '/manutencao' || cmd === '/maintenance') {
  if (!await isAdmin(user)) {
   await api.sendMessage({
    chat_id: m.chat.id,
    text: '🚫 <b>Acesso negado:</b> apenas administradores podem ativar ou desativar o modo manutenção.',
    parse_mode: 'HTML'
   });
   return;
  }
  const c = await config();
  const current = normalizeMaintenance(c.settings.maintenance);
  const sub = (args[0] || '').toLowerCase();
  const usage = `🛠️ <b>Modo Manutenção</b>\n\n` +
   `• <code>/manutencao on</code> — ativar\n` +
   `• <code>/manutencao off</code> — desativar\n` +
   `• <code>/manutencao msg &lt;texto&gt;</code> — definir a mensagem automática\n` +
   `• <code>/manutencao status</code> — consultar o estado atual\n\n` +
   `<i>Uma mensagem vazia deixa o bot em silêncio durante a manutenção.</i>`;
  if (!sub || sub === 'status') {
   const messageText = current.message.trim()
    ? `<blockquote>${escHtml(current.message)}</blockquote>`
    : '<i>🔇 Nenhuma mensagem configurada (bot silencioso).</i>';
   await api.sendMessage({
    chat_id: m.chat.id,
    text: `🛠️ <b>Modo Manutenção: ${current.enabled ? 'ATIVADO' : 'DESATIVADO'}</b>\n\n` +
     `<b>Mensagem automática:</b>\n${messageText}\n\n${usage}`,
    parse_mode: 'HTML'
   });
   return;
  }
  let next = null;
  let confirmation = '';
  if (['on', 'ativar', 'ligar'].includes(sub)) {
   next = { ...current, enabled: true };
   confirmation = '✅ <b>Modo manutenção ativado.</b>\n\nUsuários comuns não serão atendidos' +
    (current.message.trim() ? ' e receberão a mensagem configurada.' : ' (bot silencioso).') +
    '\n\n<i>Administradores continuam com acesso ao painel e aos comandos.</i>';
  } else if (['off', 'desativar', 'desligar'].includes(sub)) {
   next = { ...current, enabled: false };
   confirmation = '✅ <b>Modo manutenção desativado.</b>\n\nO bot voltou a responder normalmente.';
  } else if (['msg', 'mensagem'].includes(sub)) {
   const message = text.slice(word.length).trim().replace(/^(msg|mensagem)\b\s*/i, '').trim();
   next = { ...current, message };
   confirmation = '✅ <b>Mensagem de manutenção atualizada.</b>\n\n' +
    (message ? `<blockquote>${escHtml(message)}</blockquote>` : '<i>🔇 Mensagem vazia: o bot ficará silencioso durante a manutenção.</i>');
  } else {
   await api.sendMessage({ chat_id: m.chat.id, text: usage, parse_mode: 'HTML' });
   return;
  }
  const updated = validateSettings({ ...c.settings, maintenance: next }, Date.now(), c.settings);
  let result;
  if (c.version === 0) {
   result = await db.run('INSERT INTO list_settings(id,value,version) VALUES(1,:v,1) ON CONFLICT(id) DO NOTHING', { ':v': JSON.stringify(updated) });
  } else {
   result = await db.run('UPDATE list_settings SET value=:v,version=version+1 WHERE id=1 AND version=:version', { ':v': JSON.stringify(updated), ':version': c.version });
  }
  if (!result.rowsAffected) {
   await api.sendMessage({
    chat_id: m.chat.id,
    text: '⚠️ <b>As configurações mudaram.</b>\n\nAtualize o painel e tente novamente.',
    parse_mode: 'HTML'
   });
   return;
  }
  await api.sendMessage({ chat_id: m.chat.id, text: confirmation, parse_mode: 'HTML' });
  return;
 }
 if (cmd === '/setadmin' || cmd === '/addadmin') {
  if (!isOwner(user)) {
   await api.sendMessage({
    chat_id: m.chat.id,
    text: '🚫 <b>Acesso negado:</b> apenas os proprietários (Owners) podem cadastrar novos administradores.',
    parse_mode: 'HTML'
   });
   return;
  }
  let targetId = null;
  if (args[0]) {
   const cleanArg = args[0].replace(/^@/, '');
   if (/^\d+$/.test(cleanArg)) {
    targetId = Number(cleanArg);
   }
  } else if (m.reply_to_message?.from?.id) {
   targetId = m.reply_to_message.from.id;
  }
  if (!targetId || !Number.isSafeInteger(targetId) || targetId <= 0) {
   await api.sendMessage({
    chat_id: m.chat.id,
    text: `ℹ️ <b>Uso do comando /setadmin:</b>\n\n` +
          `• Envie: <code>/setadmin &lt;ID_DO_USUARIO&gt;</code>\n` +
          `• Ou responda à mensagem de alguém com: <code>/setadmin</code>\n\n` +
          `<i>Exemplo: <code>/setadmin 123456789</code></i>`,
    parse_mode: 'HTML'
   });
   return;
  }
  if (isOwner(targetId)) {
   await api.sendMessage({
    chat_id: m.chat.id,
    text: `👑 O ID <code>${targetId}</code> já é um <b>Proprietário (Owner) permanente</b> do bot.`,
    parse_mode: 'HTML'
   });
   return;
  }
  const c = await config();
  const currentAdmins = c.settings.admins || [];
  if (currentAdmins.includes(targetId)) {
   await api.sendMessage({
    chat_id: m.chat.id,
    text: `ℹ️ O usuário com ID <code>${targetId}</code> já é um <b>administrador</b> cadastrado.`,
    parse_mode: 'HTML'
   });
   return;
  }
  if (currentAdmins.length >= 20) {
   await api.sendMessage({
    chat_id: m.chat.id,
    text: `❌ Limite de 20 administradores atingido. Remova algum administrador antes de adicionar novos.`,
    parse_mode: 'HTML'
   });
   return;
  }
  const newAdmins = [...new Set([...OWNERS, ...currentAdmins, targetId])];
  const updated = validateSettings({ ...c.settings, admins: newAdmins }, Date.now(), c.settings);
  if (c.version === 0) {
   await db.run('INSERT INTO list_settings(id, value, version) VALUES(1, :v, 1) ON CONFLICT(id) DO UPDATE SET value=excluded.value', { ':v': JSON.stringify(updated) });
  } else {
   await db.run('UPDATE list_settings SET value=:v, version=version+1 WHERE id=1', { ':v': JSON.stringify(updated) });
  }
  await api.sendMessage({
   chat_id: m.chat.id,
   text: `✅ <b>Novo administrador configurado com sucesso!</b>\n\n` +
         `🆔 <b>ID:</b> <code>${targetId}</code>\n` +
         `🛡️ O usuário agora tem acesso de administrador ao bot e ao painel Mini App.`,
   parse_mode: 'HTML'
  });
  return;
 }
 if (cmd === '/deladmin' || cmd === '/removeadmin') {
  if (!isOwner(user)) {
   await api.sendMessage({
    chat_id: m.chat.id,
    text: '🚫 <b>Acesso negado:</b> apenas os proprietários (Owners) podem remover administradores.',
    parse_mode: 'HTML'
   });
   return;
  }
  let targetId = null;
  if (args[0] && /^\d+$/.test(args[0])) {
   targetId = Number(args[0]);
  } else if (m.reply_to_message?.from?.id) {
   targetId = m.reply_to_message.from.id;
  }
  if (!targetId || !Number.isSafeInteger(targetId) || targetId <= 0) {
   await api.sendMessage({
    chat_id: m.chat.id,
    text: `ℹ️ <b>Uso do comando /deladmin:</b>\n\nEnvie <code>/deladmin &lt;ID_DO_USUARIO&gt;</code> para remover um administrador.`,
    parse_mode: 'HTML'
   });
   return;
  }
  if (isOwner(targetId)) {
   await api.sendMessage({
    chat_id: m.chat.id,
    text: `❌ <b>Ação bloqueada:</b> Os proprietários (Owners) permanentes do bot não podem ser removidos.`,
    parse_mode: 'HTML'
   });
   return;
  }
  const c = await config();
  const currentAdmins = c.settings.admins || [];
  if (!currentAdmins.includes(targetId)) {
   await api.sendMessage({
    chat_id: m.chat.id,
    text: `ℹ️ O ID <code>${targetId}</code> não está na lista de administradores.`,
    parse_mode: 'HTML'
   });
   return;
  }
  const newAdmins = currentAdmins.filter(id => id !== targetId);
  const updated = validateSettings({ ...c.settings, admins: newAdmins }, Date.now(), c.settings);
  await db.run('UPDATE list_settings SET value=:v, version=version+1 WHERE id=1', { ':v': JSON.stringify(updated) });
  await api.sendMessage({
   chat_id: m.chat.id,
   text: `🗑️ <b>Administrador removido com sucesso!</b>\n\n🆔 ID: <code>${targetId}</code> não possui mais acesso administrativo.`,
   parse_mode: 'HTML'
  });
  return;
 }
 if (cmd === '/admins') {
  if (!await isAdmin(user)) return;
  const c = await config();
  const currentAdmins = (c.settings.admins || []).filter(id => !isOwner(id));
  await api.sendMessage({
   chat_id: m.chat.id,
   text: `🛡️ <b>Administradores do Bot:</b>\n\n` +
         `👑 <b>Proprietários (Owners):</b>\n` +
         OWNERS.map(id => `• <code>${id}</code>`).join('\n') + `\n\n` +
         `<b>Administradores Adicionais (${currentAdmins.length}):</b>\n` +
         (currentAdmins.length ? currentAdmins.map(id => `• <code>${id}</code>`).join('\n') : '<i>Nenhum administrador adicional cadastrado.</i>') +
         `\n\n<i>Gerenciamento exclusivo dos proprietários.</i>`,
   parse_mode: 'HTML'
  });
  return;
 }
 const parsedSend = parseSendCommand(cmd, args, text);
 if (parsedSend.isSend) {
  if (!await isAdmin(user)) {
   await api.sendMessage({
    chat_id: m.chat.id,
    ...(m.message_thread_id ? { message_thread_id: m.message_thread_id } : {}),
    text: '🚫 <b>Acesso negado:</b> apenas administradores do bot podem utilizar comandos de envio e transmissão.',
    parse_mode: 'HTML'
   });
   return;
  }
  if (parsedSend.isHelp) {
   await api.sendMessage({
    chat_id: m.chat.id,
    ...(m.message_thread_id ? { message_thread_id: m.message_thread_id } : {}),
    text: getSendHelpText(),
    parse_mode: 'HTML'
   });
   return;
  }
  if (parsedSend.isInvalid) {
   await api.sendMessage({
    chat_id: m.chat.id,
    ...(m.message_thread_id ? { message_thread_id: m.message_thread_id } : {}),
    text: `⚠️ <b>Uso incorreto:</b> destino <code>${escHtml(parsedSend.rawArg)}</code> não reconhecido.\n\nEnvie <code>/send</code> para consultar as instruções de uso.`,
    parse_mode: 'HTML'
   });
   return;
  }
  await handleSendCommand(m, parsedSend);
  return;
 }
 if(privateChat){
  const supportKey = `await_support_msg:${user}`;
  const waitingSupport = await state(supportKey, false);
  if (waitingSupport) {
   await putState(supportKey, null);
   if (cmd === '/cancelar') {
    await privateScreen(user, 'home', undefined, m.from);
    return;
   }
   if (!text.startsWith('/') && text) {
    const res = await createTicket(m.from, text);
    if (res.ok) {
     await api.sendMessage({
      chat_id: user,
      text: `⏳ <b>Solicitação Recebida — Ticket #${res.ticket.code}</b>\n\n` +
       `<blockquote><b><i>Por favor, aguarde um momento. Um de nossos administradores já vai te atender!</i></b></blockquote>\n\n` +
       `<i>Assim que o atendimento for iniciado por um moderador, você receberá uma notificação aqui e tudo o que você digitar será encaminhado diretamente a ele.</i>`,
      parse_mode: 'HTML',
      reply_markup: {
       inline_keyboard: [
        [{ text: '🛑 Cancelar Solicitação', callback_data: `ticket:user_close:${res.ticket.code}` }]
       ]
      }
     });
     return;
    } else {
     await api.sendMessage({
      chat_id: user,
      text: `⚠️ <b>Não foi possível abrir o chamado:</b>\n\n${escHtml(res.error || 'Erro inesperado')}\n\n<i>Tente novamente mais tarde ou use /suporte.</i>`,
      parse_mode: 'HTML',
      reply_markup: {
       inline_keyboard: [
        [{ text: '‹ Voltar ao Suporte', callback_data: 'nav:support' }]
       ]
      }
     });
     return;
    }
   }
  }

  const activeTicket = await getActiveTicketForUser(user);
  if (activeTicket) {
   if (['/encerrar', '/fecharticket', '/fechar'].includes(cmd)) {
    await closeTicket(activeTicket.code, m.from, 'Encerrado pelo usuário via comando');
    return;
   }
   if (!text.startsWith('/')) {
    if (activeTicket.status === 'open') {
     await relayUserMessage(activeTicket, m);
     return;
    } else {
     await api.sendMessage({
      chat_id: user,
      text: `⏳ <b>Solicitação em Espera — Ticket #${activeTicket.code}</b>\n\n` +
       `<blockquote><b><i>Por favor, aguarde um momento. Um de nossos administradores já vai te atender!</i></b></blockquote>\n\n` +
       `<i>Assim que o administrador responder, suas mensagens serão encaminhadas diretamente para ele!</i>`,
      parse_mode: 'HTML',
      reply_markup: {
       inline_keyboard: [
        [{ text: '🛑 Cancelar Solicitação', callback_data: `ticket:user_close:${activeTicket.code}` }]
       ]
      }
     });
     return;
    }
   }
  }

 if (!text.startsWith('/') && isPayloadLike(text)) {
  const parsed = parsePromoPayload(text, m);
  if (parsed.ok) {
   await putState(`promo_draft:${user}`, parsed.data);
   const previewText = `📋 <b>Divulgação pronta para envio!</b>\n\n` +
    `🆔 <b>ID C/G:</b> <code>${escHtml(parsed.data.chat_id || 'Não informado')}</code> (${parsed.data.type === 'channel' ? '📢 Canal' : '💬 Grupo'})\n` +
    `🌐 <b>Nome:</b> <b>${escHtml(parsed.data.title)}</b>\n` +
    `📝 <b>Descrição:</b>\n<blockquote>${escHtml(parsed.data.description)}</blockquote>\n` +
    `📌 <b>Categoria / Tags:</b> ${escHtml(parsed.data.category)}\n` +
    `🔗 <b>Link:</b> ${escHtml(parsed.data.url)}\n` +
    (parsed.data.media_type ? `🖼 <b>Mídia anexada:</b> ${parsed.data.media_type.toUpperCase()}\n` : '') +
    `━━━━━━━━━━━━━━━━━━\n` +
    `Envie <b>/divulgar</b> para confirmar o envio ou toque no botão abaixo:`;
   await api.sendMessage({
    chat_id: user,
    text: previewText,
    parse_mode: 'HTML',
    reply_markup: {
     inline_keyboard: [
      [{ text: '🚀 Confirmar Envio (/divulgar)', callback_data: 'promo:confirm_submit' }]
     ]
    }
   });
   return;
  } else {
   await api.sendMessage({
    chat_id: user,
    text: `⚠️ <b>Formato de divulgação incompleto:</b>\n\n${escHtml(parsed.error)}\n\n<b>Modelo correto:</b>\n${promoTemplate()}\n\n<i>Envie novamente corrigindo os campos pendentes.</i>`,
    parse_mode: 'HTML'
   });
   return;
  }
 }
 if (cmd === '/divulgar') {
  const hasPayloadInText = text.length > 10 && (text.includes('🆔') || text.includes('🌐'));
  if (hasPayloadInText) {
   const parsed = parsePromoPayload(text, m);
   if (!parsed.ok) {
    await api.sendMessage({
     chat_id: user,
     text: `⚠️ <b>Dados incompletos na divulgação:</b>\n\n${escHtml(parsed.error)}\n\n<b>Modelo exigido:</b>\n${promoTemplate()}`,
     parse_mode: 'HTML'
    });
    return;
   }
   await submitPromotion(m.from, parsed.data);
   await putState(`promo_draft:${user}`, null);
   await api.sendMessage({
    chat_id: user,
    text: '✅ <b>Sua solicitação de divulgação foi enviada com sucesso!</b>\n\nNossos moderadores irão avaliar no grupo de logs. Você será notificado aqui assim que for aprovada.',
    parse_mode: 'HTML'
   });
   return;
  }
  if (m.reply_to_message) {
   const replyText = (m.reply_to_message.text || m.reply_to_message.caption || '').trim();
   const parsed = parsePromoPayload(replyText, m.reply_to_message);
   if (!parsed.ok) {
    await api.sendMessage({
     chat_id: user,
     text: `⚠️ <b>A mensagem respondida não contém o formato correto:</b>\n\n${escHtml(parsed.error)}\n\n<b>Modelo exigido:</b>\n${promoTemplate()}`,
     parse_mode: 'HTML'
    });
    return;
   }
   await submitPromotion(m.from, parsed.data);
   await putState(`promo_draft:${user}`, null);
   await api.sendMessage({
    chat_id: user,
    text: '✅ <b>Sua solicitação de divulgação foi enviada com sucesso!</b>\n\nNossos moderadores irão avaliar no grupo de logs. Você será notificado aqui assim que for aprovada.',
    parse_mode: 'HTML'
   });
   return;
  }
  const draft = await state(`promo_draft:${user}`, null);
  if (draft) {
   await submitPromotion(m.from, draft);
   await putState(`promo_draft:${user}`, null);
   await api.sendMessage({
    chat_id: user,
    text: '✅ <b>Sua solicitação de divulgação foi enviada com sucesso!</b>\n\nNossos moderadores irão avaliar no grupo de logs. Você será notificado aqui assim que for aprovada.',
    parse_mode: 'HTML'
   });
   return;
  }
  await api.sendMessage({
   chat_id: user,
   text: `📢 <b>Divulgação no Canal</b>\n\nPara divulgar seu canal ou grupo no nosso canal exclusivo de divulgações, envie sua mensagem (em texto puro ou com foto, vídeo ou gif com legenda) no formato abaixo:\n\n${promoTemplate()}\n\n<i>Depois de enviar a mídia ou o texto, envie <b>/divulgar</b> para encaminhar para aprovação dos administradores!</i>`,
   parse_mode: 'HTML'
  });
  return;
 }
 const searchKey=`await_search:${user}`;
 const waitingSearch=await state(searchKey,false);
 if(waitingSearch&&!text.startsWith('/')){
  await putState(searchKey,null);
  const term=`%${text}%`;
  const results=await db.all("SELECT id,title,display,url FROM list_chats WHERE status='approved' AND (title LIKE :t OR display LIKE :t) LIMIT 10",{':t':term});
  const me=await api.getMe();
  const botLink=`tg://user?id=${me.id}`;
  if(!results.length){
   await screen(user,`private_menu:${user}`,`🔍 <a href="${botLink}"><b><i>Explorar Comunidades</i></b></a>\n\n<blockquote><b><i>Nenhuma comunidade encontrada para “${escHtml(text)}”.</i></b></blockquote>\n\n<b><i>Tente pesquisar por outro nicho ou termo.</i></b>`,[[{text:'🔍 Pesquisar novamente',callback_data:'nav:search'}],[{text:'🏠 Início',callback_data:'nav:home'}]]);
   return;
  }
  const rows=results.map(c=>[{text:'📢 '+truncateButtonText(c.display||c.title,45),url:c.url}]);
  rows.push([{text:'🔍 Nova pesquisa',callback_data:'nav:search'},{text:'🏠 Início',callback_data:'nav:home'}]);
  await screen(user,`private_menu:${user}`,`🔍 <a href="${botLink}"><b><i>Resultados da Busca</i></b></a>\n\n<blockquote><b><i>Encontramos ${results.length} comunidade(s) para “${escHtml(text)}”:</i></b></blockquote>\n\n<b><i>Toque em um dos botões abaixo para acessar:</i></b>`,rows);
  return;
 }
 if(cmd==='/admin'){
 if(!await isAdmin(user)){await screen(user,`private_menu:${user}`,'🚫 <b><i>Acesso Exclusivo</i></b>\n\n<blockquote><b><i>Este painel é restrito aos administradores do bot.</i></b></blockquote>',[[{text:'🏠 Início',callback_data:'nav:home'}]]);return;}
 await screen(user,`private_menu:${user}`,'⚙️ <b><i>Painel Administrativo</i></b>\n\n<blockquote><b><i>Gerencie comunidades parceiras, aprove novos participantes, edite o layout da lista e configure os disparos automáticos.</i></b></blockquote>',[[{text:'⚙️ Abrir painel admin',web_app:{url:APP_URL}}],[{text:'🏠 Início',callback_data:'nav:home'}]]);return;}
 if(cmd==='/start'||cmd==='/configurar'){
  const id=/^-\d+$/.test(args[0]||'')?Number(args[0]):null;
  if(Number.isSafeInteger(id)){const c=await getChat(id);if(c&&await chatAdmin(c.id,user)){await putState(sessionKey,null);await menu(c,user);return;}}
  if(args[0]==='divulgar'){
   await api.sendMessage({
    chat_id: user,
    text: `📢 <b>Divulgação no Canal</b>\n\nPara divulgar seu canal ou grupo no nosso canal exclusivo de divulgações, envie sua mensagem (em texto puro ou com foto, vídeo ou gif com legenda) no formato abaixo:\n\n${promoTemplate()}\n\n<i>Depois de enviar a mídia ou o texto, envie <b>/divulgar</b> para encaminhar para aprovação dos administradores!</i>`,
    parse_mode: 'HTML'
   });
   return;
  }
  await privateScreen(user,cmd==='/start'?'home':'chats',undefined,m.from);return;
 }
 if(cmd==='/perfil'||cmd==='/meuperfil'){await privateScreen(user,'profile',undefined,m.from);return;}
 if(cmd==='/horarios'||cmd==='/horario'){await privateScreen(user,'schedule',undefined,m.from);return;}
 if(cmd==='/canais'){await privateScreen(user,'channels',undefined,m.from);return;}
 if(cmd==='/grupos'){await privateScreen(user,'groups',undefined,m.from);return;}
 if(cmd==='/pesquisar'){await privateScreen(user,'search',undefined,m.from);return;}
 if(cmd==='/suporte'){await privateScreen(user,'support',undefined,m.from);return;}
 if(cmd==='/encerrar'||cmd==='/fecharticket'||cmd==='/fechar'){
  await api.sendMessage({ chat_id: user, text: 'ℹ️ Você não possui nenhum chamado de suporte ativo no momento.' });
  return;
 }
 if(cmd==='/link'){await privateScreen(user,'links',undefined,m.from);return;}
 if(cmd==='/ajuda'){await privateScreen(user,'help',undefined,m.from);return;}
 if(cmd==='/tutorial'||cmd==='/divulgarajuda'){await privateScreen(user,'divulgar',undefined,m.from);return;}
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
