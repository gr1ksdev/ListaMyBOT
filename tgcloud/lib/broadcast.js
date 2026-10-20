import { api, db } from 'sdk';
import { escHtml } from './domain.js';

export async function initUsersTable() {
  await db.run(`
    CREATE TABLE IF NOT EXISTS list_users (
      id INTEGER PRIMARY KEY,
      first_name TEXT NOT NULL DEFAULT '',
      username TEXT NOT NULL DEFAULT '',
      created INTEGER NOT NULL DEFAULT 0,
      updated INTEGER NOT NULL DEFAULT 0
    )
  `);
}

async function upsertUser(from) {
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ') || '';
  const username = from.username || '';
  const now = Date.now();
  await db.run(`
    INSERT INTO list_users (id, first_name, username, created, updated)
    VALUES (:id, :first_name, :username, :created, :updated)
    ON CONFLICT(id) DO UPDATE SET
      first_name = excluded.first_name,
      username = excluded.username,
      updated = excluded.updated
  `, {
    ':id': from.id,
    ':first_name': name,
    ':username': username,
    ':created': now,
    ':updated': now
  });
}

export async function trackUser(from) {
  if (!from || !from.id || from.is_bot) return;
  try {
    await upsertUser(from);
  } catch (err) {
    // The table is declared in schema.js, but old deployments may not have run
    // the migration yet. Create it lazily once, then retry this update.
    if (/no such table/i.test(String(err?.message || ''))) {
      try {
        await initUsersTable();
        await upsertUser(from);
        return;
      } catch (retryError) {
        err = retryError;
      }
    }
    // Tracking is auxiliary and must never stop the bot from answering updates.
    console.warn('Falha ao registrar usuário para transmissões:', err);
  }
}

export async function getAllUsers() {
  await initUsersTable();
  const rows = await db.all(`
    SELECT DISTINCT id FROM (
      SELECT id FROM list_users WHERE id > 0
      UNION
      SELECT owner AS id FROM list_chats WHERE owner > 0
      UNION
      SELECT user_id AS id FROM list_promotions WHERE user_id > 0
      UNION
      SELECT user_id AS id FROM list_tickets WHERE user_id > 0
      UNION
      SELECT CAST(SUBSTR(id, 14) AS INTEGER) AS id FROM list_runtime WHERE id LIKE 'private_menu:%' AND CAST(SUBSTR(id, 14) AS INTEGER) > 0
    )
  `);
  return rows.map(r => Number(r.id)).filter(id => Number.isSafeInteger(id) && id > 0);
}

export async function getBroadcastTargets(scope, specificTarget = null) {
  if (scope === 'single') {
    if (!specificTarget || !specificTarget.id) return [];
    return [{
      id: specificTarget.id,
      thread_id: specificTarget.thread_id || null,
      type: specificTarget.id > 0 ? 'user' : 'chat',
      title: String(specificTarget.id)
    }];
  }

  if (scope === 'canal') {
    const chats = await db.all("SELECT id, title, type FROM list_chats WHERE type = 'channel'");
    return chats.map(c => ({ id: Number(c.id), type: 'channel', title: c.title }));
  }

  if (scope === 'grupo') {
    const chats = await db.all("SELECT id, title, type FROM list_chats WHERE type IN ('group', 'supergroup')");
    return chats.map(c => ({ id: Number(c.id), type: c.type, title: c.title }));
  }

  if (scope === 'lista') {
    const chats = await db.all("SELECT id, title, type FROM list_chats WHERE status = 'approved'");
    return chats.map(c => ({ id: Number(c.id), type: c.type, title: c.title }));
  }

  if (scope === 'todos') {
    const [chats, userIds] = await Promise.all([
      db.all("SELECT id, title, type FROM list_chats"),
      getAllUsers()
    ]);
    const seen = new Set();
    const targets = [];
    for (const c of chats) {
      const id = Number(c.id);
      if (!seen.has(id)) {
        seen.add(id);
        targets.push({ id, type: c.type, title: c.title });
      }
    }
    for (const uId of userIds) {
      if (!seen.has(uId)) {
        seen.add(uId);
        targets.push({ id: uId, type: 'user', title: `Usuário ${uId}` });
      }
    }
    return targets;
  }

  return [];
}

export function parseSendCommand(cmd, args, rawText = '') {
  const lower = (cmd || '').toLowerCase();
  if (!lower.startsWith('/send')) return { isSend: false };

  let scope = null;
  let targetId = null;
  let targetThreadId = null;

  if (lower === '/send') {
    const firstArg = args[0] || '';
    if (!firstArg || firstArg === 'help' || firstArg === 'ajuda') {
      return { isSend: true, isHelp: true };
    }
    const cleanArg = firstArg.toLowerCase();
    if (['todos', 'all'].includes(cleanArg)) {
      scope = 'todos';
      args.shift();
    } else if (['canal', 'canais', 'channel', 'channels'].includes(cleanArg)) {
      scope = 'canal';
      args.shift();
    } else if (['grupo', 'grupos', 'group', 'groups'].includes(cleanArg)) {
      scope = 'grupo';
      args.shift();
    } else if (['lista', 'list'].includes(cleanArg)) {
      scope = 'lista';
      args.shift();
    } else if (/^-?\d+(:\d+)?$/.test(firstArg)) {
      scope = 'single';
      if (firstArg.includes(':')) {
        const [c, t] = firstArg.split(':');
        targetId = Number(c);
        targetThreadId = Number(t);
      } else {
        targetId = Number(firstArg);
      }
      args.shift();
    } else {
      return { isSend: true, isInvalid: true, rawArg: firstArg };
    }
  } else if (lower.startsWith('/send_') || lower.startsWith('/send-')) {
    const sub = lower.slice(6);
    if (['todos', 'all'].includes(sub)) {
      scope = 'todos';
    } else if (['canal', 'canais', 'channel', 'channels'].includes(sub)) {
      scope = 'canal';
    } else if (['grupo', 'grupos', 'group', 'groups'].includes(sub)) {
      scope = 'grupo';
    } else if (['lista', 'list'].includes(sub)) {
      scope = 'lista';
    } else if (/^-?\d+(:\d+)?$/.test(sub)) {
      scope = 'single';
      if (sub.includes(':')) {
        const [c, t] = sub.split(':');
        targetId = Number(c);
        targetThreadId = Number(t);
      } else {
        targetId = Number(sub);
      }
    } else {
      return { isSend: true, isInvalid: true, rawArg: sub };
    }
  } else if (['/sendtodos', '/sendall'].includes(lower)) {
    scope = 'todos';
  } else if (['/sendcanal', '/sendcanais'].includes(lower)) {
    scope = 'canal';
  } else if (['/sendgrupo', '/sendgrupos'].includes(lower)) {
    scope = 'grupo';
  } else if (['/sendlista'].includes(lower)) {
    scope = 'lista';
  } else {
    return { isSend: false };
  }

  const extraText = args.join(' ').trim();
  return {
    isSend: true,
    scope,
    targetId,
    targetThreadId,
    extraText
  };
}

export async function sendContentToChat({ targetId, targetThreadId, fromChatId, replyMsgId, extraText }) {
  if (replyMsgId) {
    return api.copyMessage({
      chat_id: targetId,
      ...(targetThreadId ? { message_thread_id: targetThreadId } : {}),
      from_chat_id: fromChatId,
      message_id: replyMsgId
    });
  } else if (extraText) {
    return api.sendMessage({
      chat_id: targetId,
      ...(targetThreadId ? { message_thread_id: targetThreadId } : {}),
      text: extraText,
      parse_mode: 'HTML'
    });
  }
  throw new Error('Nenhum conteúdo para enviar');
}

export function getSendHelpText() {
  return (
    `📤 <b>Central de Envios e Transmissão (/send)</b>\n\n` +
    `Utilize este comando <b>respondendo</b> a uma mensagem (texto, foto, vídeo, documento, áudio ou sticker) para enviá-la aos destinos desejados:\n\n` +
    `• <code>/send &lt;ID&gt;</code> — Envia o conteúdo citado diretamente para o ID informado (canal, grupo ou usuário).\n` +
    `• <code>/send_todos</code> — Transmite para <b>todos</b> os canais, grupos e usuários com conversa no bot.\n` +
    `• <code>/send_canal</code> — Transmite para <b>todos os canais</b> cadastrados.\n` +
    `• <code>/send_grupo</code> — Transmite para <b>todos os grupos</b> cadastrados.\n` +
    `• <code>/send_lista</code> — Transmite para todos os canais e grupos ativos na <b>lista oficial</b> (aprovados).\n\n` +
    `<i>💡 Dica: Você também pode enviar um texto direto junto ao comando caso não queira responder a uma mensagem existente (ex.: <code>/send_canal Olá canais!</code>).</i>`
  );
}

export async function handleSendCommand(m, parsed) {
  const { scope, targetId, targetThreadId, extraText } = parsed;
  const fromChatId = m.chat.id;
  const replyMsgId = m.reply_to_message?.message_id || null;
  const statusThreadId = m.message_thread_id || null;

  if (!replyMsgId && !extraText) {
    await api.sendMessage({
      chat_id: fromChatId,
      ...(statusThreadId ? { message_thread_id: statusThreadId } : {}),
      text: `⚠️ <b>Nenhum conteúdo especificado para envio.</b>\n\nResponda à mensagem que deseja enviar com o comando (ex.: <code>/send &lt;ID&gt;</code>, <code>/send_todos</code>, <code>/send_canal</code>, <code>/send_grupo</code>, <code>/send_lista</code>) ou informe o texto após o comando.`,
      parse_mode: 'HTML'
    });
    return;
  }

  // Envio para um único ID
  if (scope === 'single') {
    try {
      await sendContentToChat({
        targetId,
        targetThreadId,
        fromChatId,
        replyMsgId,
        extraText
      });
      await api.sendMessage({
        chat_id: fromChatId,
        ...(statusThreadId ? { message_thread_id: statusThreadId } : {}),
        text: `✅ <b>Mensagem enviada com sucesso!</b>\n\n🎯 <b>Destino:</b> <code>${targetId}</code>` + (targetThreadId ? ` (Tópico: <code>${targetThreadId}</code>)` : ''),
        parse_mode: 'HTML'
      });
    } catch (err) {
      await api.sendMessage({
        chat_id: fromChatId,
        ...(statusThreadId ? { message_thread_id: statusThreadId } : {}),
        text: `❌ <b>Falha ao enviar mensagem para</b> <code>${targetId}</code>:\n\n<i>${escHtml(err.description || err.message)}</i>`,
        parse_mode: 'HTML'
      });
    }
    return;
  }

  // Transmissão para múltiplos destinatários
  const scopeLabels = {
    todos: 'Todos (Canais, Grupos e Usuários)',
    canal: 'Todos os Canais Cadastrados',
    grupo: 'Todos os Grupos Cadastrados',
    lista: 'Canais e Grupos da Lista (Aprovados)'
  };
  const scopeLabel = scopeLabels[scope] || scope;

  const targets = await getBroadcastTargets(scope);
  if (!targets.length) {
    await api.sendMessage({
      chat_id: fromChatId,
      ...(statusThreadId ? { message_thread_id: statusThreadId } : {}),
      text: `ℹ️ <b>Nenhum destinatário encontrado</b> para a categoria: <b>${escHtml(scopeLabel)}</b>.`,
      parse_mode: 'HTML'
    });
    return;
  }

  let statusMsg = null;
  try {
    statusMsg = await api.sendMessage({
      chat_id: fromChatId,
      ...(statusThreadId ? { message_thread_id: statusThreadId } : {}),
      text: `⏳ <b>Iniciando transmissão...</b>\n\n🎯 <b>Destino:</b> ${escHtml(scopeLabel)}\n📊 <b>Total de destinatários:</b> ${targets.length}`,
      parse_mode: 'HTML'
    });
  } catch {}

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    try {
      await sendContentToChat({
        targetId: t.id,
        targetThreadId: t.thread_id,
        fromChatId,
        replyMsgId,
        extraText
      });
      successCount++;
    } catch (err) {
      if (err.parameters?.retry_after) {
        try {
          const waitMs = (err.parameters.retry_after + 1) * 1000;
          await new Promise(r => setTimeout(r, Math.min(waitMs, 5000)));
          await sendContentToChat({
            targetId: t.id,
            targetThreadId: t.thread_id,
            fromChatId,
            replyMsgId,
            extraText
          });
          successCount++;
          continue;
        } catch {
          failCount++;
        }
      } else {
        failCount++;
      }
    }

    if (targets.length > 1) {
      await new Promise(r => setTimeout(r, 40));
    }
  }

  const finalReport =
    `📢 <b>Relatório de Transmissão Concluída</b>\n\n` +
    `🎯 <b>Destino:</b> ${escHtml(scopeLabel)}\n` +
    `✅ <b>Enviados com sucesso:</b> ${successCount}\n` +
    `❌ <b>Falhas / Bloqueados:</b> ${failCount}\n` +
    `📊 <b>Total processado:</b> ${targets.length}`;

  if (statusMsg?.message_id) {
    try {
      await api.editMessageText({
        chat_id: fromChatId,
        message_id: statusMsg.message_id,
        text: finalReport,
        parse_mode: 'HTML'
      });
      return;
    } catch {}
  }

  await api.sendMessage({
    chat_id: fromChatId,
    ...(statusThreadId ? { message_thread_id: statusThreadId } : {}),
    text: finalReport,
    parse_mode: 'HTML'
  });
}
