import { api, db } from 'sdk';
import { APP_URL, CATEGORIES } from './domain.js';
import { config } from './store.js';
import { escHtml } from './navigation.js';

export async function ensureChatsTopic(logChatId) {
  if (!logChatId) return { ok: false, error: 'Grupo de logs não configurado.' };
  try {
    const chat = await api.getChat({ chat_id: logChatId });
    if (!chat.is_forum) {
      return { ok: false, isForum: false, error: 'O grupo não tem tópicos ativados (não é um supergrupo com fórum).' };
    }
    const me = await api.getMe();
    const member = await api.getChatMember({ chat_id: logChatId, user_id: me.id });
    if (member.status !== 'creator' && !member.can_manage_topics) {
      return { ok: false, isForum: true, error: 'O bot precisa da permissão "Gerenciar tópicos" (can_manage_topics) como administrador.' };
    }
    let topic;
    try {
      topic = await api.createForumTopic({
        chat_id: logChatId,
        name: 'Cadastros pendentes',
        icon_color: 9367192
      });
    } catch (createErr) {
      if (createErr.parameters?.retry_after) {
        const waitMs = (createErr.parameters.retry_after + 1) * 1000;
        await new Promise(r => setTimeout(r, Math.min(waitMs, 5000)));
        topic = await api.createForumTopic({
          chat_id: logChatId,
          name: 'Cadastros pendentes',
          icon_color: 9367192
        });
      } else {
        throw createErr;
      }
    }
    return { ok: true, isForum: true, topicId: topic.message_thread_id, name: topic.name };
  } catch (err) {
    return { ok: false, error: err.description || err.message };
  }
}

export function formatChatSubmissionMessage(c, memberCount, actor, status = 'pending', reviewer = null) {
  const isChannel = c.type === 'channel';
  const typeName = isChannel ? '📢 Canal' : '💬 Grupo';
  const catName = (c.category >= 0 && CATEGORIES[c.category]) ? CATEGORIES[c.category] : 'Geral';
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
          { text: '📊 Abrir no Painel', url: panelUrl }
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
        { text: '📊 Abrir no Painel', url: panelUrl }
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
        cfg.settings.chatsLogTopic = topicId;
        await db.run('UPDATE list_settings SET value=:v WHERE id=1', { ':v': JSON.stringify(cfg.settings) });
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

  const text = formatChatSubmissionMessage(c, memberCount, actor, 'pending');
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
    return sent;
  } catch (err) {
    console.warn('Falha ao enviar solicitação para o canal de logs:', err);
    return null;
  }
}
