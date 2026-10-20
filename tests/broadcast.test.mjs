import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';

let sql, calls, sent;
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
        if (name === 'getMe') return { id: 999, username: 'ListaMyBOT', first_name: 'ListaMyBOT' };
        if (['sendMessage', 'sendPhoto', 'sendVideo', 'sendAnimation'].includes(name)) {
          return { message_id: ++sent };
        }
        if (name === 'copyMessage') {
          if (p.chat_id === -9999) {
            const err = new Error('Chat not found');
            err.description = 'Bad Request: chat not found';
            throw err;
          }
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

globalThis.__BROADCAST_SDK = sdk;
registerHooks({
  resolve(specifier, ctx, next) {
    if (specifier === 'sdk' || specifier === 'sdk/db') return { url: 'test:broadcast_sdk', shortCircuit: true };
    return next(specifier, ctx);
  },
  load(url, ctx, next) {
    if (url === 'test:broadcast_sdk') return { format: 'module', source: 'export const {db,api,EndpointError}=globalThis.__BROADCAST_SDK; export const table=()=>({}), integer=()=>({}), text=()=>({});', shortCircuit: true };
    return next(url, ctx);
  }
});

const {
  initUsersTable,
  trackUser,
  getAllUsers,
  getBroadcastTargets,
  parseSendCommand,
  getSendHelpText
} = await import('../tgcloud/lib/broadcast.js');
const { DEFAULTS, OWNER } = await import('../tgcloud/lib/domain.js');
const { default: message } = await import('../tgcloud/handlers/message.js');

beforeEach(() => {
  sql?.close();
  sql = new DatabaseSync(':memory:');
  sql.exec(`
    CREATE TABLE list_runtime(id TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE list_settings(id INTEGER PRIMARY KEY, value TEXT, version INTEGER);
    CREATE TABLE list_chats(id INTEGER PRIMARY KEY, title TEXT, type TEXT, url TEXT DEFAULT '', category INTEGER DEFAULT -1, status TEXT DEFAULT 'draft', owner INTEGER, updated INTEGER, menu_chat INTEGER, menu_id INTEGER, display TEXT DEFAULT '', position INTEGER DEFAULT 0, last_messages TEXT DEFAULT '[]', error TEXT DEFAULT '');
    CREATE TABLE list_promotions(id TEXT PRIMARY KEY, user_id INTEGER, user_name TEXT, chat_id TEXT, type TEXT, title TEXT, description TEXT, category TEXT, url TEXT, media_type TEXT, media_file_id TEXT, status TEXT, log_chat_id INTEGER, log_message_id INTEGER, channel_message_id INTEGER, created INTEGER, reviewed_by INTEGER, reviewed_at INTEGER);
    CREATE TABLE list_tickets(id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL, user_name TEXT DEFAULT '', user_username TEXT DEFAULT '', status TEXT DEFAULT 'pending', initial_message TEXT DEFAULT '', log_chat_id INTEGER, log_message_id INTEGER, thread_id INTEGER, topic_name TEXT DEFAULT '', assigned_to INTEGER, assigned_name TEXT DEFAULT '', created INTEGER, updated INTEGER, closed_at INTEGER, closed_by INTEGER);
    CREATE TABLE list_users(id INTEGER PRIMARY KEY, first_name TEXT DEFAULT '', username TEXT DEFAULT '', created INTEGER DEFAULT 0, updated INTEGER DEFAULT 0);
  `);
  const initialSettings = { ...DEFAULTS, promoLogChat: -1001234567890 };
  sql.prepare('INSERT INTO list_settings(id,value,version) VALUES(1,?,1)').run(JSON.stringify(initialSettings));
  calls = [];
  sent = 0;
});

test('parseSendCommand reconhece todas as variações de comandos e argumentos', () => {
  assert.equal(parseSendCommand('/other', []).isSend, false);

  const helpRes = parseSendCommand('/send', []);
  assert.equal(helpRes.isSend, true);
  assert.equal(helpRes.isHelp, true);

  const idRes = parseSendCommand('/send', ['-1001234567890']);
  assert.equal(idRes.isSend, true);
  assert.equal(idRes.scope, 'single');
  assert.equal(idRes.targetId, -1001234567890);

  const idSubRes = parseSendCommand('/send_-1001234567890', []);
  assert.equal(idSubRes.isSend, true);
  assert.equal(idSubRes.scope, 'single');
  assert.equal(idSubRes.targetId, -1001234567890);

  const idTopicRes = parseSendCommand('/send', ['-1001234567890:777']);
  assert.equal(idTopicRes.targetId, -1001234567890);
  assert.equal(idTopicRes.targetThreadId, 777);

  assert.equal(parseSendCommand('/send_todos', []).scope, 'todos');
  assert.equal(parseSendCommand('/send', ['todos']).scope, 'todos');
  assert.equal(parseSendCommand('/send_canal', []).scope, 'canal');
  assert.equal(parseSendCommand('/send', ['canais']).scope, 'canal');
  assert.equal(parseSendCommand('/send_grupo', []).scope, 'grupo');
  assert.equal(parseSendCommand('/send', ['grupos']).scope, 'grupo');
  assert.equal(parseSendCommand('/send_lista', []).scope, 'lista');
  assert.equal(parseSendCommand('/send', ['lista']).scope, 'lista');

  const invalidRes = parseSendCommand('/send', ['invalido']);
  assert.equal(invalidRes.isSend, true);
  assert.equal(invalidRes.isInvalid, true);
});

test('trackUser cadastra e atualiza usuários que interagem com o bot', async () => {
  await trackUser({ id: 101, first_name: 'Ana', username: 'ana_dev' });
  const row = sql.prepare('SELECT * FROM list_users WHERE id = 101').get();
  assert.ok(row);
  assert.equal(row.first_name, 'Ana');
  assert.equal(row.username, 'ana_dev');

  // Atualização
  await trackUser({ id: 101, first_name: 'Ana Silva', username: 'ana_silva' });
  const rowUpdated = sql.prepare('SELECT * FROM list_users WHERE id = 101').get();
  assert.equal(rowUpdated.first_name, 'Ana Silva');
});

test('getAllUsers combina usuários de todas as tabelas sem duplicidades', async () => {
  await trackUser({ id: 101, first_name: 'User 101' });
  sql.prepare("INSERT INTO list_chats(id, title, type, owner, updated) VALUES(-101, 'C1', 'channel', 102, 1)").run();
  sql.prepare("INSERT INTO list_promotions(id, user_id, title, url, created) VALUES('p1', 103, 'P1', 'https://t.me/p1', 1)").run();
  sql.prepare("INSERT INTO list_tickets(id, code, user_id, created, updated) VALUES('tk1', 'TK-1', 104, 1, 1)").run();
  sql.prepare("INSERT INTO list_runtime(id, value) VALUES('private_menu:105', '1')").run();

  const allUsers = await getAllUsers();
  assert.deepEqual(allUsers.sort(), [101, 102, 103, 104, 105]);
});

test('não-administrador é bloqueado ao tentar executar comandos /send', async () => {
  await message({
    text: '/send_canal',
    chat: { id: 99999, type: 'private' },
    from: { id: 99999, first_name: 'Membro Comum' }
  });

  const send = calls.find(c => c.name === 'sendMessage' && c.p.chat_id === 99999);
  assert.ok(send);
  assert.match(send.p.text, /Acesso negado/);
});

test('/send sem argumentos exibe mensagem de ajuda aos administradores', async () => {
  await message({
    text: '/send',
    chat: { id: OWNER, type: 'private' },
    from: { id: OWNER, first_name: 'Admin Gabriel' }
  });

  const helpMsg = calls.find(c => c.name === 'sendMessage' && c.p.chat_id === OWNER);
  assert.ok(helpMsg);
  assert.match(helpMsg.p.text, /Central de Envios e Transmissão/);
  assert.match(helpMsg.p.text, /\/send_todos/);
  assert.match(helpMsg.p.text, /\/send_canal/);
  assert.match(helpMsg.p.text, /\/send_grupo/);
  assert.match(helpMsg.p.text, /\/send_lista/);
});

test('/send <id> com mensagem citada copia o conteúdo para o chat indicado', async () => {
  await message({
    text: '/send -100987654321',
    chat: { id: OWNER, type: 'private' },
    from: { id: OWNER, first_name: 'Admin Gabriel' },
    reply_to_message: {
      message_id: 1234,
      chat: { id: OWNER }
    }
  });

  const copyCall = calls.find(c => c.name === 'copyMessage' && c.p.chat_id === -100987654321);
  assert.ok(copyCall, 'deve copiar a mensagem citada');
  assert.equal(copyCall.p.message_id, 1234);

  const confirmMsg = calls.find(c => c.name === 'sendMessage' && c.p.chat_id === OWNER && c.p.text.includes('Mensagem enviada com sucesso'));
  assert.ok(confirmMsg);
});

test('/send <id> <texto> direto sem reply envia o texto para o chat indicado', async () => {
  await message({
    text: '/send -100987654321 Olá, aviso importante!',
    chat: { id: OWNER, type: 'private' },
    from: { id: OWNER, first_name: 'Admin Gabriel' }
  });

  const sendCall = calls.find(c => c.name === 'sendMessage' && c.p.chat_id === -100987654321);
  assert.ok(sendCall, 'deve enviar o texto informado');
  assert.equal(sendCall.p.text, 'Olá, aviso importante!');
});

test('/send_canal transmite mensagem citada para todos os canais cadastrados', async () => {
  sql.prepare("INSERT INTO list_chats(id, title, type, status, owner, updated) VALUES(-101, 'Canal A', 'channel', 'approved', 1, 1)").run();
  sql.prepare("INSERT INTO list_chats(id, title, type, status, owner, updated) VALUES(-102, 'Canal B', 'channel', 'pending', 1, 1)").run();
  sql.prepare("INSERT INTO list_chats(id, title, type, status, owner, updated) VALUES(-103, 'Grupo C', 'supergroup', 'approved', 1, 1)").run();

  await message({
    text: '/send_canal',
    chat: { id: OWNER, type: 'private' },
    from: { id: OWNER, first_name: 'Admin Gabriel' },
    reply_to_message: { message_id: 7777, chat: { id: OWNER } }
  });

  const copies = calls.filter(c => c.name === 'copyMessage' && c.p.message_id === 7777);
  assert.equal(copies.length, 2, 'deve enviar apenas para os 2 canais cadastrados');
  assert.deepEqual(copies.map(c => c.p.chat_id).sort((a, b) => a - b), [-102, -101]);

  const report = calls.find(c => c.name === 'editMessageText' && c.p.text?.includes('Relatório de Transmissão'));
  assert.ok(report);
  assert.match(report.p.text, /Enviados com sucesso:<\/b> 2/);
});

test('/send_grupo transmite mensagem citada para todos os grupos cadastrados', async () => {
  sql.prepare("INSERT INTO list_chats(id, title, type, status, owner, updated) VALUES(-101, 'Canal A', 'channel', 'approved', 1, 1)").run();
  sql.prepare("INSERT INTO list_chats(id, title, type, status, owner, updated) VALUES(-103, 'Grupo 1', 'group', 'approved', 1, 1)").run();
  sql.prepare("INSERT INTO list_chats(id, title, type, status, owner, updated) VALUES(-104, 'Grupo 2', 'supergroup', 'pending', 1, 1)").run();

  await message({
    text: '/send_grupo',
    chat: { id: OWNER, type: 'private' },
    from: { id: OWNER, first_name: 'Admin Gabriel' },
    reply_to_message: { message_id: 8888, chat: { id: OWNER } }
  });

  const copies = calls.filter(c => c.name === 'copyMessage' && c.p.message_id === 8888);
  assert.equal(copies.length, 2, 'deve enviar apenas para os 2 grupos');
  assert.deepEqual(copies.map(c => c.p.chat_id).sort((a, b) => a - b), [-104, -103]);
});

test('/send_lista transmite mensagem para canais e grupos aprovados na lista', async () => {
  sql.prepare("INSERT INTO list_chats(id, title, type, status, owner, updated) VALUES(-101, 'Canal Aprovado', 'channel', 'approved', 1, 1)").run();
  sql.prepare("INSERT INTO list_chats(id, title, type, status, owner, updated) VALUES(-102, 'Grupo Aprovado', 'supergroup', 'approved', 1, 1)").run();
  sql.prepare("INSERT INTO list_chats(id, title, type, status, owner, updated) VALUES(-103, 'Canal Pendente', 'channel', 'pending', 1, 1)").run();

  await message({
    text: '/send_lista Comunicado para os participantes da lista!',
    chat: { id: OWNER, type: 'private' },
    from: { id: OWNER, first_name: 'Admin Gabriel' }
  });

  const sends = calls.filter(c => c.name === 'sendMessage' && c.p.text?.includes('Comunicado para os participantes da lista!'));
  assert.equal(sends.length, 2, 'deve enviar apenas para os chats com status approved');
  assert.deepEqual(sends.map(c => c.p.chat_id).sort((a, b) => a - b), [-102, -101]);
});

test('/send_todos transmite mensagem para canais, grupos e usuários', async () => {
  sql.prepare("INSERT INTO list_chats(id, title, type, status, owner, updated) VALUES(-101, 'Canal 1', 'channel', 'approved', 1, 1)").run();
  sql.prepare("INSERT INTO list_chats(id, title, type, status, owner, updated) VALUES(-102, 'Grupo 1', 'supergroup', 'approved', 1, 1)").run();
  await trackUser({ id: 501, first_name: 'Usuário 1' });
  await trackUser({ id: 502, first_name: 'Usuário 2' });

  await message({
    text: '/send_todos',
    chat: { id: OWNER, type: 'private' },
    from: { id: OWNER, first_name: 'Admin Gabriel' },
    reply_to_message: { message_id: 9999, chat: { id: OWNER } }
  });

  const copies = calls.filter(c => c.name === 'copyMessage' && c.p.message_id === 9999);
  assert.ok(copies.length >= 4, 'deve enviar para canais, grupos e usuários');
  assert.ok(copies.find(c => c.p.chat_id === -101));
  assert.ok(copies.find(c => c.p.chat_id === -102));
  assert.ok(copies.find(c => c.p.chat_id === 501));
  assert.ok(copies.find(c => c.p.chat_id === 502));
});

test('transmissão contabiliza falhas caso um chat bloqueie o bot', async () => {
  sql.prepare("INSERT INTO list_chats(id, title, type, status, owner, updated) VALUES(-101, 'Canal Ok', 'channel', 'approved', 1, 1)").run();
  sql.prepare("INSERT INTO list_chats(id, title, type, status, owner, updated) VALUES(-9999, 'Canal Inválido', 'channel', 'approved', 1, 1)").run();

  await message({
    text: '/send_canal',
    chat: { id: OWNER, type: 'private' },
    from: { id: OWNER, first_name: 'Admin Gabriel' },
    reply_to_message: { message_id: 5555, chat: { id: OWNER } }
  });

  const report = calls.find(c => c.name === 'editMessageText' && c.p.text?.includes('Relatório de Transmissão'));
  assert.ok(report);
  assert.match(report.p.text, /Enviados com sucesso:<\/b> 1/);
  assert.match(report.p.text, /Falhas \/ Bloqueados:<\/b> 1/);
  assert.match(report.p.text, /Total processado:<\/b> 2/);
});
