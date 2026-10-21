import { api, db } from 'sdk';
import { APP_URL, CATEGORIES, resolveCategories } from './domain.js';
import { config, putState, state } from './store.js';
import { escHtml } from './navigation.js';
import { ensureLogTopic } from './log_topics.js';

export async function ensureChatsTopic(logChatId) {
  if (!logChatId) return { ok: false, error: 'Grupo de logs não configurado.' };
  return ensureLogTopic(logChatId, 'chats');
}

export function formatChatSubmissionMessage(c, memberCount, actor, status = 'pending', reviewer = null, categories = CATEGORIES) {
  const isChannel = c.type === 'channel';
  const typeName = isChannel ? '📢 Canal' : '💬 Grupo';
  const catName = (c.category >= 0 && categories[c.category]) ? categories[c.category] : 'Geral';
  const membersFormatted = Number.isSafeInteger(Number(memberCount)) && Number(memberCount) >= 0
    ? Number(memberCount).toLocaleString('pt-BR')
    : 'Indisponível';

  const actorId = actor?.id || (Number.isSafeInteger(actor) ? actor : c.owner);
  const actorName = actor?.first_name
    ? [actor.first_name, actor.last_name].filter(Boolean).join(' ')
    : (actor?.username ? `@${actor.username}` : (actorId ? `Usuário ${actorId}` : 'Não identificado'));
  const actorMention = actorId ? `<a href="tg://user?id=${actorId}">${escHtml(actorName)}</a> (ID: <code>${actorId}</code>)` : 'Desconhecido';

  let header = '📋 <b>Nova Solicitação de Entrada na Lista</b>';
  let footer = '<blockquote><b><i>⏳ Aguardando avaliação dos administradores.</i></b></blockquote>';

  if (status === 'approved') {
    header = '✅ <b>Solicitação APROVADA na Lista</b>';
    const reviewerName = reviewer
      ? ([reviewer.first_name, reviewer.last_name].filter(Boolean).join(' ') || reviewer.username || `Admin ${reviewer.id}`)
      : 'Administrador';
    const reviewerMention = reviewer?.id ? `<a href="tg://user?id=${reviewer.id}">${escHtml(reviewerName)}</a>` : escHtml(reviewerName);
    footer = `<blockquote><b>✅ Aprovado por:</b> ${reviewerMention}\n` +
             `📅 <b>Data:</b> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</blockquote>`;
  } else if (status === 'rejected') {
    header = '❌ <b>Solicitação REJEITADA na Lista</b>';
    const reviewerName = reviewer
      ? ([reviewer.first_name, reviewer.last_name].filter(Boolean).join(' ') || reviewer.username || `Admin ${reviewer.id}`)
      : 'Administrador';
    const reviewerMention = reviewer?.id ? `<a href="tg://user?id=${reviewer.id}">${escHtml(reviewerName)}</a>` : escHtml(reviewerName);
    footer = `<blockquote><b>❌ Rejeitado por:</b> ${reviewerMention}\n` +
             `📅 <b>Data:</b> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</blockquote>`;
  }

  return `${header}\n\n` +
         `🆔 <b>ID:</b> <code>${c.id}</code> (${typeName})\n` +
         `🌐 <b>Nome:</b> <b>${escHtml(c.title)}</b>\n` +
         `🔗 <b>Link:</b> ${escHtml(c.url || 'Sem link informado')}\n` +
         `👥 <b>Membros:</b> ${membersFormatted}\n` +
         `👤 <b>Cadastrado por:</b> ${actorMention}\n` +
         `📌 <b>Categoria:</b> ${escHtml(catName)}\n\n` +
         `${footer}`;
}

export function chatSubmissionKeyboard(chatId, status = 'pending') {
  const panelUrl = `${APP_URL}?tab=chats&chat=${chatId}`;
  if (status === 'approved') {
    return {
      inline_keyboard: [
        [
          { text: '❌ Alterar para Rejeitado', callback_data: `chat_adm:reject:${chatId}`, style: 'danger' }
        ],
        [
          { text: '📊 Abrir no Painel', web_app: { url: panelUrl } }
        ]
      ]
    };
  }
  if (status === 'rejected') {
    return {
      inline_keyboard: [
        [
          { text: '✅ Alterar para Aprovado', callback_data: `chat_adm:approve:${chatId}`, style: 'success' }
        ],
        [
          { text: '📊 Abrir no Painel', url: panelUrl }
        ]
      ]
    };
  }
  return {
    inline_keyboard: [
      [
        { text: '✅ Aprovar', callback_data: `chat_adm:approve:${chatId}`, style: 'success' },
        { text: '❌ Rejeitar', callback_data: `chat_adm:reject:${chatId}`, style: 'danger' }
      ],
      [
        { text: '📊 Abrir no Painel', web_app: { url: panelUrl} }
      ]
    ]
  };
}

export async function sendChatSubmissionLog(c, actor) {
  const cfg = await config();
  const logChat = cfg.settings.promoLogChat;
  if (!logChat) return null;

  let topicId = cfg.settings.chatsLogTopic || null;

  if (!topicId) {
    try {
      const topicRes = await ensureChatsTopic(logChat);
      if (topicRes.ok && topicRes.topicId) {
        topicId = topicRes.topicId;
      }
    } catch (e) {
      console.warn('Erro ao criar tópico de cadastros pendentes:', e);
    }
  }

  let memberCount = 0;
  try {
    memberCount = await api.getChatMemberCount({ chat_id: c.id });
  } catch (e) {
    console.warn('Falha ao obter quantidade de membros para o log:', e);
  }

  const text = formatChatSubmissionMessage(c, memberCount, actor, 'pending', null, resolveCategories(cfg.settings));
  const replyMarkup = chatSubmissionKeyboard(c.id, 'pending');

  try {
    const sent = await api.sendMessage({
      chat_id: logChat,
      ...(topicId ? { message_thread_id: topicId } : {}),
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: replyMarkup
    });
    try {
      await putState(`chat_log:${c.id}`, {
        chat_id: logChat,
        message_id: sent.message_id,
        thread_id: topicId || null
      });
    } catch {}
    return sent;
  } catch (err) {
    console.warn('Falha ao enviar solicitação para o canal de logs:', err);
    return null;
  }
}

// Notify the owner when a moderator acts outside the Telegram log message.
// Failures here must never undo or block the moderation itself.
export async function notifyChatOwner(c, status, reason = '', reviewer = null) {
  if (!c?.owner || Number(c.owner) <= 0) return;
  const title = escHtml(c.display || c.title || 'seu canal/grupo');
  let text;
  if (status === 'approved') {
    text = `🎉 <b>Boas notícias!</b>\n\nSeu canal/grupo <b>${title}</b> foi aprovado e agora faz parte da nossa lista oficial!`;
  } else if (status === 'rejected') {
    text = `⚠️ <b>Aviso sobre seu cadastro:</b>\n\nA solicitação de entrada de <b>${title}</b> na lista foi recusada pelos moderadores.` +
      (reason ? `\n\n<b>Motivo:</b> ${escHtml(reason)}` : '');
  } else if (status === 'pending') {
    text = `⏸ <b>Seu cadastro voltou para análise.</b>\n\nO canal/grupo <b>${title}</b> foi desaprovado e está aguardando uma nova revisão dos moderadores.`;
  } else {
    return;
  }
  try {
    await api.sendMessage({ chat_id: c.owner, text, parse_mode: 'HTML' });
  } catch {}
}

// Update the original pending-log message when moderation happens in the
// Mini App. Old logs without a stored location simply skip this step.
export async function updateChatSubmissionLog(c, status, reviewer = null, reason = '') {
  let location;
  try {
    location = await state(`chat_log:${c.id}`, null);
  } catch {
    return;
  }
  if (!location?.chat_id || !location?.message_id) return;

  let memberCount = 0;
  try {
    memberCount = await api.getChatMemberCount({ chat_id: c.id });
  } catch {}

  let text = formatChatSubmissionMessage(c, memberCount, c.owner, status, reviewer, resolveCategories((await config()).settings));
  if (status === 'rejected' && reason) text += `\n\n<b>Motivo:</b> ${escHtml(reason)}`;
  try {
    await api.editMessageText({
      chat_id: location.chat_id,
      message_id: location.message_id,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: chatSubmissionKeyboard(c.id, status)
    });
  } catch {}
}
