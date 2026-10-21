import { api, db } from 'sdk';
import { config } from './store.js';

// The Bot API has no method to list a forum's topics, so the bot can only rely
// on the thread IDs it saved itself. Every topic must be persisted as soon as
// it is created; otherwise a timeout after creation leaves no record and the
// next /setlogs run creates a duplicate.
export const LOG_TOPIC_DEFS = {
 promo: { key: 'promoLogTopic', name: 'Divulgações pendentes', color: 7322096 },
 chats: { key: 'chatsLogTopic', name: 'Cadastros pendentes', color: 9367192 },
 support: { key: 'supportLogTopic', name: 'Suporte & Dúvidas', color: 7322096 }
};

export const LOG_TOPIC_KINDS = Object.keys(LOG_TOPIC_DEFS);

const MISSING_TOPIC_PATTERN = /topic_id_invalid|topic_deleted|message thread not found|topic.*(?:deleted|invalid|not found)/i;

export function topicKindFromName(name) {
 const normalized = String(name || '').trim().toLocaleLowerCase('pt-BR');
 return LOG_TOPIC_KINDS.find(kind => LOG_TOPIC_DEFS[kind].name.toLocaleLowerCase('pt-BR') === normalized) || null;
}

export function isMissingTopicError(err) {
 return MISSING_TOPIC_PATTERN.test(String(err?.description || err?.message || ''));
}

// Read-modify-write on list_settings with a small optimistic-lock retry. Topic
// IDs are saved one by one, so a timeout never discards the topics created
// before it.
async function updateSettings(mutator) {
 for (let attempt = 0; attempt < 4; attempt++) {
  const current = await config();
  const changed = mutator(current.settings);
  if (!changed) return current.settings;
  const value = JSON.stringify(current.settings);
  const result = current.version
   ? await db.run('UPDATE list_settings SET value=:v,version=version+1 WHERE id=1 AND version=:version', { ':v': value, ':version': current.version })
   : await db.run('INSERT INTO list_settings(id,value,version) VALUES(1,:v,1) ON CONFLICT(id) DO UPDATE SET value=excluded.value,version=version+1', { ':v': value });
  if (result.rowsAffected) return current.settings;
 }
 throw Error('As configurações mudaram durante a criação dos tópicos. Execute /setlogs novamente.');
}

export async function inspectLogChat(logChatId) {
 const id = Number(logChatId);
 if (!Number.isSafeInteger(id) || id >= 0) {
  return { ok: false, error: 'Informe o ID de um grupo (supergrupo com tópicos), começando com -100.' };
 }
 try {
  const chat = await api.getChat({ chat_id: id });
  if (!chat) return { ok: false, error: 'Grupo de logs não encontrado.' };
  if (!chat.is_forum) {
   return { ok: false, isForum: false, error: 'O grupo não tem tópicos ativados (não é um supergrupo com fórum).' };
  }
  const me = await api.getMe();
  const member = await api.getChatMember({ chat_id: id, user_id: me.id });
  if (member.status !== 'creator' && !member.can_manage_topics) {
   return { ok: false, isForum: true, error: 'O bot precisa da permissão "Gerenciar tópicos" (can_manage_topics) como administrador.' };
  }
  return { ok: true, isForum: true, chat };
 } catch (err) {
  return { ok: false, error: err.description || err.message || 'Não foi possível consultar o grupo de logs.' };
 }
}

// The Bot API cannot list topics, and editForumTopic does NOT validate the
// thread (it returns true even for a nonexistent ID). sendMessage is the only
// reliable check: a deleted topic returns "message thread not found". The probe
// message is deleted immediately and sent without notification.
export async function topicStillExists(logChatId, topicId) {
 if (!logChatId || !topicId) return false;
 let sent;
 try {
  sent = await api.sendMessage({
   chat_id: Number(logChatId),
   message_thread_id: Number(topicId),
   text: '🔄',
   disable_notification: true
  });
 } catch (err) {
  if (isMissingTopicError(err)) return false;
  // Permission/flood/closed-topic errors are inconclusive: do not discard a
  // topic that may still exist.
  return true;
 }
 try {
  await api.deleteMessage({ chat_id: Number(logChatId), message_id: sent.message_id });
 } catch (err) {
  console.warn('Não foi possível apagar a mensagem de verificação do tópico:', err?.description || err?.message);
 }
 return true;
}

export async function saveLogTopic(logChatId, kind, topicId) {
 const def = LOG_TOPIC_DEFS[kind];
 if (!def) return false;
 await updateSettings(settings => {
  if (Number(settings.promoLogChat) !== Number(logChatId)) return false;
  if (Number(settings[def.key]) === Number(topicId)) return false;
  settings[def.key] = Number(topicId);
  return true;
 });
 return true;
}

export async function clearLogTopic(logChatId, kind) {
 const def = LOG_TOPIC_DEFS[kind];
 if (!def) return false;
 await updateSettings(settings => {
  if (Number(settings.promoLogChat) !== Number(logChatId)) return false;
  if (!settings[def.key]) return false;
  settings[def.key] = 0;
  return true;
 });
 return true;
}

// Store the log group before creating anything. When the group changes, the
// old topic IDs are cleared; when it is the same group, they are preserved.
export async function prepareLogChat(logChatId) {
 const id = Number(logChatId);
 const current = await config();
 const sameGroup = Number(current.settings.promoLogChat) === id;
 await updateSettings(settings => {
  let changed = false;
  if (Number(settings.promoLogChat) !== id) {
   settings.promoLogChat = id;
   changed = true;
  }
  if (!sameGroup) {
   for (const def of Object.values(LOG_TOPIC_DEFS)) {
    settings[def.key] = 0;
   }
   changed = true;
  }
  for (const def of Object.values(LOG_TOPIC_DEFS)) {
   if (!Number.isSafeInteger(Number(settings[def.key])) || Number(settings[def.key]) < 0) {
    settings[def.key] = 0;
    changed = true;
   }
  }
  return changed;
 });
 return { ok: true, sameGroup };
}

export async function createLogTopic(logChatId, kind, { save = true } = {}) {
 const def = LOG_TOPIC_DEFS[kind];
 if (!def) return { ok: false, error: 'Tipo de tópico inválido.' };
 let lastError;
 for (let attempt = 0; attempt < 2; attempt++) {
  try {
   const topic = await api.createForumTopic({
    chat_id: Number(logChatId),
    name: def.name,
    icon_color: def.color
   });
   const topicId = Number(topic.message_thread_id);
   if (save) await saveLogTopic(logChatId, kind, topicId);
   return { ok: true, kind, isForum: true, topicId, name: topic.name || def.name, created: true };
  } catch (err) {
   lastError = err;
   const retryAfter = Number(err?.parameters?.retry_after || 0);
   // Long flood waits cannot be honoured inside a serverless update. Fail fast
   // and let the next /setlogs run retry only the missing topic.
   if (attempt === 0 && retryAfter > 0 && retryAfter <= 2) {
    await new Promise(resolve => setTimeout(resolve, (retryAfter + 1) * 1000));
    continue;
   }
   break;
  }
 }
 return { ok: false, kind, error: lastError?.description || lastError?.message || 'Falha ao criar o tópico.' };
}

// Used by the lazy flows (promotion submitted, chat registered, ticket opened)
// and by the explicit /setlogs command. `useSaved` lets a caller reuse a thread
// already stored in settings instead of always creating another one.
export async function ensureLogTopic(logChatId, kind, { useSaved = false } = {}) {
 const def = LOG_TOPIC_DEFS[kind];
 if (!def) return { ok: false, error: 'Tipo de tópico inválido.' };
 if (useSaved) {
  const current = await config();
  if (Number(current.settings.promoLogChat) === Number(logChatId)) {
   const saved = Number(current.settings[def.key] || 0);
   if (saved > 0) return { ok: true, existing: true, topicId: saved, name: def.name };
  }
 }
 const inspection = await inspectLogChat(logChatId);
 if (!inspection.ok) return inspection;
 return createLogTopic(logChatId, kind);
}

// Verify saved threads and create all missing ones in parallel. Nothing is
// created sequentially: the previous implementation only managed one topic per
// /setlogs because the serverless update timed out on the gaps between them.
export async function setupLogTopics(logChatId) {
 const inspection = await inspectLogChat(logChatId);
 if (!inspection.ok) return { ...inspection, topics: [] };

 await prepareLogChat(logChatId);
 const id = Number(logChatId);
 const current = await config();

 // Probe saved threads in parallel. sendMessage is the reliable check; a
 // deleted topic fails with "message thread not found".
 const checks = await Promise.all(LOG_TOPIC_KINDS.map(async kind => {
  const def = LOG_TOPIC_DEFS[kind];
  const saved = Number(current.settings[def.key] || 0);
  const exists = saved > 0 ? await topicStillExists(id, saved) : false;
  return { kind, def, saved, exists };
 }));

 const stale = checks.filter(check => check.saved > 0 && !check.exists);
 if (stale.length) {
  await updateSettings(settings => {
   if (Number(settings.promoLogChat) !== id) return false;
   let changed = false;
   for (const check of stale) {
    if (settings[check.def.key]) {
     settings[check.def.key] = 0;
     changed = true;
    }
   }
   return changed;
  });
 }

 const pending = checks.filter(check => !check.exists);
 const created = await Promise.all(
  pending.map(check => createLogTopic(id, check.kind, { save: false }))
 );

 const successful = created.filter(result => result.ok && result.topicId > 0);
 if (successful.length) {
  await updateSettings(settings => {
   if (Number(settings.promoLogChat) !== id) return false;
   let changed = false;
   for (const result of successful) {
    const key = LOG_TOPIC_DEFS[result.kind].key;
    if (Number(settings[key]) !== Number(result.topicId)) {
     settings[key] = Number(result.topicId);
     changed = true;
    }
   }
   return changed;
  });
 }

 const createdByKind = new Map(created.map(result => [result.kind, result]));
 const topics = checks.map(check => {
  if (check.exists) {
   return { kind: check.kind, name: check.def.name, status: 'existing', topicId: check.saved };
  }
  const result = createdByKind.get(check.kind);
  if (result?.ok && result.topicId) {
   return {
    kind: check.kind,
    name: check.def.name,
    status: check.saved > 0 ? 'recreated' : 'created',
    topicId: result.topicId
   };
  }
  return {
   kind: check.kind,
   name: check.def.name,
   status: 'failed',
   error: result?.error || 'Falha ao criar o tópico.'
  };
 });

 return { ok: true, isForum: true, topics };
}

// When the bot creates a topic, Telegram sends a forum_topic_created service
// message. Capturing it is a second safety net for the case where the update
// that created the topic times out before saving the returned thread ID.
export async function captureLogTopic(m) {
 if (!m?.forum_topic_created || !m.message_thread_id || !m.chat?.id) return false;
 const kind = topicKindFromName(m.forum_topic_created.name);
 if (!kind) return false;
 const current = await config();
 if (Number(current.settings.promoLogChat) !== Number(m.chat.id)) return false;
 if (Number(current.settings[LOG_TOPIC_DEFS[kind].key] || 0) > 0) return false;
 await saveLogTopic(m.chat.id, kind, m.message_thread_id);
 return true;
}

// Manual mapping for topics created before the bot saved their IDs (or by
// hand). The Bot API cannot discover them, so /settopic is the fallback that
// prevents duplicates.
export async function bindLogTopic(logChatId, kind, topicId) {
 const def = LOG_TOPIC_DEFS[kind];
 if (!def) return { ok: false, error: 'Tipo de tópico inválido.' };
 const id = Number(logChatId);
 const topic = Number(topicId);
 if (!Number.isSafeInteger(id) || id >= 0) return { ok: false, error: 'Grupo de logs inválido.' };
 if (!Number.isSafeInteger(topic) || topic <= 0) return { ok: false, error: 'ID do tópico inválido.' };
 const inspection = await inspectLogChat(id);
 if (!inspection.ok) return inspection;
 if (!await topicStillExists(id, topic)) return { ok: false, error: 'Esse tópico não existe nesse grupo.' };
 await updateSettings(settings => {
  const sameGroup = Number(settings.promoLogChat) === id;
  if (!sameGroup) {
   for (const other of Object.values(LOG_TOPIC_DEFS)) settings[other.key] = 0;
  }
  settings.promoLogChat = id;
  settings[def.key] = topic;
  return true;
 });
 return { ok: true, kind, name: def.name, topicId: topic };
}
