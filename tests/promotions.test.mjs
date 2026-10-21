import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';

let sql, calls, sent, isForum, canManageTopics;
const sdk = {
  db: {
    async get(q, p = {}) { return sql.prepare(q).get(p) || null; },
    async all(q, p = {}) { return sql.prepare(q).all(p); },
    async run(q, p = {}) { const r = sql.prepare(q).run(p); return { rowsAffected: r.changes }; }
  },
  api: new Proxy({}, {
    get(_, name) {
      return async (p = {}) => {
        calls.push({ name, p });
        if (name === 'getMe') return { id: 999, username: 'ListaMyBOT' };
        if (name === 'getChat') {
          return { id: p.chat_id, type: 'supergroup', is_forum: isForum, title: 'Logs Group' };
        }
        if (name === 'getChatMember') {
          if (p.user_id === 99999) return { status: 'member' };
          return {
            status: 'administrator',
            can_manage_topics: canManageTopics,
            can_delete_messages: true,
            can_pin_messages: true,
            can_post_messages: true,
            can_edit_messages: true
          };
        }
        if (name === 'createForumTopic') {
          return { message_thread_id: p.name?.includes('Cadastros') ? 777 : 888, name: p.name || 'Divulgações pendentes' };
        }
        if (name === 'getChatMemberCount') {
          return 1250;
        }
        if (['sendMessage', 'sendPhoto', 'sendVideo', 'sendAnimation'].includes(name)) {
          return { message_id: ++sent };
        }
        if (['editMessageText', 'editMessageCaption'].includes(name)) {
          return { message_id: p.message_id };
        }
        if (name === 'answerCallbackQuery') return true;
        return true;
      };
    }
  }),
  EndpointError: class extends Error {}
};

globalThis.__PROMO_SDK = sdk;
registerHooks({
  resolve(specifier, ctx, next) {
    if (specifier === 'sdk' || specifier === 'sdk/db') return { url: 'test:promo_sdk', shortCircuit: true };
    return next(specifier, ctx);
  },
  load(url, ctx, next) {
    if (url === 'test:promo_sdk') return { format: 'module', source: 'export const {db,api,EndpointError}=globalThis.__PROMO_SDK; export const table=()=>({}), integer=()=>({}), text=()=>({});', shortCircuit: true };
    return next(url, ctx);
  }
});

const { parsePromoPayload, ensurePromoTopic, submitPromotion, approvePromotion, rejectPromotion } = await import('../tgcloud/lib/promotions.js');
const { ensureChatsTopic, formatChatSubmissionMessage, chatSubmissionKeyboard, sendChatSubmissionLog } = await import('../tgcloud/lib/chat_logs.js');
const { submit } = await import('../tgcloud/lib/registration.js');
const { DEFAULTS } = await import('../tgcloud/lib/domain.js');
const { default: message } = await import('../tgcloud/handlers/message.js');
const { default: callback } = await import('../tgcloud/handlers/callback_query.js');
const { default: moderateChat } = await import('../tgcloud/endpoints/moderateChat.js');

beforeEach(() => {
  sql?.close();
  sql = new DatabaseSync(':memory:');
  sql.exec(`
    CREATE TABLE list_runtime(id TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE list_settings(id INTEGER PRIMARY KEY, value TEXT, version INTEGER);
    CREATE TABLE list_chats(id INTEGER PRIMARY KEY, title TEXT, type TEXT, url TEXT DEFAULT '', category INTEGER DEFAULT -1, status TEXT DEFAULT 'draft', owner INTEGER, updated INTEGER, menu_chat INTEGER, menu_id INTEGER, display TEXT DEFAULT '', position INTEGER DEFAULT 0, last_messages TEXT DEFAULT '[]', error TEXT DEFAULT '');
    CREATE TABLE list_promotions(
      id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, user_name TEXT NOT NULL DEFAULT '',
      chat_id TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'channel', title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '', url TEXT NOT NULL, media_type TEXT NOT NULL DEFAULT '',
      media_file_id TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending',
      log_chat_id INTEGER, log_message_id INTEGER, channel_message_id INTEGER,
      created INTEGER NOT NULL, reviewed_by INTEGER, reviewed_at INTEGER
    );
  `);
  sql.prepare('INSERT INTO list_settings(id,value,version) VALUES(1,?,1)').run(JSON.stringify(DEFAULTS));
  calls = [];
  sent = 0;
  isForum = true;
  canManageTopics = true;
});

const pm = (text, extra = {}) => ({
  text,
  chat: { id: 42, type: 'private' },
  from: { id: 42, first_name: 'Gabriel', username: 'gabriel_user' },
  ...extra
});

const adminPm = (text, extra = {}) => ({
  text,
  chat: { id: 7595607953, type: 'private' },
  from: { id: 7595607953, first_name: 'Admin', username: 'admin_user' },
  ...extra
});

const groupMsg = (text, chatId = -1001999999, userId = 7595607953) => ({
  text,
  chat: { id: chatId, type: 'supergroup', title: 'Grupo de Logs' },
  from: { id: userId, first_name: 'Admin', username: 'admin_user' }
});

const cbQuery = (data, user = 7595607953, target = -1001999999) => ({
  id: 'cb_test_1',
  from: { id: user, first_name: 'Admin Tester' },
  data,
  message: { message_id: 55, chat: { id: target, type: target > 0 ? 'private' : 'supergroup' } }
});

test('parser extrai campos obrigatórios com texto solto e valida link', () => {
  const payload = `🆔 -1001234567890 (Canal)\n🌐 Mundo Geek\nO melhor canal de filmes e séries da galáxia!\n📌 Categoria: #filmes #series\n🔗 https://t.me/mundogeek`;
  const res = parsePromoPayload(payload);
  assert.equal(res.ok, true);
  assert.equal(res.data.chat_id, '-1001234567890');
  assert.equal(res.data.type, 'channel');
  assert.equal(res.data.title, 'Mundo Geek');
  assert.equal(res.data.description, 'O melhor canal de filmes e séries da galáxia!');
  assert.equal(res.data.category, '#filmes #series');
  assert.equal(res.data.url, 'https://t.me/mundogeek');
  assert.equal(res.data.media_type, '');
});

test('parser extrai mídia anexada (foto, video, gif)', () => {
  const payload = `🆔 -1009876543210 (Grupo)\n🌐 Papo Aberto\nComunidade para bater papo sobre tecnologia.\n📌 Categoria: #tecnologia #dev\n🔗 https://t.me/papoaberto`;
  const photoMedia = { photo: [{ file_id: 'small' }, { file_id: 'large_photo_id' }] };
  const resPhoto = parsePromoPayload(payload, photoMedia);
  assert.equal(resPhoto.ok, true);
  assert.equal(resPhoto.data.chat_id, '-1009876543210');
  assert.equal(resPhoto.data.type, 'group');
  assert.equal(resPhoto.data.media_type, 'photo');
  assert.equal(resPhoto.data.media_file_id, 'large_photo_id');

  const videoMedia = { video: { file_id: 'video_id_777' } };
  const resVideo = parsePromoPayload(payload, videoMedia);
  assert.equal(resVideo.data.media_type, 'video');
  assert.equal(resVideo.data.media_file_id, 'video_id_777');
});

test('parser acusa erro quando faltam campos ou o link não é do Telegram', () => {
  const incomplete = `🌐 Sem Tipo Nem Link\n📌 Categoria: #teste`;
  const res1 = parsePromoPayload(incomplete);
  assert.equal(res1.ok, false);
  assert.match(res1.error, /Campos obrigatórios não encontrados/);

  const badLink = `🆔 -1001234567890\n🌐 Teste\nDesc\n📌 Categoria: #teste\n🔗 https://google.com`;
  const res2 = parsePromoPayload(badLink);
  assert.equal(res2.ok, false);
  assert.match(res2.error, /link precisa ser um link válido do Telegram/);
});

test('verificação e criação do tópico de logs no grupo fórum', async () => {
  isForum = true;
  canManageTopics = true;
  const topicRes = await ensurePromoTopic(-1001234567);
  assert.equal(topicRes.ok, true);
  assert.equal(topicRes.topicId, 888);
  assert.ok(calls.some(c => c.name === 'createForumTopic' && c.p.name === 'Divulgações pendentes'));

  isForum = false;
  const nonForumRes = await ensurePromoTopic(-1001234567);
  assert.equal(nonForumRes.ok, false);
  assert.match(nonForumRes.error, /não tem tópicos ativados/);

  isForum = true;
  canManageTopics = false;
  const noPermRes = await ensurePromoTopic(-1001234567);
  assert.equal(noPermRes.ok, false);
  assert.match(noPermRes.error, /permissão "Gerenciar tópicos"/);
});

test('comandos admin /setlogs e /setcanal salvam configurações de divulgação', async () => {
  await message(groupMsg('/setlogs'));
  assert.ok(calls.some(c => c.name === 'sendMessage' && c.p.text.includes('Grupo de logs configurado')));
  const settingsRow = JSON.parse(sql.prepare('SELECT value FROM list_settings WHERE id=1').get().value);
  assert.equal(settingsRow.promoLogChat, -1001999999);
  assert.equal(settingsRow.promoLogTopic, 888);

  await message(adminPm('/setcanal -1001888888'));
  assert.ok(calls.some(c => c.name === 'sendMessage' && c.p.text.includes('Canal de divulgação vinculado')));
  const updatedSettings = JSON.parse(sql.prepare('SELECT value FROM list_settings WHERE id=1').get().value);
  assert.equal(updatedSettings.promoChannel, '-1001888888');

  // Non admin cannot run /setcanal
  await message(pm('/setcanal -100123'));
  assert.ok(calls.some(c => c.name === 'sendMessage' && c.p.text.includes('Apenas administradores')));
});

test('envio de payload solto no privado gera rascunho com prévia e botão de confirmação', async () => {
  const payload = `🆔 -1001555555555\n🌐 Dev BR\nCanal de notícias e vagas para devs.\n📌 Categoria: #programacao #ti\n🔗 https://t.me/devbr`;
  await message(pm(payload));

  const draftMsg = calls.find(c => c.name === 'sendMessage' && c.p.text.includes('Divulgação pronta para envio'));
  assert.ok(draftMsg);
  assert.match(draftMsg.p.text, /Dev BR/);
  assert.match(draftMsg.p.text, /-1001555555555/);
  assert.equal(draftMsg.p.reply_markup.inline_keyboard[0][0].callback_data, 'promo:confirm_submit');

  const draftInDb = JSON.parse(sql.prepare("SELECT value FROM list_runtime WHERE id='promo_draft:42'").get().value);
  assert.equal(draftInDb.title, 'Dev BR');
  assert.equal(draftInDb.chat_id, '-1001555555555');
  assert.equal(draftInDb.url, 'https://t.me/devbr');
});

test('confirmação via /divulgar ou botão encaminha para o tópico de logs com botões de aprovação', async () => {
  // Setup log chat & topic
  sql.prepare('UPDATE list_settings SET value=? WHERE id=1').run(JSON.stringify({
    ...DEFAULTS,
    promoLogChat: -1001999999,
    promoLogTopic: 888,
    promoChannel: '-1001888888'
  }));

  const payload = `🆔 -1001777777777\n🌐 Cinema Total\nOs melhores lançamentos do cinema.\n📌 Categoria: #cinema #filmes\n🔗 https://t.me/cinematotal`;
  await message(pm(payload));

  // User sends /divulgar to submit
  await message(pm('/divulgar'));

  assert.ok(calls.some(c => c.name === 'sendMessage' && c.p.text.includes('enviada com sucesso')));

  // Check that message was sent to log chat with topic
  const logMsg = calls.find(c => c.name === 'sendMessage' && c.p.chat_id === -1001999999);
  assert.ok(logMsg);
  assert.equal(logMsg.p.message_thread_id, 888);
  assert.match(logMsg.p.text, /Nova Divulgação Pendente/);
  assert.match(logMsg.p.text, /-1001777777777/);
  assert.match(logMsg.p.text, /Cinema Total/);
  assert.equal(logMsg.p.reply_markup.inline_keyboard[0][0].text, '✅ Aprovar');
  assert.equal(logMsg.p.reply_markup.inline_keyboard[0][1].text, '❌ Desaprovar');

  const promoRow = sql.prepare("SELECT * FROM list_promotions WHERE title='Cinema Total'").get();
  assert.equal(promoRow.status, 'pending');
  assert.equal(promoRow.chat_id, '-1001777777777');
  assert.equal(promoRow.user_id, 42);
});

test('aprovação publica no canal com descrição, tags, link e dois botões interativos', async () => {
  sql.prepare('UPDATE list_settings SET value=? WHERE id=1').run(JSON.stringify({
    ...DEFAULTS,
    promoLogChat: -1001999999,
    promoLogTopic: 888,
    promoChannel: '-1001888888'
  }));

  const promoData = {
    type: 'channel',
    title: 'Filmes & Pipoca',
    description: 'Resumos e indicações diárias.',
    category: '#filmes #dicas',
    url: 'https://t.me/filmespipoca',
    media_type: 'photo',
    media_file_id: 'photo_abc_123'
  };

  const promo = await submitPromotion({ id: 42, first_name: 'Gabriel' }, promoData);

  // Admin approves via callback
  await callback(cbQuery(`promo:approve:${promo.id}`, 7595607953));

  // Check channel post sent with photo, bold title, description, tags, link
  const channelPost = calls.find(c => c.name === 'sendPhoto' && c.p.chat_id === -1001888888);
  assert.ok(channelPost);
  assert.match(channelPost.p.caption, /<b>Filmes &amp; Pipoca<\/b>/);
  assert.match(channelPost.p.caption, /<blockquote>Resumos e indicações diárias\.<\/blockquote>/);
  assert.match(channelPost.p.caption, /#filmes #dicas/);
  assert.equal(channelPost.p.caption.includes('https://t.me/filmespipoca'), false);

  // Check the two interactive buttons: 1. Canal, 2. Bot promotion link
  const buttons = channelPost.p.reply_markup.inline_keyboard;
  assert.equal(buttons.length, 2);
  assert.equal(buttons[0][0].text, 'Filmes & Pipoca');
  assert.equal(buttons[0][0].url, 'https://t.me/filmespipoca');
  assert.match(buttons[1][0].text, /Divulgue no @ListaMyBOT/);
  assert.match(buttons[1][0].url, /t\.me\/ListaMyBOT\?start=divulgar/);

  // Check author notified
  assert.ok(calls.some(c => c.name === 'sendMessage' && c.p.chat_id === 42 && c.p.text.includes('aprovada')));

  // Check DB status
  const promoInDb = sql.prepare('SELECT * FROM list_promotions WHERE id=?').get(promo.id);
  assert.equal(promoInDb.status, 'approved');
});

test('desaprovação recusa a divulgação, atualiza log e notifica autor', async () => {
  sql.prepare('UPDATE list_settings SET value=? WHERE id=1').run(JSON.stringify({
    ...DEFAULTS,
    promoLogChat: -1001999999,
    promoLogTopic: 888,
    promoChannel: '-1001888888'
  }));

  const promoData = {
    type: 'group',
    title: 'Grupo Spam',
    description: 'Comunidade aleatória',
    category: '#spam',
    url: 'https://t.me/grupospam',
    media_type: ''
  };

  const promo = await submitPromotion({ id: 42, first_name: 'Gabriel' }, promoData);

  // Admin rejects via callback
  await callback(cbQuery(`promo:reject:${promo.id}`, 7595607953));

  // Author notified of rejection
  assert.ok(calls.some(c => c.name === 'sendMessage' && c.p.chat_id === 42 && c.p.text.includes('não foi aprovada')));

  // Check DB status
  const promoInDb = sql.prepare('SELECT * FROM list_promotions WHERE id=?').get(promo.id);
  assert.equal(promoInDb.status, 'rejected');
});

test('não-admin não consegue aprovar nem desaprovar', async () => {
  sql.prepare('UPDATE list_settings SET value=? WHERE id=1').run(JSON.stringify({
    ...DEFAULTS,
    promoLogChat: -1001999999,
    promoLogTopic: 888,
    promoChannel: '-1001888888'
  }));

  const promoData = {
    type: 'channel',
    title: 'Canal Teste',
    description: 'Desc',
    category: '#teste',
    url: 'https://t.me/canalteste'
  };
  const promo = await submitPromotion({ id: 42, first_name: 'Gabriel' }, promoData);

  // Non-admin user 99999 clicks
  await callback(cbQuery(`promo:approve:${promo.id}`, 99999));
  assert.ok(calls.some(c => c.name === 'answerCallbackQuery' && c.p.text.includes('Apenas administradores')));

  const promoInDb = sql.prepare('SELECT * FROM list_promotions WHERE id=?').get(promo.id);
  assert.equal(promoInDb.status, 'pending');
});

test('verificação e criação do tópico de cadastros pendentes no grupo fórum', async () => {
  const res = await ensureChatsTopic(-1001999999);
  assert.equal(res.ok, true);
  assert.equal(res.topicId, 777);
  assert.equal(res.name, 'Cadastros pendentes');

  // Caso onde o grupo não é fórum
  isForum = false;
  const noForumRes = await ensureChatsTopic(-1001999999);
  assert.equal(noForumRes.ok, false);
  assert.match(noForumRes.error, /não tem tópicos ativados/i);

  // Caso onde o bot não tem permissão para gerenciar tópicos
  isForum = true;
  canManageTopics = false;
  const noPermRes = await ensureChatsTopic(-1001999999);
  assert.equal(noPermRes.ok, false);
  assert.match(noPermRes.error, /Gerenciar tópicos/i);
});

test('envio de solicitação de cadastro para o tópico de logs com dados completos e botões', async () => {
  sql.prepare('UPDATE list_settings SET value=? WHERE id=1').run(JSON.stringify({
    ...DEFAULTS,
    promoLogChat: -1001999999,
    chatsLogTopic: 777
  }));

  const chat = {
    id: -1001234567,
    title: 'Canal Incrível',
    type: 'channel',
    url: 'https://t.me/canalincrivel',
    category: 0,
    owner: 42
  };

  const actor = { id: 42, first_name: 'Gabriel', username: 'gabriel_user' };
  const sentMsg = await sendChatSubmissionLog(chat, actor);
  assert.ok(sentMsg);

  // Verifica mensagem enviada
  const logCall = calls.find(c => c.name === 'sendMessage' && c.p.chat_id === -1001999999);
  assert.ok(logCall);
  assert.equal(logCall.p.message_thread_id, 777);
  assert.match(logCall.p.text, /Nova Solicitação de Entrada na Lista/);
  assert.match(logCall.p.text, /-1001234567/);
  assert.match(logCall.p.text, /Canal Incrível/);
  assert.match(logCall.p.text, /https:\/\/t\.me\/canalincrivel/);
  assert.match(logCall.p.text, /1\.250/); // Membros formatados
  assert.match(logCall.p.text, /Gabriel/);
  assert.match(logCall.p.text, /42/);

  // Verifica botões
  const kb = logCall.p.reply_markup.inline_keyboard;
  assert.equal(kb.length, 2);
  // Linha 1: Aprovar e Rejeitar com estilos
  assert.equal(kb[0][0].text, '✅ Aprovar');
  assert.equal(kb[0][0].callback_data, 'chat_adm:approve:-1001234567');
  assert.equal(kb[0][0].style, 'success');

  assert.equal(kb[0][1].text, '❌ Rejeitar');
  assert.equal(kb[0][1].callback_data, 'chat_adm:reject:-1001234567');
  assert.equal(kb[0][1].style, 'danger');

  // Linha 2: Abrir no Painel
  assert.equal(kb[1][0].text, '📊 Abrir no Painel');
  assert.match(kb[1][0].web_app.url, /\?tab=chats&chat=-1001234567/);
});

test('aprovação pelo painel atualiza o log original e notifica o dono', async () => {
  sql.prepare('UPDATE list_settings SET value=? WHERE id=1').run(JSON.stringify({
    ...DEFAULTS,
    promoLogChat: -1001999999,
    chatsLogTopic: 777
  }));
  sql.prepare(`
    INSERT INTO list_chats (id, title, type, url, category, status, owner, updated)
    VALUES (-1001234567, 'Canal Incrível', 'channel', 'https://t.me/canalincrivel', 0, 'pending', 42, 1000)
  `).run();

  const chat = {
    id: -1001234567,
    title: 'Canal Incrível',
    type: 'channel',
    url: 'https://t.me/canalincrivel',
    category: 0,
    owner: 42
  };
  const sentMsg = await sendChatSubmissionLog(chat, { id: 42, first_name: 'Gabriel' });
  assert.ok(sentMsg);

  calls = [];
  await moderateChat(
    { id: -1001234567, status: 'approved' },
    { initData: { user: { id: 7595607953, first_name: 'Admin Gabriel' } } }
  );

  const editCall = calls.find(c => c.name === 'editMessageText' && c.p.message_id === sentMsg.message_id);
  assert.ok(editCall, 'deve editar a mensagem de log enviada anteriormente');
  assert.equal(editCall.p.chat_id, -1001999999);
  assert.match(editCall.p.text, /Solicitação APROVADA/);

  const ownerNotice = calls.find(c => c.name === 'sendMessage' && c.p.chat_id === 42);
  assert.ok(ownerNotice, 'deve notificar o dono do cadastro');
  assert.match(ownerNotice.p.text, /aprovado/);

  assert.equal(sql.prepare('SELECT status FROM list_chats WHERE id=-1001234567').get().status, 'approved');
});

test('callback de aprovação e rejeição de cadastros pelos administradores', async () => {
  sql.prepare('UPDATE list_settings SET value=? WHERE id=1').run(JSON.stringify({
    ...DEFAULTS,
    promoLogChat: -1001999999,
    chatsLogTopic: 777
  }));

  sql.prepare(`
    INSERT INTO list_chats(id, title, type, url, category, status, owner, updated)
    VALUES(-1001234567, 'Canal Incrível', 'channel', 'https://t.me/canalincrivel', 0, 'pending', 42, ?)
  `).run(Date.now());

  // Não-admin tenta aprovar
  await callback(cbQuery('chat_adm:approve:-1001234567', 99999));
  assert.ok(calls.some(c => c.name === 'answerCallbackQuery' && c.p.text.includes('Apenas administradores')));
  let chatInDb = sql.prepare('SELECT status FROM list_chats WHERE id=-1001234567').get();
  assert.equal(chatInDb.status, 'pending');

  // Admin aprova
  calls = [];
  await callback(cbQuery('chat_adm:approve:-1001234567', 7595607953));
  chatInDb = sql.prepare('SELECT status FROM list_chats WHERE id=-1001234567').get();
  assert.equal(chatInDb.status, 'approved');

  // Mensagem de log é editada
  const editCall = calls.find(c => c.name === 'editMessageText');
  assert.ok(editCall);
  assert.match(editCall.p.text, /Solicitação APROVADA na Lista/);
  assert.match(editCall.p.text, /Aprovado por:/);

  // Dono é notificado no privado
  const notifyOwner = calls.find(c => c.name === 'sendMessage' && c.p.chat_id === 42);
  assert.ok(notifyOwner);
  assert.match(notifyOwner.p.text, /Boas notícias!/);
  assert.match(notifyOwner.p.text, /Canal Incrível/);

  // Admin altera para rejeitado
  calls = [];
  await callback(cbQuery('chat_adm:reject:-1001234567', 7595607953));
  chatInDb = sql.prepare('SELECT status FROM list_chats WHERE id=-1001234567').get();
  assert.equal(chatInDb.status, 'rejected');

  const rejectEdit = calls.find(c => c.name === 'editMessageText');
  assert.ok(rejectEdit);
  assert.match(rejectEdit.p.text, /Solicitação REJEITADA na Lista/);
  assert.match(rejectEdit.p.text, /Rejeitado por:/);

  // Dono notificado da rejeição
  const notifyReject = calls.find(c => c.name === 'sendMessage' && c.p.chat_id === 42);
  assert.ok(notifyReject);
  assert.match(notifyReject.p.text, /Aviso sobre seu cadastro/);
});

test('submissão no fluxo de registro envia log automaticamente para o tópico', async () => {
  sql.prepare('UPDATE list_settings SET value=? WHERE id=1').run(JSON.stringify({
    ...DEFAULTS,
    approval: 'manual',
    promoLogChat: -1001999999,
    chatsLogTopic: 777
  }));

  sql.prepare(`
    INSERT INTO list_chats(id, title, type, url, category, status, owner, updated)
    VALUES(-100999888, 'Grupo Novo', 'group', 'https://t.me/gruponovo', 1, 'draft', 42, ?)
  `).run(Date.now());

  calls = [];
  const c = sql.prepare('SELECT * FROM list_chats WHERE id=-100999888').get();
  const actor = { id: 42, first_name: 'Gabriel', username: 'gabriel_user' };
  const finalStatus = await submit(c, 42, actor);

  assert.equal(finalStatus, 'pending');
  // Verifica se sendChatSubmissionLog foi executado
  const logMsg = calls.find(call => call.name === 'sendMessage' && call.p.chat_id === -1001999999);
  assert.ok(logMsg);
  assert.equal(logMsg.p.message_thread_id, 777);
  assert.match(logMsg.p.text, /Grupo Novo/);
  assert.match(logMsg.p.text, /Gabriel/);
});

