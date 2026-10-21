import { api, db } from 'sdk';
import { config } from './store.js';
import { escHtml } from './domain.js';
import { ensureLogTopic } from './log_topics.js';

export async function initTicketsTable() {
  await db.run(`
    CREATE TABLE IF NOT EXISTS list_tickets (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL DEFAULT '',
      user_username TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      initial_message TEXT NOT NULL DEFAULT '',
      log_chat_id INTEGER,
      log_message_id INTEGER,
      thread_id INTEGER,
      topic_name TEXT NOT NULL DEFAULT '',
      assigned_to INTEGER,
      assigned_name TEXT NOT NULL DEFAULT '',
      created INTEGER NOT NULL,
      updated INTEGER NOT NULL,
      closed_at INTEGER,
      closed_by INTEGER
    )
  `);
}

export function generateTicketCode() {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TK-${rand}`;
}

export async function ensureSupportTopic(logChatId) {
  if (!logChatId) return { ok: false, error: 'Grupo de logs não configurado.' };
  return ensureLogTopic(logChatId, 'support');
}

export async function getActiveTicketForUser(userId) {
  await initTicketsTable();
  return db.get(
    "SELECT * FROM list_tickets WHERE user_id = :user_id AND status IN ('pending', 'open') ORDER BY created DESC LIMIT 1",
    { ':user_id': Number(userId) }
  );
}

export async function getTicketByCode(code) {
  await initTicketsTable();
  const raw = String(code || '').trim();
  const normalized = raw.startsWith('TK-') ? raw : `TK-${raw.replace(/^#?TK-?/i, '')}`.toUpperCase();
  return db.get(
    'SELECT * FROM list_tickets WHERE code = :code OR code = :norm LIMIT 1',
    { ':code': raw, ':norm': normalized }
  );
}

export async function getTicketByThreadId(threadId) {
  if (!threadId) return null;
  await initTicketsTable();
  return db.get(
    "SELECT * FROM list_tickets WHERE thread_id = :thread_id AND status = 'open' LIMIT 1",
    { ':thread_id': Number(threadId) }
  );
}

export async function createTicket(user, initialText) {
  await initTicketsTable();
  const existing = await getActiveTicketForUser(user.id);
  if (existing) {
    return { ok: false, existing: true, ticket: existing, error: 'Você já possui um ticket em andamento.' };
  }

  const cfg = await config();
  const logChat = cfg.settings.promoLogChat;
  if (!logChat) {
    return { ok: false, error: 'O grupo de logs ainda não foi configurado pelo administrador (/setlogs).' };
  }

  let supportTopicId = cfg.settings.supportLogTopic || null;
  if (!supportTopicId) {
    try {
      const topicRes = await ensureSupportTopic(logChat);
      if (topicRes.ok && topicRes.topicId) {
        supportTopicId = topicRes.topicId;
      }
    } catch (e) {
      console.warn('Erro ao criar tópico de suporte:', e);
    }
  }

  const code = generateTicketCode();
  const id = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();
  const userName = [user.first_name, user.last_name].filter(Boolean).join(' ') || (user.username ? `@${user.username}` : `Usuário ${user.id}`);
  const userUsername = user.username || '';

  const ticket = {
    id,
    code,
    user_id: user.id,
    user_name: userName,
    user_username: userUsername,
    status: 'pending',
    initial_message: initialText,
    log_chat_id: logChat,
    log_message_id: null,
    thread_id: null,
    topic_name: '',
    assigned_to: null,
    assigned_name: '',
    created: now,
    updated: now,
    closed_at: null,
    closed_by: null
  };

  const dateStr = new Date(now).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const triageText =
    `🎫 <b>Novo Chamado de Suporte #${code}</b>\n\n` +
    `👤 <b>Usuário:</b> <a href="tg://user?id=${user.id}">${escHtml(userName)}</a> (ID: <code>${user.id}</code>)\n` +
    (userUsername ? `🌐 <b>Username:</b> @${escHtml(userUsername)}\n` : '') +
    `📅 <b>Data:</b> ${dateStr}\n\n` +
    `💬 <b>Dúvida / Solicitação:</b>\n` +
    `<blockquote>${escHtml(initialText)}</blockquote>\n\n` +
    `<i>Clique no botão abaixo para responder. Um novo tópico exclusivo será criado para conversar com o usuário.</i>`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '💬 Responder / Atender', callback_data: `ticket:reply:${code}`, style: 'success' },
        { text: '❌ Encerrar', callback_data: `ticket:close:${code}`, style: 'danger' }
      ]
    ]
  };

  try {
    const sent = await api.sendMessage({
      chat_id: logChat,
      ...(supportTopicId ? { message_thread_id: supportTopicId } : {}),
      text: triageText,
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
    if (sent?.message_id) ticket.log_message_id = sent.message_id;
  } catch (err) {
    console.warn('Falha ao enviar ticket para o grupo de logs:', err);
  }

  await db.run(
    `INSERT INTO list_tickets (
      id, code, user_id, user_name, user_username, status, initial_message,
      log_chat_id, log_message_id, thread_id, topic_name, assigned_to, assigned_name,
      created, updated
    ) VALUES (
      :id, :code, :user_id, :user_name, :user_username, :status, :initial_message,
      :log_chat_id, :log_message_id, :thread_id, :topic_name, :assigned_to, :assigned_name,
      :created, :updated
    )`,
    {
      ':id': ticket.id,
      ':code': ticket.code,
      ':user_id': ticket.user_id,
      ':user_name': ticket.user_name,
      ':user_username': ticket.user_username,
      ':status': ticket.status,
      ':initial_message': ticket.initial_message,
      ':log_chat_id': ticket.log_chat_id,
      ':log_message_id': ticket.log_message_id,
      ':thread_id': ticket.thread_id,
      ':topic_name': ticket.topic_name,
      ':assigned_to': ticket.assigned_to,
      ':assigned_name': ticket.assigned_name,
      ':created': ticket.created,
      ':updated': ticket.updated
    }
  );

  return { ok: true, ticket };
}

export async function startTicketService(code, adminUser) {
  await initTicketsTable();
  const ticket = await getTicketByCode(code);
  if (!ticket) return { ok: false, error: 'Ticket não encontrado.' };
  if (ticket.status !== 'pending') {
    return { ok: false, alreadyStarted: true, error: 'Este chamado já está em atendimento ou foi finalizado.' };
  }

  const logChat = ticket.log_chat_id;
  const adminName = [adminUser.first_name, adminUser.last_name].filter(Boolean).join(' ') || (adminUser.username ? `@${adminUser.username}` : `Admin ${adminUser.id}`);
  const topicTitle = `🎫 Ticket #${code} - ${ticket.user_name || ticket.user_id}`.slice(0, 128);

  let newThreadId = null;
  try {
    const topic = await api.createForumTopic({
      chat_id: logChat,
      name: topicTitle,
      icon_color: 7322096
    });
    newThreadId = topic.message_thread_id;
  } catch (err) {
    if (err.parameters?.retry_after) {
      try {
        const waitMs = (err.parameters.retry_after + 1) * 1000;
        await new Promise(r => setTimeout(r, Math.min(waitMs, 5000)));
        const retryTopic = await api.createForumTopic({
          chat_id: logChat,
          name: topicTitle,
          icon_color: 7322096
        });
        newThreadId = retryTopic.message_thread_id;
      } catch (err2) {
        return { ok: false, error: 'Não foi possível gerar o tópico de atendimento: ' + (err2.description || err2.message) };
      }
    } else {
      console.warn('Falha ao criar tópico do ticket no fórum:', err);
      return { ok: false, error: 'Não foi possível gerar o tópico de atendimento: ' + (err.description || err.message) };
    }
  }

  const now = Date.now();
  await db.run(
    `UPDATE list_tickets SET
      status = 'open',
      thread_id = :thread_id,
      topic_name = :topic_name,
      assigned_to = :assigned_to,
      assigned_name = :assigned_name,
      updated = :updated
     WHERE code = :code`,
    {
      ':thread_id': newThreadId,
      ':topic_name': topicTitle,
      ':assigned_to': adminUser.id,
      ':assigned_name': adminName,
      ':updated': now,
      ':code': code
    }
  );

  ticket.status = 'open';
  ticket.thread_id = newThreadId;
  ticket.topic_name = topicTitle;
  ticket.assigned_to = adminUser.id;
  ticket.assigned_name = adminName;

  if (ticket.log_message_id && logChat) {
    const dateStr = new Date(ticket.created).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const updatedTriage =
      `🎫 <b>Chamado de Suporte #${code} — Em Atendimento</b>\n\n` +
      `👤 <b>Usuário:</b> <a href="tg://user?id=${ticket.user_id}">${escHtml(ticket.user_name)}</a> (ID: <code>${ticket.user_id}</code>)\n` +
      (ticket.user_username ? `🌐 <b>Username:</b> @${escHtml(ticket.user_username)}\n` : '') +
      `📅 <b>Abertura:</b> ${dateStr}\n\n` +
      `💬 <b>Dúvida inicial:</b>\n` +
      `<blockquote>${escHtml(ticket.initial_message)}</blockquote>\n\n` +
      `✅ <b>Atendente responsável:</b> <a href="tg://user?id=${adminUser.id}">${escHtml(adminName)}</a>\n` +
      `📌 <b>Tópico exclusivo gerado:</b> <i>${escHtml(topicTitle)}</i>`;

    try {
      await api.editMessageText({
        chat_id: logChat,
        message_id: ticket.log_message_id,
        text: updatedTriage,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🛑 Encerrar Atendimento', callback_data: `ticket:close:${code}`, style: 'danger' }
            ]
          ]
        }
      });
    } catch (e) {
      console.warn('Erro ao atualizar mensagem de triagem:', e);
    }
  }

  const topicGreeting =
    `🎫 <b>Atendimento Iniciado — Ticket #${code}</b>\n\n` +
    `👤 <b>Usuário:</b> <a href="tg://user?id=${ticket.user_id}">${escHtml(ticket.user_name)}</a> (ID: <code>${ticket.user_id}</code>)\n` +
    `👨‍💼 <b>Atendente:</b> <a href="tg://user?id=${adminUser.id}">${escHtml(adminName)}</a>\n\n` +
    `💬 <b>Dúvida inicial:</b>\n` +
    `<blockquote>${escHtml(ticket.initial_message)}</blockquote>\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 <b>Instruções:</b>\n` +
    `• Envie mensagens aqui neste tópico para responder ao usuário.\n` +
    `• O que o usuário enviar no privado do bot será postado aqui em tempo real.\n` +
    `• Para concluir o atendimento, clique no botão abaixo.`;

  try {
    await api.sendMessage({
      chat_id: logChat,
      message_thread_id: newThreadId,
      text: topicGreeting,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🛑 Encerrar Atendimento', callback_data: `ticket:close:${code}`, style: 'danger' }
          ]
        ]
      }
    });
  } catch (e) {
    console.warn('Erro ao enviar boas-vindas no novo tópico de suporte:', e);
  }

  try {
    await api.sendMessage({
      chat_id: ticket.user_id,
      text:
        `👨‍💼 <b>Atendimento Iniciado — Ticket #${code}</b>\n\n` +
        `Olá! O atendente <b>${escHtml(adminName)}</b> assumiu sua solicitação.\n\n` +
        `<blockquote>💬 <b>A partir de agora, tudo o que você digitar aqui no chat será entregue diretamente a ele no tópico exclusivo de suporte.</b></blockquote>\n\n` +
        `<i>Pode digitar suas mensagens normalmente!</i>`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🛑 Encerrar Atendimento', callback_data: `ticket:user_close:${code}`, style: 'danger' }
          ]
        ]
      }
    });
  } catch (e) {
    console.warn('Erro ao notificar usuário sobre início de atendimento:', e);
  }

  return { ok: true, ticket };
}

export async function closeTicket(code, closedByUser, reason = '') {
  await initTicketsTable();
  const ticket = await getTicketByCode(code);
  if (!ticket) return { ok: false, error: 'Ticket não encontrado.' };
  if (ticket.status === 'closed') {
    return { ok: false, alreadyClosed: true, error: 'Este chamado já foi encerrado.' };
  }

  const now = Date.now();
  const closerName = [closedByUser.first_name, closedByUser.last_name].filter(Boolean).join(' ') || (closedByUser.username ? `@${closedByUser.username}` : `Usuário ${closedByUser.id}`);
  const isAdminCloser = closedByUser.id !== ticket.user_id;

  await db.run(
    `UPDATE list_tickets SET
      status = 'closed',
      closed_at = :closed_at,
      closed_by = :closed_by,
      updated = :updated
     WHERE code = :code`,
    {
      ':closed_at': now,
      ':closed_by': closedByUser.id,
      ':updated': now,
      ':code': code
    }
  );

  ticket.status = 'closed';
  ticket.closed_at = now;
  ticket.closed_by = closedByUser.id;

  const dateStr = new Date(now).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  if (ticket.thread_id && ticket.log_chat_id) {
    try {
      await api.sendMessage({
        chat_id: ticket.log_chat_id,
        message_thread_id: ticket.thread_id,
        text:
          `🛑 <b>Atendimento Encerrado — Ticket #${code}</b>\n\n` +
          `🔒 <b>Finalizado por:</b> <a href="tg://user?id=${closedByUser.id}">${escHtml(closerName)}</a> (${isAdminCloser ? 'Atendente' : 'Usuário'})\n` +
          `📅 <b>Data:</b> ${dateStr}` +
          (reason ? `\n📝 <b>Motivo:</b> ${escHtml(reason)}` : ''),
        parse_mode: 'HTML'
      });
    } catch {}

    try {
      await api.closeForumTopic({
        chat_id: ticket.log_chat_id,
        message_thread_id: ticket.thread_id
      });
    } catch (e) {
      console.warn('Não foi possível fechar o tópico do fórum:', e);
    }
  }

  if (ticket.log_message_id && ticket.log_chat_id) {
    try {
      await api.editMessageText({
        chat_id: ticket.log_chat_id,
        message_id: ticket.log_message_id,
        text:
          `🎫 <b>Chamado de Suporte #${code} — ENCERRADO</b>\n\n` +
          `👤 <b>Usuário:</b> <a href="tg://user?id=${ticket.user_id}">${escHtml(ticket.user_name)}</a> (ID: <code>${ticket.user_id}</code>)\n` +
          (ticket.user_username ? `🌐 <b>Username:</b> @${escHtml(ticket.user_username)}\n` : '') +
          `🛑 <b>Encerrado por:</b> <a href="tg://user?id=${closedByUser.id}">${escHtml(closerName)}</a> (${isAdminCloser ? 'Atendente' : 'Usuário'})\n` +
          `📅 <b>Data de Encerramento:</b> ${dateStr}\n` +
          (reason ? `📝 <b>Motivo:</b> ${escHtml(reason)}\n` : '') +
          `\n💬 <b>Dúvida original:</b>\n<blockquote>${escHtml(ticket.initial_message)}</blockquote>\n\n` +
          `<i>O tópico exclusivo deste chamado foi fechado. Caso precise retomar o atendimento, clique no botão abaixo para reabrir.</i>`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Reabrir Atendimento', callback_data: `ticket:reopen:${code}`, style: 'primary' }
            ]
          ]
        }
      });
    } catch (e) {
      console.warn('Erro ao atualizar mensagem de triagem no encerramento:', e);
    }
  }

  try {
    await api.sendMessage({
      chat_id: ticket.user_id,
      text:
        `🛑 <b>Atendimento Finalizado — Ticket #${code}</b>\n\n` +
        `O seu chamado de suporte foi <b>encerrado com sucesso</b>.\n\n` +
        `Agradecemos pelo contato! Se precisar de mais alguma ajuda futuramente, basta acessar o menu de <b>Suporte</b> a qualquer momento.`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🏠 Menu Principal', callback_data: 'nav:home' }
          ]
        ]
      }
    });
  } catch (e) {
    console.warn('Erro ao notificar usuário sobre encerramento:', e);
  }

  return { ok: true, ticket };
}

export async function reopenTicket(code, reopenerUser) {
  await initTicketsTable();
  const ticket = await getTicketByCode(code);
  if (!ticket) return { ok: false, error: 'Ticket não encontrado.' };
  if (ticket.status === 'open') {
    return { ok: false, alreadyOpen: true, error: 'Este chamado já está em atendimento.' };
  }
  if (ticket.status === 'pending') {
    return { ok: false, error: 'Este chamado está aguardando atendimento.' };
  }

  const activeTicket = await getActiveTicketForUser(ticket.user_id);
  if (activeTicket && activeTicket.code !== ticket.code) {
    return { ok: false, error: `O usuário já possui outro chamado em andamento (#${activeTicket.code}).` };
  }

  const cfg = await config();
  const logChat = ticket.log_chat_id || cfg.settings.promoLogChat;
  if (!logChat) {
    return { ok: false, error: 'Grupo de logs não configurado.' };
  }

  const isUserReopen = reopenerUser.id === ticket.user_id;
  const reopenerName = [reopenerUser.first_name, reopenerUser.last_name].filter(Boolean).join(' ') || (reopenerUser.username ? `@${reopenerUser.username}` : `Usuário ${reopenerUser.id}`);

  let activeThreadId = ticket.thread_id || null;

  // Tenta reabrir o tópico existente caso esteja registrado
  if (activeThreadId) {
    try {
      await api.reopenForumTopic({
        chat_id: logChat,
        message_thread_id: activeThreadId
      });
    } catch (err) {
      console.warn('Não foi possível reabrir tópico existente (tópico pode ter sido excluído no Telegram):', err);
      activeThreadId = null; // Caso o tópico não exista mais, cria outro!
    }
  }

  // Caso o tópico não exista, cria um novo tópico
  if (!activeThreadId) {
    const topicTitle = `🎫 Ticket #${code} - ${ticket.user_name || ticket.user_id}`.slice(0, 128);
    try {
      const topic = await api.createForumTopic({
        chat_id: logChat,
        name: topicTitle,
        icon_color: 7322096
      });
      activeThreadId = topic.message_thread_id;
    } catch (err) {
      if (err.parameters?.retry_after) {
        try {
          const waitMs = (err.parameters.retry_after + 1) * 1000;
          await new Promise(r => setTimeout(r, Math.min(waitMs, 5000)));
          const retryTopic = await api.createForumTopic({
            chat_id: logChat,
            name: topicTitle,
            icon_color: 7322096
          });
          activeThreadId = retryTopic.message_thread_id;
        } catch (err2) {
          return { ok: false, error: 'Não foi possível gerar novo tópico: ' + (err2.description || err2.message) };
        }
      } else {
        console.warn('Falha ao criar novo tópico para chamado reaberto:', err);
        return { ok: false, error: 'Não foi possível gerar novo tópico: ' + (err.description || err.message) };
      }
    }
  }

  const now = Date.now();
  const assignedTo = isUserReopen ? (ticket.assigned_to || null) : reopenerUser.id;
  const assignedName = isUserReopen ? (ticket.assigned_name || '') : reopenerName;

  await db.run(
    `UPDATE list_tickets SET
      status = 'open',
      thread_id = :thread_id,
      assigned_to = :assigned_to,
      assigned_name = :assigned_name,
      closed_at = NULL,
      closed_by = NULL,
      updated = :updated
     WHERE code = :code`,
    {
      ':thread_id': activeThreadId,
      ':assigned_to': assignedTo,
      ':assigned_name': assignedName,
      ':updated': now,
      ':code': code
    }
  );

  ticket.status = 'open';
  ticket.thread_id = activeThreadId;
  ticket.assigned_to = assignedTo;
  ticket.assigned_name = assignedName;
  ticket.closed_at = null;
  ticket.closed_by = null;
  ticket.updated = now;

  const topicGreeting =
    `🎫 <b>Atendimento REABERTO — Ticket #${code}</b>\n\n` +
    `👤 <b>Usuário:</b> <a href="tg://user?id=${ticket.user_id}">${escHtml(ticket.user_name)}</a> (ID: <code>${ticket.user_id}</code>)\n` +
    (isUserReopen
      ? `🔄 <b>Reaberto por:</b> Usuário\n` + (assignedName ? `👨‍💼 <b>Atendente anterior:</b> ${escHtml(assignedName)}\n` : '')
      : `🔄 <b>Reaberto por:</b> <a href="tg://user?id=${reopenerUser.id}">${escHtml(reopenerName)}</a>\n`) +
    `\n💬 <b>Dúvida original:</b>\n` +
    `<blockquote>${escHtml(ticket.initial_message)}</blockquote>\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 <i>O chamado foi reaberto. Todas as mensagens enviadas aqui serão entregues no privado do usuário em tempo real.</i>`;

  try {
    await api.sendMessage({
      chat_id: logChat,
      message_thread_id: activeThreadId,
      text: topicGreeting,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🛑 Encerrar Atendimento', callback_data: `ticket:close:${code}`, style: 'danger' }
          ]
        ]
      }
    });
  } catch (e) {
    console.warn('Erro ao enviar boas-vindas no tópico reaberto:', e);
  }

  if (ticket.log_message_id && logChat) {
    const updatedTriage =
      `🎫 <b>Chamado de Suporte #${code} — REABERTO (Em Atendimento)</b>\n\n` +
      `👤 <b>Usuário:</b> <a href="tg://user?id=${ticket.user_id}">${escHtml(ticket.user_name)}</a> (ID: <code>${ticket.user_id}</code>)\n` +
      (ticket.user_username ? `🌐 <b>Username:</b> @${escHtml(ticket.user_username)}\n` : '') +
      `🔄 <b>Reaberto por:</b> <a href="tg://user?id=${reopenerUser.id}">${escHtml(reopenerName)}</a>\n` +
      (assignedName ? `👨‍💼 <b>Atendente:</b> ${escHtml(assignedName)}\n` : '') +
      `📌 <b>Tópico:</b> <i>Ticket #${code}</i>\n\n` +
      `💬 <b>Dúvida original:</b>\n<blockquote>${escHtml(ticket.initial_message)}</blockquote>`;

    try {
      await api.editMessageText({
        chat_id: logChat,
        message_id: ticket.log_message_id,
        text: updatedTriage,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🛑 Encerrar Atendimento', callback_data: `ticket:close:${code}`, style: 'danger' }
            ]
          ]
        }
      });
    } catch (e) {
      console.warn('Erro ao atualizar mensagem de triagem na reabertura:', e);
    }
  }

  try {
    await api.sendMessage({
      chat_id: ticket.user_id,
      text:
        `🎫 <b>Atendimento Reaberto — Ticket #${code}</b>\n\n` +
        (isUserReopen
          ? `Seu chamado foi <b>reaberto com sucesso</b>!\n\n<blockquote>💬 <b>Pode digitar suas mensagens aqui no chat. Nossa equipe irá te responder diretamente no tópico de suporte.</b></blockquote>`
          : `Seu chamado foi reaberto pelo atendente <b>${escHtml(reopenerName)}</b>.\n\n<blockquote>💬 <b>Pode digitar suas mensagens aqui no chat normalmente!</b></blockquote>`),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🛑 Encerrar Atendimento', callback_data: `ticket:user_close:${code}`, style: 'danger' }
          ]
        ]
      }
    });
  } catch (e) {
    console.warn('Erro ao notificar usuário sobre reabertura:', e);
  }

  return { ok: true, ticket };
}

export async function relayUserMessage(ticket, m) {
  if (!ticket.thread_id || !ticket.log_chat_id) return false;
  const userName = [m.from?.first_name, m.from?.last_name].filter(Boolean).join(' ') || ticket.user_name || (m.from?.username ? `@${m.from.username}` : `Usuário ${ticket.user_id}`);

  if (m.text) {
    try {
      await api.sendMessage({
        chat_id: ticket.log_chat_id,
        message_thread_id: ticket.thread_id,
        text: `💬 <b>[${escHtml(userName)}]:</b>\n\n${escHtml(m.text)}`,
        parse_mode: 'HTML'
      });
      return true;
    } catch (err) {
      console.warn('Erro ao repassar texto do usuário:', err);
      return false;
    }
  }

  const isMedia = Boolean(m.photo || m.video || m.document || m.voice || m.audio || m.animation);
  if (isMedia) {
    try {
      const caption = m.caption
        ? `💬 <b>[${escHtml(userName)}]:</b>\n\n${escHtml(m.caption)}`
        : `💬 <b>[${escHtml(userName)}]</b>`;
      await api.copyMessage({
        chat_id: ticket.log_chat_id,
        message_thread_id: ticket.thread_id,
        from_chat_id: m.chat.id,
        message_id: m.message_id,
        caption,
        parse_mode: 'HTML'
      });
      return true;
    } catch (err) {
      console.warn('Erro ao copiar mídia do usuário:', err);
    }
  }

  try {
    if (m.sticker) {
      try {
        await api.sendMessage({
          chat_id: ticket.log_chat_id,
          message_thread_id: ticket.thread_id,
          text: `💬 <b>[${escHtml(userName)}]:</b> <i>(Figurinha)</i>`,
          parse_mode: 'HTML'
        });
      } catch {}
    }
    await api.copyMessage({
      chat_id: ticket.log_chat_id,
      from_chat_id: m.chat.id,
      message_id: m.message_id,
      message_thread_id: ticket.thread_id
    });
    return true;
  } catch (err) {
    const text = m.text || m.caption || '';
    if (text) {
      await api.sendMessage({
        chat_id: ticket.log_chat_id,
        message_thread_id: ticket.thread_id,
        text: `💬 <b>[${escHtml(userName)}]:</b>\n\n${escHtml(text)}`,
        parse_mode: 'HTML'
      });
      return true;
    }
    return false;
  }
}

export async function relayAdminMessage(ticket, m) {
  if (!ticket.user_id) return false;
  const adminName = [m.from?.first_name, m.from?.last_name].filter(Boolean).join(' ') || (m.from?.username ? `@${m.from.username}` : 'Suporte');

  if (m.text) {
    try {
      await api.sendMessage({
        chat_id: ticket.user_id,
        text: `💬 <b>[${escHtml(adminName)}]:</b>\n\n${escHtml(m.text)}`,
        parse_mode: 'HTML'
      });
      return true;
    } catch (err) {
      console.warn('Erro ao repassar resposta do admin:', err);
      return false;
    }
  }

  const isMedia = Boolean(m.photo || m.video || m.document || m.voice || m.audio || m.animation);
  if (isMedia) {
    try {
      const caption = m.caption
        ? `💬 <b>[${escHtml(adminName)}]:</b>\n\n${escHtml(m.caption)}`
        : `💬 <b>[${escHtml(adminName)}]</b>`;
      await api.copyMessage({
        chat_id: ticket.user_id,
        from_chat_id: m.chat.id,
        message_id: m.message_id,
        caption,
        parse_mode: 'HTML'
      });
      return true;
    } catch (err) {
      console.warn('Erro ao copiar mídia do admin:', err);
    }
  }

  try {
    if (m.sticker) {
      try {
        await api.sendMessage({
          chat_id: ticket.user_id,
          text: `💬 <b>[${escHtml(adminName)}]:</b> <i>(Figurinha)</i>`,
          parse_mode: 'HTML'
        });
      } catch {}
    }
    await api.copyMessage({
      chat_id: ticket.user_id,
      from_chat_id: m.chat.id,
      message_id: m.message_id
    });
    return true;
  } catch (err) {
    const text = m.text || m.caption || '';
    if (text) {
      await api.sendMessage({
        chat_id: ticket.user_id,
        text: `💬 <b>[${escHtml(adminName)}]:</b>\n\n${escHtml(text)}`,
        parse_mode: 'HTML'
      });
      return true;
    }
    return false;
  }
}
