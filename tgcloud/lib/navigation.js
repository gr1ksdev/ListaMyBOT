import { api, db } from 'sdk';
import { APP_URL, OWNER } from './domain.js';
import { isAdmin, state, putState, config } from './store.js';

export function escHtml(str) {
 return String(str ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
}

function formatRegDate(timestamp) {
 const d = new Date(timestamp || Date.now());
 return d.toLocaleDateString('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
 });
}

function formatScheduleTimes(times, tgLink, includeHrsInLink = false) {
 if (!Array.isArray(times) || !times.length) return tgLink('A definir');
 const clean = times.map(t => t.replace(/^0(\d:)/, '$1'));
 if (clean.length === 1) {
  return includeHrsInLink ? tgLink(clean[0] + ' Hrs') : `${tgLink(clean[0])} Hrs`;
 }
 const allExceptLast = clean.slice(0, -1).map(t => tgLink(t)).join(', ');
 const last = clean.at(-1);
 return includeHrsInLink
  ? `${allExceptLast} e ${tgLink(last + ' Hrs')}`
  : `${allExceptLast} e ${tgLink(last)} Hrs`;
}

async function getUserRegDate(userId) {
 const regKey = `user_reg:${userId}`;
 let reg = await state(regKey, null);
 if (!reg) {
  const first = await db.get('SELECT MIN(updated) AS min_up FROM list_chats WHERE owner=:id', { ':id': userId });
  reg = first?.min_up || Date.now();
  await putState(regKey, reg);
 }
 return formatRegDate(reg);
}

export async function screen(target, key, text, rows, message, parseMode = 'HTML') {
 const previous = message?.message_id || await state(key, 0);
 const options = {
  chat_id: target,
  text,
  reply_markup: { inline_keyboard: rows },
  link_preview_options: { is_disabled: true }
 };
 if (parseMode) options.parse_mode = parseMode;
 if (previous) {
  try {
   await api.editMessageText({ ...options, message_id: previous });
   await putState(key, previous);
   return { message_id: previous };
  } catch (e) {
   if (/message is not modified/i.test(e.description || e.message || '')) return { message_id: previous };
   if (!/message to edit not found|message can.t be edited|message_id_invalid/i.test(e.description || e.message || '')) throw e;
  }
 }
 const sent = await api.sendMessage(options);
 await putState(key, sent.message_id);
 return sent;
}

export async function privateScreen(user, view = 'home', message, fromUser) {
 await putState(`await_link:${user}`, null);
 if (view !== 'search') await putState(`await_search:${user}`, null);

 const me = await api.getMe();
 const botLink = `tg://user?id=${me.id}`;
 const tgLink = text => `<a href="${botLink}">${text}</a>`;

 if (fromUser?.first_name) {
  await putState(`user_name:${user}`, fromUser.first_name);
 }

 const rows = [];
 let text;

 if (view === 'home') {
  const rawName = fromUser?.first_name || await state(`user_name:${user}`, '') || 'Amigo';
  const nameLinked = tgLink(escHtml(rawName));

  text = `👋 Oiê, ${nameLinked} !\n` +
   `<b><i>😃 Junte-se à nossa Lista de ${tgLink('divulgação')} totalmente gratuita e conquiste ${tgLink('novos membros')}!</i></b>\n\n` +
   `<blockquote>🚀 <b><i>Seja muito Bem-vindo! Conecte seus ${tgLink('Canais')} e ${tgLink('Grupos')} à maior rede de crescimento e impulsione sua audiência todos os dias!</i></b> ✨</blockquote>\n\n` +
   `<b><i>❓ Caso tenha dúvidas, estou aqui no ${tgLink('Suporte')} para te ajudar! 🤝</i></b>`;

  rows.push([
   { text: '👤 Meu Perfil', callback_data: 'nav:profile' },
   { text: '🔍 Pesquisar', callback_data: 'nav:search' }
  ]);
  rows.push([
   { text: '⏰ Horários', callback_data: 'nav:schedule' }
  ]);
  rows.push([
   { text: '❓ Ajuda', callback_data: 'nav:help' },
   { text: '💬 Suporte', callback_data: 'nav:support' }
  ]);
  if (await isAdmin(user)) {
   rows.push([{ text: '⚙️ Abrir painel admin', web_app: { url: APP_URL } }]);
  }
 } else if (view === 'profile') {
  const all = await db.all('SELECT id, title, type, status FROM list_chats WHERE owner=:id ORDER BY updated DESC LIMIT 50', { ':id': user });
  const list = [];
  for (const c of all) {
   try {
    const m = await api.getChatMember({ chat_id: c.id, user_id: user });
    if (['administrator', 'creator'].includes(m.status)) list.push(c);
   } catch {}
  }
  const channelsCount = list.filter(c => c.type === 'channel').length;
  const groupsCount = list.filter(c => c.type === 'group' || c.type === 'supergroup').length;
  const regDate = await getUserRegDate(user);

  text = `👽 ${tgLink('Meu Perfil')} • <b><i>Aqui você tem acesso às suas informações, bem como aos seus ${tgLink('Grupos')} e ${tgLink('Canais')}</i></b>.\n\n` +
   `<blockquote><b>👤 Meus Registros\n` +
   ` ┣ 📢 Canais • ${channelsCount}\n` +
   ` ┗ 💬 Grupos • ${groupsCount}\n` +
   `📅 Registro • ${regDate}\n` +
   `</b></blockquote>\n\n` +
   `<b><i>✨ Você pode usar os botões abaixo para gerenciar seus grupos e canais.</i></b>`;

  rows.push([
   { text: '📢 Canais', callback_data: 'nav:channels' },
   { text: '💬 Grupos', callback_data: 'nav:groups' }
  ]);
  rows.push([
   { text: '🏠 Início', callback_data: 'nav:home' }
  ]);
 } else if (view === 'schedule') {
  const { settings } = await config();
  const sendSch = settings.schedule || { enabled: false, mode: 'fixed', times: ['08:00', '20:00'], minutes: 60 };
  const remSch = settings.removalSchedule || { enabled: false, mode: 'fixed', times: ['06:00', '18:00'], minutes: 60 };

  const postText = sendSch.mode === 'interval'
   ? `⭐️ Postagens a cada ${tgLink(sendSch.minutes + ' minutos')}.`
   : `⭐️ Postagens às ${formatScheduleTimes(sendSch.times, tgLink, true)}.`;

  const remText = remSch.mode === 'interval'
   ? `♻️ Remoções a cada ${tgLink(remSch.minutes + ' minutos')}.`
   : `♻️ Remoções às ${formatScheduleTimes(remSch.times, tgLink, false)}.`;

  text = `<b><i>⏰ ${tgLink('Horários')} • A Lista é enviada e fixada nos Grupos e Canais cadastrados ${tgLink('todos os dias.')}</i></b>\n\n` +
   `<blockquote><b><i>${postText}</i></b></blockquote>\n` +
   `<blockquote><b><i>${remText}</i></b></blockquote>\n\n` +
   `<b><i>💡 Mantenha o bot sempre como administrador com permissões ativas para garantir sua presença na lista diária! Juntos no crescimento da sua comunidade! 🚀💪</i></b>`;

  rows.push([
   { text: '🏠 Início', callback_data: 'nav:home' }
  ]);
 } else if (view === 'channels') {
  const all = await db.all("SELECT id, title, type, status FROM list_chats WHERE owner=:id AND type='channel' ORDER BY updated DESC LIMIT 40", { ':id': user });
  const list = [];
  for (const c of all) {
   try {
    const m = await api.getChatMember({ chat_id: c.id, user_id: user });
    if (['administrator', 'creator'].includes(m.status)) list.push(c);
   } catch {}
  }
  text = `📢 ${tgLink('Meus Canais')} • <b><i>Gerenciamento de Canais</i></b>\n\n`;
  if (!list.length) {
   text += `<blockquote><b><i>Você ainda não possui nenhum canal cadastrado.</i></b></blockquote>\n\n` +
    `<b><i>Adicione o bot como administrador no seu canal com permissão para postar, editar e apagar mensagens e toque no botão abaixo para cadastrar:</i></b>`;
  } else {
   text += `<blockquote><b><i>Toque em um canal para configurar link, categoria ou acompanhar o status:</i></b></blockquote>`;
   for (const c of list) {
    const icon = c.status === 'approved' ? '✅ ' : c.status === 'pending' ? '⏳ ' : '⚙️ ';
    rows.push([{ text: icon + c.title.slice(0, 45), callback_data: `cfg:${c.id}` }]);
   }
  }
  rows.push([{ text: '➕ Adicionar canal', url: `https://t.me/${me.username}?startchannel&admin=post_messages+edit_messages+delete_messages` }]);
  rows.push([
   { text: '👤 Meu Perfil', callback_data: 'nav:profile' },
   { text: '🏠 Início', callback_data: 'nav:home' }
  ]);
 } else if (view === 'groups') {
  const all = await db.all("SELECT id, title, type, status FROM list_chats WHERE owner=:id AND type IN ('group', 'supergroup') ORDER BY updated DESC LIMIT 40", { ':id': user });
  const list = [];
  for (const c of all) {
   try {
    const m = await api.getChatMember({ chat_id: c.id, user_id: user });
    if (['administrator', 'creator'].includes(m.status)) list.push(c);
   } catch {}
  }
  text = `💬 ${tgLink('Meus Grupos')} • <b><i>Gerenciamento de Grupos</i></b>\n\n`;
  if (!list.length) {
   text += `<blockquote><b><i>Você ainda não possui nenhum grupo cadastrado.</i></b></blockquote>\n\n` +
    `<b><i>Adicione o bot como administrador no seu grupo com permissão para fixar e apagar mensagens e toque no botão abaixo para cadastrar:</i></b>`;
  } else {
   text += `<blockquote><b><i>Toque em um grupo para configurar link, categoria ou acompanhar o status:</i></b></blockquote>`;
   for (const c of list) {
    const icon = c.status === 'approved' ? '✅ ' : c.status === 'pending' ? '⏳ ' : '⚙️ ';
    rows.push([{ text: icon + c.title.slice(0, 45), callback_data: `cfg:${c.id}` }]);
   }
  }
  rows.push([{ text: '➕ Adicionar grupo', url: `https://t.me/${me.username}?startgroup=participar&admin=delete_messages+pin_messages` }]);
  rows.push([
   { text: '👤 Meu Perfil', callback_data: 'nav:profile' },
   { text: '🏠 Início', callback_data: 'nav:home' }
  ]);
 } else if (view === 'search') {
  await putState(`await_search:${user}`, true);
  text = `🔍 ${tgLink('Pesquisar')} • <b><i>Encontre canais e grupos na lista</i></b>\n\n` +
   `<blockquote><b><i>Envie aqui no chat o nome ou palavra-chave do canal ou grupo que deseja buscar.</i></b></blockquote>\n\n` +
   `<b><i>Ou toque no botão abaixo para voltar ao início:</i></b>`;
  rows.push([
   { text: '🏠 Início', callback_data: 'nav:home' }
  ]);
 } else if (view === 'help') {
  text = `❓ ${tgLink('Ajuda')} • <b><i>Como Participar da Lista</i></b>\n\n` +
   `<blockquote><b><i>1️⃣ Adicione o bot como administrador no seu Canal ou Grupo.\n` +
   `2️⃣ Conceda as permissões necessárias (enviar, apagar e fixar mensagens; no canal, editar mensagens).\n` +
   `3️⃣ Escolha a categoria no menu do próprio chat e envie o cadastro.</i></b></blockquote>\n\n` +
   `<b><i>✨ Pronto! Seu canal ou grupo participará das listas diárias de divulgação e receberá novos membros!</i></b>`;
  rows.push([
   { text: '👤 Meu Perfil', callback_data: 'nav:profile' },
   { text: '💬 Suporte', callback_data: 'nav:support' }
  ]);
  rows.push([
   { text: '🏠 Início', callback_data: 'nav:home' }
  ]);
 } else if (view === 'support') {
  text = `🤝 ${tgLink('Suporte')} • <b><i>Central de Atendimento</i></b>\n\n` +
   `<blockquote><b><i>❓ Precisa de suporte, tem dúvidas ou encontrou algum problema?\n` +
   `Estamos aqui para te ajudar no que for preciso!</i></b></blockquote>\n\n` +
   `<b><i>Toque no botão abaixo para conversar diretamente com o suporte:</i></b>`;
  rows.push([
   { text: '💬 Falar com Suporte', url: `tg://user?id=${OWNER}` }
  ]);
  rows.push([
   { text: '🏠 Início', callback_data: 'nav:home' }
  ]);
 } else {
  const all = await db.all('SELECT id, title, status FROM list_chats WHERE owner=:id ORDER BY updated DESC LIMIT 40', { ':id': user });
  const list = [];
  for (const c of all) {
   try {
    const m = await api.getChatMember({ chat_id: c.id, user_id: user });
    if (['administrator', 'creator'].includes(m.status)) list.push(c);
   } catch {}
  }
  text = view === 'links'
   ? `🔗 ${tgLink('Links dos seus canais e grupos')} • <b><i>Configuração de Links</i></b>\n\n<blockquote><b><i>Escolha qual link deseja consultar ou editar:</i></b></blockquote>`
   : `📋 ${tgLink('Meus canais')} e grupos • <b><i>Painel de Cadastros</i></b>\n\n<blockquote><b><i>Escolha um cadastro para configurar ou acompanhar:</i></b></blockquote>`;
  if (!list.length) {
   text += '\n\n<blockquote><b><i>Nenhum cadastro vinculado ainda. Adicione o bot como administrador no seu canal ou grupo e toque em Continuar no privado.</i></b></blockquote>';
  }
  for (const c of list) {
   rows.push([{
    text: (c.status === 'approved' ? '✅ ' : c.status === 'pending' ? '⏳ ' : '⚙️ ') + c.title.slice(0, 50),
    callback_data: `${view === 'links' ? 'link' : 'cfg'}:${c.id}`
   }]);
  }
  rows.push([{ text: '🏠 Início', callback_data: 'nav:home' }]);
 }

 return screen(user, `private_menu:${user}`, text, rows, message);
}
