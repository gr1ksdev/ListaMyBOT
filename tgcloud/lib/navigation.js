import { api, db } from 'sdk';
import { APP_URL, OWNER, escHtml } from './domain.js';
import { isAdmin, state, putState, config } from './store.js';
import { getActiveTicketForUser } from './support.js';
export { escHtml };

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
 if (view !== 'support') await putState(`await_support_msg:${user}`, null);

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

  text = `👋 Olá, ${nameLinked}!\n` +
   `<b><i>🚀 Pronto para impulsionar a sua comunidade para o próximo nível?</i></b>\n\n` +
   `<blockquote>✨ <b><i>Seja muito Bem-vindo! Conecte seus ${tgLink('Canais')} e ${tgLink('Grupos')} à maior rede de divulgação gratuita e conquiste membros reais todos os dias!</i></b> 📈</blockquote>\n\n` +
   `<b><i>💡 Explore as opções abaixo para gerenciar seus espaços ou tirar dúvidas no ${tgLink('Suporte')}. 🤝</i></b>`;

  const botUsername = me.username || 'ListaMyBOT';
  const botAddUrl = `https://t.me/${botUsername}?startgroup=true&admin=post_messages+edit_messages+delete_messages+pin_messages+invite_users`;

  rows.push([
   { text: '👤 Meu Perfil', callback_data: 'nav:profile' },
   { text: '⏰ Horários', callback_data: 'nav:schedule' }
  ]);
  rows.push([
   { text: 'Adicionar ao canal/grupo', url: botAddUrl, style: 'success' }
  ]);
  rows.push([
   { text: '❓ Ajuda', callback_data: 'nav:help' },
   { text: '💬 Suporte', callback_data: 'nav:support' }
  ]);
  rows.push([
   { text: '📢 Divulgar no Canal', callback_data: 'nav:divulgar' }
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
  const rawName = fromUser?.first_name || await state(`user_name:${user}`, '') || 'Amigo';

  text = `👤 <b>${tgLink('Central do Usuário')}</b>\n` +
   `━━━━━━━━━━━━━━━━━━\n` +
   `<blockquote><b>📊 Visão geral da conta</b>\n` +
   `┣ 🪪 Perfil: ${escHtml(rawName)}\n` +
   `┣ 🆔 ID: <code>${user}</code>\n` +
   `┗ 📅 Desde: ${regDate}</blockquote>\n` +
   `<blockquote><b>📡 Suas conexões</b>\n` +
   `┣ 📢 Canais vinculados: ${channelsCount}\n` +
   `┗ 💬 Grupos vinculados: ${groupsCount}</blockquote>\n` +
   `━━━━━━━━━━━━━━━━━━\n` +
   `⚙️ <i>Acesse o menu abaixo para administrar suas conexões e gerenciar suas comunidades.</i>`;

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
   ? `⭐️ Disparos a cada ${tgLink(sendSch.minutes + ' minutos')}.`
   : `⭐️ Postagens às ${formatScheduleTimes(sendSch.times, tgLink, true)}.`;

  const remText = remSch.mode === 'interval'
   ? `♻️ Limpeza a cada ${tgLink(remSch.minutes + ' minutos')}.`
   : `♻️ Remoções às ${formatScheduleTimes(remSch.times, tgLink, false)}.`;

  text = `⏰ ${tgLink('Horários')} • <b><i>Grade de Programação da Lista enviada ${tgLink('todos os dias')}</i></b>\n\n` +
   `<blockquote><b><i>${postText}</i></b></blockquote>\n` +
   `<blockquote><b><i>${remText}</i></b></blockquote>\n\n` +
   `<blockquote>📌 <b><i>A lista é disparada e fixada automaticamente em todos os Canais e Grupos parceiros.</i></b></blockquote>\n\n` +
   `<b><i>💡 Mantenha o bot como administrador com permissões ativas para garantir sua presença diária na lista! Juntos crescemos mais! 🚀💪</i></b>`;

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
  text = `📢 ${tgLink('Meus Canais')} • <b><i>Central de Canais</i></b>\n\n`;
  if (!list.length) {
   text += `<blockquote><b><i>Você ainda não possui nenhum canal conectado.</i></b></blockquote>\n\n` +
    `<b><i>Adicione o bot como administrador no seu canal com permissão para postar, editar e apagar mensagens e toque no botão abaixo para ativar:</i></b>`;
  } else {
   text += `<blockquote><b><i>Selecione um canal abaixo para acompanhar o status, categoria ou configurações:</i></b></blockquote>`;
   for (const c of list) {
    const icon = c.status === 'approved' ? '✅ ' : c.status === 'pending' ? '⏳ ' : '⚙️ ';
    rows.push([{ text: icon + c.title.slice(0, 45), callback_data: `cfg:${c.id}` }]);
   }
  }
  rows.push([{ text: '➕ Conectar canal', url: `https://t.me/${me.username}?startchannel&admin=post_messages+edit_messages+delete_messages` }]);
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
  text = `💬 ${tgLink('Meus Grupos')} • <b><i>Central de Grupos</i></b>\n\n`;
  if (!list.length) {
   text += `<blockquote><b><i>Você ainda não possui nenhum grupo conectado.</i></b></blockquote>\n\n` +
    `<b><i>Adicione o bot como administrador no seu grupo com permissão para fixar e apagar mensagens e toque no botão abaixo para ativar:</i></b>`;
  } else {
   text += `<blockquote><b><i>Selecione um grupo abaixo para acompanhar o status, categoria ou configurações:</i></b></blockquote>`;
   for (const c of list) {
    const icon = c.status === 'approved' ? '✅ ' : c.status === 'pending' ? '⏳ ' : '⚙️ ';
    rows.push([{ text: icon + c.title.slice(0, 45), callback_data: `cfg:${c.id}` }]);
   }
  }
  rows.push([{ text: '➕ Conectar grupo', url: `https://t.me/${me.username}?startgroup=participar&admin=delete_messages+pin_messages` }]);
  rows.push([
   { text: '👤 Meu Perfil', callback_data: 'nav:profile' },
   { text: '🏠 Início', callback_data: 'nav:home' }
  ]);
 } else if (view === 'search') {
  await putState(`await_search:${user}`, true);
  text = `🔍 ${tgLink('Explorar Comunidades')} • <b><i>Busca Inteligente</i></b>\n\n` +
   `<blockquote><b><i>Envie aqui no chat o nome, nicho ou palavra-chave da comunidade que procura.</i></b></blockquote>\n\n` +
   `<b><i>Ou toque no botão abaixo para voltar ao menu principal:</i></b>`;
  rows.push([
   { text: '🏠 Início', callback_data: 'nav:home' }
  ]);
 } else if (view === 'help') {
  text = `📚 ${tgLink('Central de Ajuda')} • <b><i>Como Impulsionar sua Audiência</i></b>\n\n` +
   `<blockquote><b>🚀 1. Participação na Lista Diária:\n` +
   `• Adicione o bot como administrador no seu Canal ou Grupo.\n` +
   `• Conceda as permissões requeridas e escolha a categoria.\n` +
   `• Sua comunidade participará de todos os disparos diários automaticamente!</b></blockquote>\n\n` +
   `<blockquote><b>💎 2. Divulgação em Destaque no Canal Oficial:\n` +
   `• Monte seu anúncio com foto, vídeo, texto atraente e links.\n` +
   `• Envie /divulgar para a nossa equipe de moderação avaliar.\n` +
   `• Ao ser aprovado, seu anúncio será publicado no canal oficial com botões interativos!</b></blockquote>\n\n` +
   `<b><i>Toque no botão abaixo para conferir o tutorial completo e modelo pronto:</i></b>`;
  rows.push([
   { text: '📢 Tutorial: Divulgar no Canal', callback_data: 'nav:divulgar' }
  ]);
  rows.push([
   { text: '👤 Meu Perfil', callback_data: 'nav:profile' },
   { text: '💬 Suporte', callback_data: 'nav:support' }
  ]);
  rows.push([
   { text: '🏠 Início', callback_data: 'nav:home' }
  ]);
 } else if (view === 'divulgar') {
  text = `📢 ${tgLink('Divulgação VIP')} • <b><i>Publicação no Canal Oficial</i></b>\n\n` +
   `<blockquote><b>✨ Destaque seu Canal ou Grupo para milhares de novos membros no nosso canal oficial de divulgação, com banner, descrição atraente e botões personalizados!</b></blockquote>\n\n` +
   `<b>📋 Guia Rápido de Envio:</b>\n` +
   `<blockquote><b>1️⃣ Preencha o modelo oficial:\n\n` +
   `🆔 -100xxxxxxxxxx\n` +
   `🌐 Nome do seu Canal/Grupo\n` +
   `📝 Breve descrição atrativa sobre a comunidade\n` +
   `📌 Categoria: #tags #tema\n` +
   `🔗 https://t.me/seulink\n\n` +
   `2️⃣ Envie aqui no privado (como texto ou legenda de foto/vídeo/gif).\n` +
   `3️⃣ O bot salvará o rascunho. Envie o comando /divulgar para confirmar.\n` +
   `4️⃣ Nossa equipe validará no grupo de moderação e publicará no canal oficial!</b></blockquote>\n\n` +
   `<b><i>🚀 Alcance novos públicos e expanda sua comunidade de forma exponencial!</i></b>`;
  rows.push([
   { text: '📚 Central de Ajuda', callback_data: 'nav:help' },
   { text: '💬 Suporte', callback_data: 'nav:support' }
  ]);
  rows.push([
   { text: '🏠 Início', callback_data: 'nav:home' }
  ]);
 } else if (view === 'support') {
  const activeTicket = await getActiveTicketForUser(user);
  if (activeTicket) {
   const isWaiting = activeTicket.status === 'pending';
   const dateStr = new Date(activeTicket.created).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
   if (isWaiting) {
    text = `⏳ ${tgLink('Solicitação em Andamento')} • <b>#${activeTicket.code}</b>\n\n` +
     `<b>Status:</b> ⏳ <b>Aguardando Administrador</b>\n` +
     `📅 <b>Enviado em:</b> ${dateStr}\n\n` +
     `💬 <b>Sua dúvida enviada:</b>\n<blockquote>${escHtml(activeTicket.initial_message)}</blockquote>\n\n` +
     `<blockquote><b><i>Por favor, aguarde um momento. Um de nossos administradores já vai te atender!</i></b></blockquote>`;
    rows.push([
     { text: '🛑 Cancelar Solicitação', callback_data: `ticket:user_close:${activeTicket.code}` }
    ]);
    rows.push([
     { text: '🏠 Início', callback_data: 'nav:home' }
    ]);
   } else {
    text = `🎫 ${tgLink('Atendimento em Andamento')} • <b>#${activeTicket.code}</b>\n\n` +
     `<b>Status:</b> 🟢 <b>Em Atendimento</b>\n` +
     (activeTicket.assigned_name ? `👨‍💼 <b>Atendente:</b> ${escHtml(activeTicket.assigned_name)}\n` : '') +
     `📅 <b>Iniciado em:</b> ${dateStr}\n\n` +
     `💬 <b>Dúvida inicial:</b>\n<blockquote>${escHtml(activeTicket.initial_message)}</blockquote>\n\n` +
     `<blockquote><b><i>Tudo o que você digitar aqui no chat será entregue diretamente ao atendente no tópico de suporte. Pode enviar suas mensagens!</i></b></blockquote>`;
    rows.push([
     { text: '🛑 Encerrar Atendimento', callback_data: `ticket:user_close:${activeTicket.code}` }
    ]);
    rows.push([
     { text: '🏠 Início', callback_data: 'nav:home' }
    ]);
   }
  } else {
   await putState(`await_support_msg:${user}`, true);
   text = `💬 ${tgLink('Suporte & Atendimento')} • <b><i>Fale Conosco</i></b>\n\n` +
    `<blockquote><b><i>Envie abaixo uma mensagem detalhando a sua dúvida ou o que você precisa.</i></b></blockquote>\n\n` +
    `<i>Nossa equipe de administradores já vai te atender!</i>\n\n` +
    `<i>Ou toque no botão abaixo para voltar:</i>`;
   rows.push([
    { text: '‹ Voltar ao Início', callback_data: 'nav:home' }
   ]);
  }
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
   ? `🔗 ${tgLink('Links Oficiais')} • <b><i>Gerenciamento de Links</i></b>\n\n<blockquote><b><i>Selecione o canal ou grupo cujo link você deseja consultar ou atualizar:</i></b></blockquote>`
   : `📋 ${tgLink('Minhas Comunidades')} • <b><i>Painel de Cadastros</i></b>\n\n<blockquote><b><i>Escolha uma comunidade para configurar ou acompanhar o status:</i></b></blockquote>`;
  if (!list.length) {
   text += '\n\n<blockquote><b><i>Nenhuma comunidade vinculada até o momento. Adicione o bot como administrador no seu canal ou grupo para começar!</i></b></blockquote>';
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
