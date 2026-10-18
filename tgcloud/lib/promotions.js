import { api, db } from 'sdk';
import { validLink } from './domain.js';
import { config, isAdmin } from './store.js';
import { chatAdmin } from './registration.js';
import { escHtml } from './navigation.js';

export async function updatePromoConfig(partial) {
  const c = await config();
  Object.assign(c.settings, partial);
  await db.run('UPDATE list_settings SET value=:v WHERE id=1', { ':v': JSON.stringify(c.settings) });
  return c.settings;
}

export function parsePromoPayload(rawText, media = null) {
  if (!rawText || typeof rawText !== 'string') {
    return { ok: false, error: 'O payload de divulgação está vazio.' };
  }

  let text = rawText.trim();
  if (text.startsWith('/divulgar')) {
    text = text.replace(/^\/divulgar(?:@[A-Za-z0-9_]+)?\s*/i, '').trim();
  }

  // ID do Canal/Grupo (🆔)
  const idMatch = text.match(/(?:🆔|ID):\s*([^\n\r]+)/i) || text.match(/🆔\s*([^\n\r]+)/i);
  let chatId = '';
  let type = 'channel';
  if (idMatch) {
    const rawId = idMatch[1].trim();
    const numMatch = rawId.match(/-?\d{5,}/);
    if (numMatch) {
      chatId = numMatch[0];
    } else if (rawId.startsWith('@')) {
      chatId = rawId.split(/\s+/)[0];
    } else {
      chatId = rawId;
    }

    const rawLower = rawId.toLowerCase();
    if (rawLower.includes('grupo') || rawLower.includes('group')) {
      type = 'group';
    } else if (rawLower.includes('canal') || rawLower.includes('channel')) {
      type = 'channel';
    }
  }

  // Name (🌐)
  const nameMatch = text.match(/(?:🌐|Nome|Canal|Grupo):\s*([^\n\r]+)/i) || text.match(/🌐\s*([^\n\r]+)/i);
  const title = nameMatch ? nameMatch[1].trim() : '';

  // Category / Tags (📌)
  const catMatch = text.match(/(?:📌|Categoria):\s*([^\n\r]+)/i) || text.match(/📌\s*([^\n\r]+)/i);
  const category = catMatch ? catMatch[1].trim() : '';

  // Link (🔗)
  const linkMatch = text.match(/(?:🔗|Link):\s*([^\s\n\r]+)/i) ||
                    text.match(/🔗\s*([^\s\n\r]+)/i) ||
                    text.match(/https:\/\/t\.me\/(?:[A-Za-z][A-Za-z0-9_]{3,}|\+[A-Za-z0-9_-]+|joinchat\/[A-Za-z0-9_-]+)/i);
  let url = linkMatch ? (linkMatch[1]?.trim() || linkMatch[0]?.trim()) : '';
  if (url && !url.startsWith('http')) {
    url = 'https://' + url.replace(/^@/, 't.me/');
  }

  // Description (📝 or text lines between Name and Category/Link)
  let description = '';
  const descMatch = text.match(/(?:📝|Descri[çc][ãa]o):\s*([\s\S]+?)(?=\n*(?:📌|🔗|$))/i) ||
                    text.match(/📝\s*([\s\S]+?)(?=\n*(?:📌|🔗|$))/i);
  if (descMatch) {
    description = descMatch[1].trim();
  } else {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const nameIdx = lines.findIndex(l => /^(?:🌐|Nome)/i.test(l));
    const catIdx = lines.findIndex(l => /^(?:📌|Categoria)/i.test(l));
    if (nameIdx !== -1 && catIdx !== -1 && catIdx > nameIdx + 1) {
      description = lines.slice(nameIdx + 1, catIdx).join('\n').trim();
    }
  }

  const missing = [];
  if (!idMatch || !chatId) missing.push('🆔 ID do Canal ou Grupo (ex: 🆔 -100xxxxxxxxxx)');
  if (!title) missing.push('🌐 Nome do Canal/Grupo');
  if (!description) missing.push('📝 Descrição breve');
  if (!category) missing.push('📌 Categoria: #TAGS');
  if (!url) missing.push('🔗 Link do Telegram');

  if (missing.length > 0) {
    return {
      ok: false,
      error: `Campos obrigatórios não encontrados:\n• ${missing.join('\n• ')}`,
      missing
    };
  }

  if (!validLink(url)) {
    return {
      ok: false,
      error: 'O link precisa ser um link válido do Telegram (ex: https://t.me/seucanal ou https://t.me/+convite).'
    };
  }

  let mediaType = '';
  let mediaFileId = '';
  if (media) {
    if (Array.isArray(media.photo) && media.photo.length > 0) {
      mediaType = 'photo';
      mediaFileId = media.photo[media.photo.length - 1].file_id;
    } else if (media.video) {
      mediaType = 'video';
      mediaFileId = media.video.file_id;
    } else if (media.animation) {
      mediaType = 'animation';
      mediaFileId = media.animation.file_id;
    } else if (media.document && (media.document.mime_type?.startsWith('image/') || media.document.mime_type?.startsWith('video/'))) {
      mediaType = media.document.mime_type?.startsWith('video/') ? 'video' : 'photo';
      mediaFileId = media.document.file_id;
    }
  }

  return {
    ok: true,
    data: {
      chat_id: chatId,
      type,
      title,
      description,
      category,
      url,
      media_type: mediaType,
      media_file_id: mediaFileId
    }
  };
}

export function isPayloadLike(text) {
  if (!text || typeof text !== 'string') return false;
  return (text.includes('🆔') || text.includes('Tipo:')) &&
         (text.includes('🌐') || text.includes('Nome:')) &&
         (text.includes('🔗') || text.includes('Link:') || text.includes('t.me/'));
}

export async function ensurePromoTopic(logChatId) {
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
    const topic = await api.createForumTopic({
      chat_id: logChatId,
      name: 'Divulgações pendentes',
      icon_color: 7322096
    });
    return { ok: true, isForum: true, topicId: topic.message_thread_id, name: topic.name };
  } catch (err) {
    return { ok: false, error: err.description || err.message };
  }
}

export async function submitPromotion(user, data) {
  const promoId = `promo_${Date.now()}_${user.id}`;
  const userName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || `User ${user.id}`;
  const now = Date.now();

  const c = await config();
  const logChat = c.settings.promoLogChat;
  let topicId = c.settings.promoLogTopic || null;

  let logMessageId = null;

  if (logChat) {
    // If forum enabled but topic missing, try to create it
    if (!topicId) {
      try {
        const topicRes = await ensurePromoTopic(logChat);
        if (topicRes.ok && topicRes.topicId) {
          topicId = topicRes.topicId;
          c.settings.promoLogTopic = topicId;
          await db.run('UPDATE list_settings SET value=:v WHERE id=1', { ':v': JSON.stringify(c.settings) });
        }
      } catch (e) {
        console.warn('Topic auto-creation notice:', e);
      }
    }

    const logText = formatPromoLogMessage({
      id: promoId,
      user_id: user.id,
      user_name: userName,
      ...data
    }, 'pending');

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '✅ Aprovar', callback_data: `promo:approve:${promoId}` },
          { text: '❌ Desaprovar', callback_data: `promo:reject:${promoId}` }
        ]
      ]
    };

    const sendParams = {
      chat_id: logChat,
      ...(topicId ? { message_thread_id: topicId } : {}),
      reply_markup: replyMarkup
    };

    try {
      let sent;
      if (data.media_type === 'photo' && data.media_file_id) {
        sent = await api.sendPhoto({ ...sendParams, photo: data.media_file_id, caption: logText, parse_mode: 'HTML' });
      } else if (data.media_type === 'video' && data.media_file_id) {
        sent = await api.sendVideo({ ...sendParams, video: data.media_file_id, caption: logText, parse_mode: 'HTML' });
      } else if (data.media_type === 'animation' && data.media_file_id) {
        sent = await api.sendAnimation({ ...sendParams, animation: data.media_file_id, caption: logText, parse_mode: 'HTML' });
      } else {
        sent = await api.sendMessage({ ...sendParams, text: logText, parse_mode: 'HTML', disable_web_page_preview: true });
      }
      if (sent?.message_id) {
        logMessageId = sent.message_id;
      }
    } catch (err) {
      console.warn('Failed to send promo to log group:', err);
    }
  }

  await db.run(
    `INSERT INTO list_promotions (
      id, user_id, user_name, chat_id, type, title, description, category, url,
      media_type, media_file_id, status, log_chat_id, log_message_id, created
    ) VALUES (
      :id, :user_id, :user_name, :chat_id, :type, :title, :description, :category, :url,
      :media_type, :media_file_id, 'pending', :log_chat, :log_msg, :now
    )`,
    {
      ':id': promoId,
      ':user_id': user.id,
      ':user_name': userName,
      ':chat_id': data.chat_id || '',
      ':type': data.type || 'channel',
      ':title': data.title,
      ':description': data.description,
      ':category': data.category,
      ':url': data.url,
      ':media_type': data.media_type || '',
      ':media_file_id': data.media_file_id || '',
      ':log_chat': logChat || null,
      ':log_msg': logMessageId || null,
      ':now': now
    }
  );

  return { id: promoId, logMessageId, ...data };
}

export async function approvePromotion(promoId, reviewer) {
  const promo = await db.get('SELECT * FROM list_promotions WHERE id=:id', { ':id': promoId });
  if (!promo) throw Error('Divulgação não encontrada.');
  if (promo.status !== 'pending') throw Error(`Esta divulgação já foi ${promo.status === 'approved' ? 'aprovada' : 'recusada'}.`);

  const c = await config();
  const channel = c.settings.promoChannel;
  if (!channel) throw Error('Canal de divulgação não configurado. Use /setcanal no canal desejado.');

  const me = await api.getMe();
  const botUsername = me.username || 'ListaMyBOT';

  // Format channel publication
  const channelText = formatPromoChannelMessage(promo);
  const channelMarkup = {
    inline_keyboard: [
      [{ text: promo.title.slice(0, 50), url: promo.url }],
      [{ text: `🤖 Divulgue no @${botUsername}`, url: `https://t.me/${botUsername}?start=divulgar` }]
    ]
  };

  const channelChatId = /^-?\d+$/.test(channel) ? Number(channel) : channel;
  let channelMsgId = null;

  try {
    let sent;
    if (promo.media_type === 'photo' && promo.media_file_id) {
      sent = await api.sendPhoto({ chat_id: channelChatId, photo: promo.media_file_id, caption: channelText, parse_mode: 'HTML', reply_markup: channelMarkup });
    } else if (promo.media_type === 'video' && promo.media_file_id) {
      sent = await api.sendVideo({ chat_id: channelChatId, video: promo.media_file_id, caption: channelText, parse_mode: 'HTML', reply_markup: channelMarkup });
    } else if (promo.media_type === 'animation' && promo.media_file_id) {
      sent = await api.sendAnimation({ chat_id: channelChatId, animation: promo.media_file_id, caption: channelText, parse_mode: 'HTML', reply_markup: channelMarkup });
    } else {
      sent = await api.sendMessage({ chat_id: channelChatId, text: channelText, parse_mode: 'HTML', reply_markup: channelMarkup, disable_web_page_preview: false });
    }
    channelMsgId = sent?.message_id || null;
  } catch (err) {
    throw Error(`Erro ao postar no canal de divulgação: ${err.description || err.message}`);
  }

  const now = Date.now();
  await db.run(
    'UPDATE list_promotions SET status=\'approved\', channel_message_id=:ch_msg, reviewed_by=:r_by, reviewed_at=:r_at WHERE id=:id',
    { ':ch_msg': channelMsgId, ':r_by': reviewer.id, ':r_at': now, ':id': promoId }
  );

  // Update log message in topic
  if (promo.log_chat_id && promo.log_message_id) {
    const updatedLogText = formatPromoLogMessage(promo, 'approved', reviewer);
    try {
      if (promo.media_type) {
        await api.editMessageCaption({
          chat_id: promo.log_chat_id,
          message_id: promo.log_message_id,
          caption: updatedLogText,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [] }
        });
      } else {
        await api.editMessageText({
          chat_id: promo.log_chat_id,
          message_id: promo.log_message_id,
          text: updatedLogText,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [] }
        });
      }
    } catch (err) {
      console.warn('Failed to update log message:', err);
    }
  }

  // Notify author in private
  try {
    await api.sendMessage({
      chat_id: promo.user_id,
      text: `🎉 <b>Sua divulgação foi aprovada!</b>\n\nO seu ${promo.type === 'channel' ? 'canal' : 'grupo'} <b>${escHtml(promo.title)}</b> foi publicado com sucesso no nosso canal de divulgações.`,
      parse_mode: 'HTML'
    });
  } catch {
    // Author might have blocked bot
  }

  return { ok: true, channelMessageId: channelMsgId };
}

export async function rejectPromotion(promoId, reviewer) {
  const promo = await db.get('SELECT * FROM list_promotions WHERE id=:id', { ':id': promoId });
  if (!promo) throw Error('Divulgação não encontrada.');
  if (promo.status !== 'pending') throw Error(`Esta divulgação já foi ${promo.status === 'approved' ? 'aprovada' : 'recusada'}.`);

  const now = Date.now();
  await db.run(
    'UPDATE list_promotions SET status=\'rejected\', reviewed_by=:r_by, reviewed_at=:r_at WHERE id=:id',
    { ':r_by': reviewer.id, ':r_at': now, ':id': promoId }
  );

  // Update log message in topic
  if (promo.log_chat_id && promo.log_message_id) {
    const updatedLogText = formatPromoLogMessage(promo, 'rejected', reviewer);
    try {
      if (promo.media_type) {
        await api.editMessageCaption({
          chat_id: promo.log_chat_id,
          message_id: promo.log_message_id,
          caption: updatedLogText,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [] }
        });
      } else {
        await api.editMessageText({
          chat_id: promo.log_chat_id,
          message_id: promo.log_message_id,
          text: updatedLogText,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [] }
        });
      }
    } catch (err) {
      console.warn('Failed to update log message:', err);
    }
  }

  // Notify author in private
  try {
    await api.sendMessage({
      chat_id: promo.user_id,
      text: `❌ <b>Sua divulgação não foi aprovada.</b>\n\nA divulgação de <b>${escHtml(promo.title)}</b> foi recusada pelos moderadores. Verifique se as informações, tags e link estão corretos antes de reenviar.`,
      parse_mode: 'HTML'
    });
  } catch {
    // Author might have blocked bot
  }

  return { ok: true };
}

export function formatPromoLogMessage(promo, status = 'pending', reviewer = null) {
  const reviewerName = reviewer ? ([reviewer.first_name, reviewer.last_name].filter(Boolean).join(' ') || reviewer.username || `Admin ${reviewer.id}`) : '';
  const statusHeader =
    status === 'approved'
      ? `✅ <b>DIVULGAÇÃO APROVADA</b> por <a href="tg://user?id=${reviewer?.id}">${escHtml(reviewerName)}</a>\n━━━━━━━━━━━━━━━━━━\n`
      : status === 'rejected'
      ? `❌ <b>DIVULGAÇÃO RECUSADA</b> por <a href="tg://user?id=${reviewer?.id}">${escHtml(reviewerName)}</a>\n━━━━━━━━━━━━━━━━━━\n`
      : '📢 <b>Nova Divulgação Pendente</b>\n━━━━━━━━━━━━━━━━━━\n';

  const typeTag = promo.type === 'group' ? '💬 Grupo' : '📢 Canal';
  const chatDisplay = promo.chat_id ? `<code>${escHtml(promo.chat_id)}</code> (${typeTag})` : typeTag;

  return `${statusHeader}👤 <b>Autor:</b> <a href="tg://user?id=${promo.user_id}">${escHtml(promo.user_name || 'Usuário')}</a> (<code>${promo.user_id}</code>)
🆔 <b>ID C/G:</b> ${chatDisplay}
🌐 <b>Nome:</b> <b>${escHtml(promo.title)}</b>
📝 <b>Descrição:</b>
<blockquote>${escHtml(promo.description)}</blockquote>
📌 <b>Categoria / Tags:</b> ${escHtml(promo.category)}
🔗 <b>Link:</b> ${escHtml(promo.url)}${promo.media_type ? `\n🖼 <b>Mídia:</b> ${promo.media_type.toUpperCase()}` : ''}
━━━━━━━━━━━━━━━━━━
${status === 'pending' ? '<i>Avalie a divulgação abaixo:</i>' : '<i>Status finalizado.</i>'}`;
}

export function formatPromoChannelMessage(promo) {
  return `<b>${escHtml(promo.title)}</b>

<blockquote>${escHtml(promo.description)}</blockquote>

${escHtml(promo.category)}

${promo.url}`;
}

export function promoTemplate() {
  return `<code>🆔 -100xxxxxxxxxx
🌐 Nome do seu Canal
📝 Breve descrição sobre o canal
📌 Categoria: #tags #tema
🔗 https://t.me/seulink</code>`;
}
