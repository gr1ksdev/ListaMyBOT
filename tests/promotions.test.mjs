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
          return { status: 'administrator', can_manage_topics: canManageTopics };
        }
        if (name === 'createForumTopic') {
          return { message_thread_id: 888, name: p.name || 'Divulgações pendentes' };
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
const { DEFAULTS } = await import('../tgcloud/lib/domain.js');
const { default: message } = await import('../tgcloud/handlers/message.js');
const { default: callback } = await import('../tgcloud/handlers/callback_query.js');

beforeEach(() => {
  sql?.close();
  sql = new DatabaseSync(':memory:');
  sql.exec(`
    CREATE TABLE list_runtime(id TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE list_settings(id INTEGER PRIMARY KEY, value TEXT, version INTEGER);
    CREATE TABLE list_chats(id INTEGER PRIMARY KEY, title TEXT, type TEXT, url TEXT DEFAULT '', category INTEGER DEFAULT -1, status TEXT DEFAULT 'draft', owner INTEGER, updated INTEGER, menu_chat INTEGER, menu_id INTEGER, display TEXT DEFAULT '', position INTEGER DEFAULT 0, last_messages TEXT DEFAULT '[]', error TEXT DEFAULT '');
    CREATE TABLE list_promotions(
      id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, user_name TEXT NOT NULL DEFAULT '',
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
  const payload = `🆔 CANAL\n🌐 Mundo Geek\nO melhor canal de filmes e séries da galáxia!\n📌 Categoria: #filmes #series\n🔗 https://t.me/mundogeek`;
  const res = parsePromoPayload(payload);
  assert.equal(res.ok, true);
  assert.equal(res.data.type, 'channel');
  assert.equal(res.data.title, 'Mundo Geek');
  assert.equal(res.data.description, 'O melhor canal de filmes e séries da galáxia!');
  assert.equal(res.data.category, '#filmes #series');
  assert.equal(res.data.url, 'https://t.me/mundogeek');
  assert.equal(res.data.media_type, '');
});

test('parser extrai mídia anexada (foto, video, gif)', () => {
  const payload = `🆔 GRUPO\n🌐 Papo Aberto\nComunidade para bater papo sobre tecnologia.\n📌 Categoria: #tecnologia #dev\n🔗 https://t.me/papoaberto`;
  const photoMedia = { photo: [{ file_id: 'small' }, { file_id: 'large_photo_id' }] };
  const resPhoto = parsePromoPayload(payload, photoMedia);
  assert.equal(resPhoto.ok, true);
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

  const badLink = `🆔 Canal\n🌐 Teste\nDesc\n📌 Categoria: #teste\n🔗 https://google.com`;
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
  const payload = `🆔 Canal\n🌐 Dev BR\nCanal de notícias e vagas para devs.\n📌 Categoria: #programacao #ti\n🔗 https://t.me/devbr`;
  await message(pm(payload));

  const draftMsg = calls.find(c => c.name === 'sendMessage' && c.p.text.includes('Divulgação pronta para envio'));
  assert.ok(draftMsg);
  assert.match(draftMsg.p.text, /Dev BR/);
  assert.equal(draftMsg.p.reply_markup.inline_keyboard[0][0].callback_data, 'promo:confirm_submit');

  const draftInDb = JSON.parse(sql.prepare("SELECT value FROM list_runtime WHERE id='promo_draft:42'").get().value);
  assert.equal(draftInDb.title, 'Dev BR');
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

  const payload = `🆔 Canal\n🌐 Cinema Total\nOs melhores lançamentos do cinema.\n📌 Categoria: #cinema #filmes\n🔗 https://t.me/cinematotal`;
  await message(pm(payload));

  // User sends /divulgar to submit
  await message(pm('/divulgar'));

  assert.ok(calls.some(c => c.name === 'sendMessage' && c.p.text.includes('enviada com sucesso')));

  // Check that message was sent to log chat with topic
  const logMsg = calls.find(c => c.name === 'sendMessage' && c.p.chat_id === -1001999999);
  assert.ok(logMsg);
  assert.equal(logMsg.p.message_thread_id, 888);
  assert.match(logMsg.p.text, /Nova Divulgação Pendente/);
  assert.match(logMsg.p.text, /Cinema Total/);
  assert.equal(logMsg.p.reply_markup.inline_keyboard[0][0].text, '✅ Aprovar');
  assert.equal(logMsg.p.reply_markup.inline_keyboard[0][1].text, '❌ Desaprovar');

  const promoRow = sql.prepare("SELECT * FROM list_promotions WHERE title='Cinema Total'").get();
  assert.equal(promoRow.status, 'pending');
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
  assert.match(channelPost.p.caption, /Resumos e indicações diárias\./);
  assert.match(channelPost.p.caption, /#filmes #dicas/);
  assert.match(channelPost.p.caption, /https:\/\/t\.me\/filmespipoca/);

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
