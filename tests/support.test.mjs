import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';

let sql, calls, sent, isForum, canManageTopics, topicCount, failTopicName, missingTopicIds;
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
          if (failTopicName && String(p.name || '').includes(failTopicName)) {
            throw Object.assign(new Error('Falha simulada ao criar tópico'), { description: 'Falha simulada ao criar tópico' });
          }
          return { message_thread_id: ++topicCount, name: p.name || 'Suporte & Dúvidas' };
        }
        if (name === 'sendMessage' && p.message_thread_id && missingTopicIds.has(Number(p.message_thread_id))) {
          throw Object.assign(new Error('Bad Request: message thread not found'), { description: 'Bad Request: message thread not found' });
        }
        if (name === 'deleteForumTopic' || name === 'closeForumTopic' || name === 'reopenForumTopic') {
          return true;
        }
        if (['sendMessage', 'sendPhoto', 'sendVideo', 'sendAnimation'].includes(name)) {
          return { message_id: ++sent };
        }
        if (['editMessageText', 'editMessageCaption'].includes(name)) {
          return { message_id: p.message_id };
        }
        if (name === 'copyMessage') {
          return { message_id: ++sent };
        }
        if (name === 'deleteMessage') {
          return true;
        }
        if (name === 'editMessageReplyMarkup') return true;
        if (name === 'answerCallbackQuery') return true;
        return true;
      };
    }
  }),
  EndpointError: class extends Error {}
};

globalThis.__SUPPORT_SDK = sdk;
registerHooks({
  resolve(specifier, ctx, next) {
    if (specifier === 'sdk' || specifier === 'sdk/db') return { url: 'test:support_sdk', shortCircuit: true };
    return next(specifier, ctx);
  },
  load(url, ctx, next) {
    if (url === 'test:support_sdk') return { format: 'module', source: 'export const {db,api,EndpointError}=globalThis.__SUPPORT_SDK; export const table=()=>({}), integer=()=>({}), text=()=>({});', shortCircuit: true };
    return next(url, ctx);
  }
});

const {
  initTicketsTable,
  generateTicketCode,
  ensureSupportTopic,
  getActiveTicketForUser,
  getTicketByCode,
  getTicketByThreadId,
  createTicket,
  startTicketService,
  closeTicket,
  reopenTicket,
  relayUserMessage,
  relayAdminMessage
} = await import('../tgcloud/lib/support.js');
const { DEFAULTS, OWNER } = await import('../tgcloud/lib/domain.js');
const { privateScreen } = await import('../tgcloud/lib/navigation.js');
const { default: message } = await import('../tgcloud/handlers/message.js');
const { default: callback } = await import('../tgcloud/handlers/callback_query.js');

beforeEach(() => {
  sql?.close();
  sql = new DatabaseSync(':memory:');
  sql.exec(`
    CREATE TABLE list_runtime(id TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE list_settings(id INTEGER PRIMARY KEY, value TEXT, version INTEGER);
    CREATE TABLE list_chats(id INTEGER PRIMARY KEY, title TEXT, type TEXT, url TEXT DEFAULT '', category INTEGER DEFAULT -1, status TEXT DEFAULT 'draft', owner INTEGER, updated INTEGER, menu_chat INTEGER, menu_id INTEGER, display TEXT DEFAULT '', position INTEGER DEFAULT 0, last_messages TEXT DEFAULT '[]', error TEXT DEFAULT '');
    CREATE TABLE list_tickets(
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
    );
  `);
  const initialSettings = { ...DEFAULTS, promoLogChat: -1001234567890, supportLogTopic: 501 };
  sql.prepare('INSERT INTO list_settings(id,value,version) VALUES(1,?,1)').run(JSON.stringify(initialSettings));
  calls = [];
  sent = 0;
  topicCount = 500;
  failTopicName = null;
  missingTopicIds = new Set();
  isForum = true;
  canManageTopics = true;
});

const pm = (text, extra = {}) => ({
  text,
  chat: { id: 42, type: 'private' },
  from: { id: 42, first_name: 'Gabriel', username: 'gabriel_user' },
  ...extra
});

test('tópico de suporte: verificação e criação no grupo fórum', async () => {
  const res = await ensureSupportTopic(-1001234567890);
  assert.equal(res.ok, true);
  assert.equal(res.isForum, true);
  assert.ok(res.topicId > 0);
  assert.equal(res.name, 'Suporte & Dúvidas');

  const topicCall = calls.find(c => c.name === 'createForumTopic');
  assert.ok(topicCall);
  assert.equal(topicCall.p.name, 'Suporte & Dúvidas');
});

test('aba de suporte: quando não há ticket aberto, solicita que o usuário envie a dúvida diretamente', async () => {
  await privateScreen(42, 'support');
  const send = calls.find(c => c.name === 'sendMessage');
  assert.ok(send);
  assert.match(send.p.text, /Suporte & Atendimento/);
  assert.match(send.p.text, /Envie abaixo uma mensagem detalhando a sua dúvida/);

  const flatButtons = send.p.reply_markup.inline_keyboard.flat();
  assert.ok(flatButtons.find(b => b.callback_data === 'nav:home'), 'deve ter botão voltar ao início');

  const waitingState = sql.prepare("SELECT value FROM list_runtime WHERE id = 'await_support_msg:42'").get();
  assert.equal(JSON.parse(waitingState.value), true, 'estado await_support_msg deve ser ativado');
});

test('fluxo completo do chamado: abertura, triagem, atendimento com criação de tópico, relay e encerramento', async () => {
  // 1. Usuário acessa nav:support no menu de navegação
  await privateScreen(42, 'support');

  // 2. Usuário envia sua dúvida no chat privado
  await message(pm('Olá! Estou com uma dúvida sobre como configurar os horários da lista diária.'));

  // Verifica criação no banco de dados
  const ticketInDb = sql.prepare("SELECT * FROM list_tickets WHERE user_id = 42").get();
  assert.ok(ticketInDb, 'ticket deve ser gravado no banco');
  assert.equal(ticketInDb.status, 'pending');
  assert.equal(ticketInDb.initial_message, 'Olá! Estou com uma dúvida sobre como configurar os horários da lista diária.');
  assert.ok(ticketInDb.code.startsWith('TK-'));

  // Verifica envio da mensagem de triagem no grupo de logs
  const triageMsg = calls.find(c => c.name === 'sendMessage' && c.p.chat_id === -1001234567890);
  assert.ok(triageMsg, 'mensagem de triagem deve ser enviada no grupo de logs');
  assert.match(triageMsg.p.text, new RegExp(ticketInDb.code));
  assert.equal(triageMsg.p.message_thread_id, 501, 'deve ir para o tópico de suporte');

  const triageButtons = triageMsg.p.reply_markup.inline_keyboard.flat();
  const replyBtn = triageButtons.find(b => b.callback_data === `ticket:reply:${ticketInDb.code}`);
  const closeBtn = triageButtons.find(b => b.callback_data === `ticket:close:${ticketInDb.code}`);
  assert.ok(replyBtn, 'deve ter botão responder/atender');
  assert.ok(closeBtn, 'deve ter botão encerrar');

  // Verifica mensagem de wait falando que o admin já vai atender
  const userConfirm = calls.filter(c => c.name === 'sendMessage' && c.p.chat_id === 42).at(-1);
  assert.ok(userConfirm);
  assert.match(userConfirm.p.text, /Por favor, aguarde um momento. Um de nossos administradores já vai te atender!/);

  // 3. Usuário acessa nav:support enquanto ticket está pendente
  calls = [];
  await privateScreen(42, 'support');
  const pendingScreen = calls.find(c => ['sendMessage', 'editMessageText'].includes(c.name));
  assert.ok(pendingScreen);
  assert.match(pendingScreen.p.text, /Solicitação em Andamento/);
  assert.match(pendingScreen.p.text, /Aguardando Administrador/);
  const pendingButtons = pendingScreen.p.reply_markup.inline_keyboard.flat();
  assert.ok(pendingButtons.find(b => b.callback_data === `ticket:user_close:${ticketInDb.code}`));

  // 4. Administrador clica em "Responder / Atender" no grupo de logs
  calls = [];
  await callback({
    id: 'cb2',
    from: { id: OWNER, first_name: 'Admin Gabriel', username: 'admin_gabriel' },
    message: { chat: { id: -1001234567890, type: 'supergroup' }, message_id: triageMsg.p.message_id },
    data: `ticket:reply:${ticketInDb.code}`
  });

  // Verifica que um novo tópico exclusivo foi criado para o ticket
  const createTopicCall = calls.find(c => c.name === 'createForumTopic');
  assert.ok(createTopicCall, 'deve invocar api.createForumTopic');
  assert.match(createTopicCall.p.name, new RegExp(`Ticket #${ticketInDb.code}`));
  const ticketThreadId = createTopicCall.p.name ? topicCount : null;

  // Verifica atualização no banco de dados
  const updatedTicket = sql.prepare("SELECT * FROM list_tickets WHERE code = ?").get(ticketInDb.code);
  assert.equal(updatedTicket.status, 'open');
  assert.equal(updatedTicket.assigned_to, OWNER);
  assert.ok(updatedTicket.thread_id > 0);

  // Verifica mensagem de boas-vindas no novo tópico
  const topicGreeting = calls.find(c => c.name === 'sendMessage' && c.p.chat_id === -1001234567890 && c.p.message_thread_id === updatedTicket.thread_id);
  assert.ok(topicGreeting, 'deve postar mensagem introdutória no tópico do ticket');
  assert.match(topicGreeting.p.text, /Atendimento Iniciado/);

  // Verifica notificação enviada ao usuário avisando que o atendimento começou
  const userNotified = calls.find(c => c.name === 'sendMessage' && c.p.chat_id === 42 && c.p.text.includes('assumiu sua solicitação'));
  assert.ok(userNotified, 'usuário deve ser notificado que o atendente iniciou o chat');

  // 5. Comunicação bidirecional (Relay):
  // 5a. Usuário digita no privado do bot -> mensagem é enviada ao tópico do ticket com alusão ao remetente
  calls = [];
  await message(pm('Quero saber se consigo disparar a lista às 14h e às 22h.'));
  const sendToAdmin = calls.find(c => c.name === 'sendMessage' && c.p.chat_id === -1001234567890 && c.p.message_thread_id === updatedTicket.thread_id);
  assert.ok(sendToAdmin, 'mensagem do usuário deve ser enviada para o tópico exclusivo de suporte com alusão ao remetente');
  assert.match(sendToAdmin.p.text, /💬 <b>\[Gabriel\]:<\/b>\n\nQuero saber se consigo disparar a lista às 14h e às 22h\./);

  // 5b. Administrador responde dentro do tópico do ticket -> mensagem é enviada ao privado do usuário com alusão ao remetente
  calls = [];
  await message({
    text: 'Olá Gabriel! Sim, você pode configurar os horários que desejar em Ajustes > Horários.',
    chat: { id: -1001234567890, type: 'supergroup' },
    message_thread_id: updatedTicket.thread_id,
    from: { id: OWNER, first_name: 'Admin Gabriel' }
  });
  const sendToUser = calls.find(c => c.name === 'sendMessage' && c.p.chat_id === 42);
  assert.ok(sendToUser, 'resposta do admin no tópico deve ser enviada para o chat privado do usuário com alusão ao remetente');
  assert.match(sendToUser.p.text, /💬 <b>\[Admin Gabriel\]:<\/b>\n\nOlá Gabriel! Sim, você pode configurar/);

  // 6. Encerramento do chamado:
  // Administrador envia /encerrar dentro do tópico
  calls = [];
  await message({
    text: '/encerrar',
    chat: { id: -1001234567890, type: 'supergroup' },
    message_thread_id: updatedTicket.thread_id,
    from: { id: OWNER, first_name: 'Admin Gabriel' }
  });

  // Verifica que o tópico foi fechado e o banco foi atualizado
  const closeTopicCall = calls.find(c => c.name === 'closeForumTopic');
  assert.ok(closeTopicCall, 'deve invocar api.closeForumTopic');
  assert.equal(closeTopicCall.p.chat_id, -1001234567890);
  assert.equal(closeTopicCall.p.message_thread_id, updatedTicket.thread_id);

  const finalTicket = sql.prepare("SELECT * FROM list_tickets WHERE code = ?").get(ticketInDb.code);
  assert.equal(finalTicket.status, 'closed');
  assert.equal(finalTicket.thread_id, updatedTicket.thread_id, 'thread_id deve ser preservado para reabertura');
  assert.ok(finalTicket.closed_at > 0);

  // Usuário é notificado sobre a conclusão do atendimento com botão de menu inicial (sem reabrir para o solicitante)
  const userClosedNotice = calls.find(c => c.name === 'sendMessage' && c.p.chat_id === 42 && c.p.text.includes('Atendimento Finalizado'));
  assert.ok(userClosedNotice, 'usuário recebe aviso de encerramento');
  const userClosedButtons = userClosedNotice.p.reply_markup.inline_keyboard.flat();
  assert.equal(userClosedButtons.some(b => b.callback_data === `ticket:user_reopen:${ticketInDb.code}`), false, 'não deve conter botão de reabrir para o solicitante');
  assert.ok(userClosedButtons.find(b => b.callback_data === 'nav:home'), 'deve conter botão de menu principal');

  // Mensagem de triagem no grupo de logs foi atualizada com opção de reabrir pelo admin
  const triageEdit = calls.find(c => c.name === 'editMessageText' && c.p.chat_id === -1001234567890 && c.p.text?.includes('ENCERRADO'));
  assert.ok(triageEdit, 'mensagem de triagem deve ser editada no encerramento');
  const adminClosedButtons = triageEdit.p.reply_markup.inline_keyboard.flat();
  assert.ok(adminClosedButtons.find(b => b.callback_data === `ticket:reopen:${ticketInDb.code}`), 'deve conter botão para o moderador reabrir o chamado');

  // 7. Agora usuário volta ao suporte: aba está limpa para novos chamados
  calls = [];
  await privateScreen(42, 'support');
  const cleanScreen = calls.find(c => ['sendMessage', 'editMessageText'].includes(c.name));
  assert.ok(cleanScreen);
  assert.match(cleanScreen.p.text, /Envie abaixo uma mensagem detalhando a sua dúvida/);
  const waitingAgain = sql.prepare("SELECT value FROM list_runtime WHERE id = 'await_support_msg:42'").get();
  assert.equal(JSON.parse(waitingAgain.value), true, 'tela de suporte deve liberar novo chamado');
});

test('usuário pode encerrar o ticket pelo botão do privado', async () => {
  // Cria ticket aberto diretamente
  const code = 'TK-TEST';
  sql.prepare(`
    INSERT INTO list_tickets (
      id, code, user_id, user_name, user_username, status, initial_message,
      log_chat_id, thread_id, topic_name, created, updated
    ) VALUES (
      't1', ?, 42, 'Gabriel', 'gabriel_user', 'open', 'Dúvida rápida',
      -1001234567890, 777, 'Ticket #TK-TEST', 1000, 1000
    )
  `).run(code);

  calls = [];
  await callback({
    id: 'cb_close',
    from: { id: 42, first_name: 'Gabriel' },
    message: { chat: { id: 42, type: 'private' }, message_id: 88 },
    data: `ticket:user_close:${code}`
  });

  const ticketAfter = sql.prepare("SELECT * FROM list_tickets WHERE code = ?").get(code);
  assert.equal(ticketAfter.status, 'closed');

  const closeTopic = calls.find(c => c.name === 'closeForumTopic');
  assert.ok(closeTopic);
  assert.equal(closeTopic.p.message_thread_id, 777);
});

test('não-administrador não consegue clicar em responder ou encerrar chamado no log', async () => {
  const code = 'TK-BLCK';
  sql.prepare(`
    INSERT INTO list_tickets (
      id, code, user_id, user_name, user_username, status, initial_message,
      log_chat_id, created, updated
    ) VALUES (
      't2', ?, 42, 'Gabriel', 'gabriel_user', 'pending', 'Dúvida',
      -1001234567890, 1000, 1000
    )
  `).run(code);

  calls = [];
  await callback({
    id: 'cb_blocked',
    from: { id: 99999, first_name: 'Intruso' },
    message: { chat: { id: -1001234567890, type: 'supergroup' }, message_id: 99 },
    data: `ticket:reply:${code}`
  });

  const ans = calls.find(c => c.name === 'answerCallbackQuery');
  assert.ok(ans);
  assert.match(ans.p.text, /Apenas administradores/);

  const ticketCheck = sql.prepare("SELECT status FROM list_tickets WHERE code = ?").get(code);
  assert.equal(ticketCheck.status, 'pending', 'status não deve mudar');
});

test('membro comum não consegue responder no tópico de suporte; administrador consegue', async () => {
  const code = 'TK-TOPIC';
  sql.prepare(`
    INSERT INTO list_tickets (
      id, code, user_id, user_name, user_username, status, initial_message,
      log_chat_id, thread_id, created, updated
    ) VALUES (
      't3', ?, 42, 'Gabriel', 'gabriel_user', 'open', 'Dúvida',
      -1001234567890, 777, 1000, 1000
    )
  `).run(code);

  calls = [];
  await message({
    text: 'Mensagem de um membro comum',
    chat: { id: -1001234567890, type: 'supergroup' },
    message_thread_id: 777,
    from: { id: 99999, first_name: 'Intruso' }
  });
  assert.equal(
    calls.some(c => c.name === 'sendMessage' && c.p.chat_id === 42),
    false,
    'mensagem de membro comum não deve chegar ao usuário'
  );
  assert.equal(sql.prepare('SELECT status FROM list_tickets WHERE code = ?').get(code).status, 'open');

  calls = [];
  await message({
    text: 'Resposta do administrador',
    chat: { id: -1001234567890, type: 'supergroup' },
    message_thread_id: 777,
    from: { id: OWNER, first_name: 'Admin Gabriel', username: 'admin_gabriel' }
  });
  assert.ok(
    calls.some(c => c.name === 'sendMessage' && c.p.chat_id === 42),
    'mensagem de administrador deve ser repassada ao usuário'
  );
});

test('usuário encerra chamado enviando comando /encerrar no privado', async () => {
  const code = 'TK-CMD1';
  sql.prepare(`
    INSERT INTO list_tickets (
      id, code, user_id, user_name, user_username, status, initial_message,
      log_chat_id, thread_id, topic_name, created, updated
    ) VALUES (
      't3', ?, 42, 'Gabriel', 'gabriel_user', 'open', 'Dúvida',
      -1001234567890, 888, 'Ticket #TK-CMD1', 1000, 1000
    )
  `).run(code);

  calls = [];
  await message(pm('/encerrar'));

  const ticketAfter = sql.prepare("SELECT status, closed_by FROM list_tickets WHERE code = ?").get(code);
  assert.equal(ticketAfter.status, 'closed');
  assert.equal(ticketAfter.closed_by, 42);

  const closeTopic = calls.find(c => c.name === 'closeForumTopic');
  assert.ok(closeTopic);
  assert.equal(closeTopic.p.message_thread_id, 888);
});

test('reabertura de chamado pelo administrador: reabre tópico existente', async () => {
  const code = 'TK-REOP1';
  sql.prepare(`
    INSERT INTO list_tickets (
      id, code, user_id, user_name, user_username, status, initial_message,
      log_chat_id, log_message_id, thread_id, topic_name, assigned_to, assigned_name,
      created, updated, closed_at, closed_by
    ) VALUES (
      't_reop1', ?, 42, 'Gabriel', 'gabriel_user', 'closed', 'Minha dúvida inicial',
      -1001234567890, 100, 600, 'Ticket #TK-REOP1', 999, 'Antigo Atendente',
      1000, 2000, 2000, 999
    )
  `).run(code);

  calls = [];
  await callback({
    id: 'cb_reopen',
    from: { id: OWNER, first_name: 'Machado' },
    message: { chat: { id: -1001234567890, type: 'supergroup' }, message_id: 100 },
    data: `ticket:reopen:${code}`
  });

  // Tópico existente deve ser reaberto com api.reopenForumTopic
  const reopenTopicCall = calls.find(c => c.name === 'reopenForumTopic');
  assert.ok(reopenTopicCall, 'deve invocar api.reopenForumTopic');
  assert.equal(reopenTopicCall.p.message_thread_id, 600);

  const ticketAfter = sql.prepare("SELECT * FROM list_tickets WHERE code = ?").get(code);
  assert.equal(ticketAfter.status, 'open');
  assert.equal(ticketAfter.thread_id, 600);
  assert.equal(ticketAfter.assigned_to, OWNER);
  assert.equal(ticketAfter.closed_at, null);

  // Mensagem no tópico de atendimento
  const newTopicMsg = calls.find(c => c.name === 'sendMessage' && c.p.chat_id === -1001234567890 && c.p.message_thread_id === 600);
  assert.ok(newTopicMsg);
  assert.match(newTopicMsg.p.text, /Atendimento REABERTO/);

  // Usuário é notificado no privado
  const userNotif = calls.find(c => c.name === 'sendMessage' && c.p.chat_id === 42);
  assert.ok(userNotif);
  assert.match(userNotif.p.text, /Atendimento Reaberto/);

  // Relay bidirecional com alusão ao remetente
  calls = [];
  await message(pm('Obrigado por reabrir! Ainda tenho uma dúvida.'));
  const sendToTopic = calls.find(c => c.name === 'sendMessage' && c.p.chat_id === -1001234567890 && c.p.message_thread_id === 600);
  assert.ok(sendToTopic, 'mensagem do usuário deve ser direcionada ao tópico');
  assert.match(sendToTopic.p.text, /💬 <b>\[Gabriel\]:<\/b>\n\nObrigado por reabrir!/);
});

test('reabertura de chamado: quando tópico não existe mais no Telegram, cria um novo', async () => {
  const code = 'TK-REOP2';
  sql.prepare(`
    INSERT INTO list_tickets (
      id, code, user_id, user_name, user_username, status, initial_message,
      log_chat_id, log_message_id, thread_id, topic_name, assigned_to, assigned_name,
      created, updated, closed_at, closed_by
    ) VALUES (
      't_reop2', ?, 42, 'Gabriel', 'gabriel_user', 'closed', 'Ajuda com canal',
      -1001234567890, 200, NULL, 'Ticket #TK-REOP2', 999, 'Atendente 1',
      1000, 2000, 2000, 999
    )
  `).run(code);

  calls = [];
  await callback({
    id: 'cb_user_reopen',
    from: { id: 42, first_name: 'Gabriel' },
    message: { chat: { id: 42, type: 'private' }, message_id: 300 },
    data: `ticket:user_reopen:${code}`
  });

  // Tópico era NULL, logo deve criar um novo
  const createTopicCall = calls.find(c => c.name === 'createForumTopic');
  assert.ok(createTopicCall, 'deve criar novo tópico quando o anterior não existe');
  assert.match(createTopicCall.p.name, new RegExp(`Ticket #${code}`));

  const reopenedThreadId = createTopicCall.p.name ? topicCount : null;
  const ticketAfter = sql.prepare("SELECT * FROM list_tickets WHERE code = ?").get(code);
  assert.equal(ticketAfter.status, 'open');
  assert.equal(ticketAfter.thread_id, reopenedThreadId);

  // Usuário recebe confirmação de que o chamado foi reaberto
  const userConfirm = calls.find(c => c.name === 'sendMessage' && c.p.chat_id === 42);
  assert.ok(userConfirm);
  assert.match(userConfirm.p.text, /Atendimento Reaberto/);
});

test('comando /start com chamado aberto navega para o menu inicial sem repassar ao tópico', async () => {
  const code = 'TK-NAV';
  sql.prepare(`
    INSERT INTO list_tickets (
      id, code, user_id, user_name, user_username, status, initial_message,
      log_chat_id, thread_id, topic_name, created, updated
    ) VALUES (
      't4', ?, 42, 'Gabriel', 'gabriel_user', 'open', 'Dúvida',
      -1001234567890, 999, 'Ticket #TK-NAV', 1000, 1000
    )
  `).run(code);

  calls = [];
  await message(pm('/start'));

  // Não deve chamar copyMessage para o tópico
  const copyCall = calls.find(c => c.name === 'copyMessage');
  assert.equal(copyCall, undefined, 'comandos /start não devem ser repassados ao tópico');

  // Deve responder com a tela inicial
  const startMsg = calls.find(c => ['sendMessage', 'editMessageText'].includes(c.name));
  assert.ok(startMsg);
  assert.match(startMsg.p.text, /impulsionar a sua comunidade/);
});

test('não permite abrir novo chamado se o usuário já tiver um pendente ou aberto', async () => {
  sql.prepare(`
    INSERT INTO list_tickets (
      id, code, user_id, user_name, user_username, status, initial_message,
      log_chat_id, created, updated
    ) VALUES (
      't5', 'TK-ALRD', 42, 'Gabriel', 'gabriel_user', 'pending', 'Dúvida anterior',
      -1001234567890, 1000, 1000
    )
  `).run();

  const res = await createTicket({ id: 42, first_name: 'Gabriel' }, 'Segunda dúvida');
  assert.equal(res.ok, false);
  assert.equal(res.existing, true);
  assert.match(res.error, /já possui um ticket em andamento/);
});

test('/setlogs no mesmo grupo preserva tópicos existentes e só cria os faltantes', async () => {
  const currentSettings = {
    ...DEFAULTS,
    promoLogChat: -1001234567890,
    promoLogTopic: 888,
    chatsLogTopic: 777,
    supportLogTopic: 0
  };
  sql.prepare('UPDATE list_settings SET value = ? WHERE id = 1').run(JSON.stringify(currentSettings));

  calls = [];
  await message({
    text: '/setlogs -1001234567890',
    chat: { id: -1001234567890, type: 'supergroup' },
    from: { id: OWNER, first_name: 'Admin Gabriel' }
  });

  const topicCreations = calls.filter(c => c.name === 'createForumTopic');
  assert.equal(topicCreations.length, 1, 'apenas o tópico faltante de suporte deve ser criado');
  assert.equal(topicCreations[0].p.name, 'Suporte & Dúvidas');

  const row = sql.prepare('SELECT value FROM list_settings WHERE id = 1').get();
  const saved = JSON.parse(row.value);
  assert.equal(saved.promoLogTopic, 888, 'deve preservar tópico de divulgações');
  assert.equal(saved.chatsLogTopic, 777, 'deve preservar tópico de cadastros');
  assert.ok(saved.supportLogTopic > 0, 'deve ter criado o tópico de suporte');

  const confirmMsg = calls.find(c => c.name === 'sendMessage' && c.p.text?.includes('Status dos tópicos'));
  assert.ok(confirmMsg);
  assert.match(confirmMsg.p.text, /Divulgações pendentes \(ID: <code>888<\/code>\) <i>\[Já configurado\]<\/i>/);
  assert.match(confirmMsg.p.text, /Cadastros pendentes \(ID: <code>777<\/code>\) <i>\[Já configurado\]<\/i>/);
  assert.match(confirmMsg.p.text, /Suporte & Dúvidas \(ID: <code>\d+<\/code>\) <i>\[Criado\]<\/i>/);
});

test('/setlogs cria os três tópicos ausentes e grava cada ID', async () => {
  sql.prepare('UPDATE list_settings SET value = ? WHERE id = 1').run(JSON.stringify({ ...DEFAULTS }));
  calls = [];

  await message({
    text: '/setlogs -1001234567890',
    chat: { id: -1001234567890, type: 'supergroup' },
    from: { id: OWNER, first_name: 'Admin Gabriel' }
  });

  const creations = calls.filter(c => c.name === 'createForumTopic');
  assert.deepEqual(creations.map(c => c.p.name), ['Divulgações pendentes', 'Cadastros pendentes', 'Suporte & Dúvidas']);

  const saved = JSON.parse(sql.prepare('SELECT value FROM list_settings WHERE id = 1').get().value);
  assert.equal(saved.promoLogChat, -1001234567890);
  assert.ok(saved.promoLogTopic > 0);
  assert.ok(saved.chatsLogTopic > 0);
  assert.ok(saved.supportLogTopic > 0);

  const confirm = calls.find(c => c.name === 'sendMessage' && c.p.text?.includes('Status dos tópicos'));
  assert.ok(confirm);
  assert.equal((confirm.p.text.match(/\[Criado\]/g) || []).length, 3);
});

test('/setlogs persiste os tópicos já criados quando um deles falha', async () => {
  sql.prepare('UPDATE list_settings SET value = ? WHERE id = 1').run(JSON.stringify({ ...DEFAULTS }));
  failTopicName = 'Cadastros pendentes';
  calls = [];

  await message({
    text: '/setlogs -1001234567890',
    chat: { id: -1001234567890, type: 'supergroup' },
    from: { id: OWNER, first_name: 'Admin Gabriel' }
  });

  let saved = JSON.parse(sql.prepare('SELECT value FROM list_settings WHERE id = 1').get().value);
  assert.ok(saved.promoLogTopic > 0, 'divulgações devem ser gravadas mesmo com falha depois');
  assert.equal(saved.chatsLogTopic, 0, 'cadastros falharam e devem continuar pendentes');
  assert.ok(saved.supportLogTopic > 0, 'suporte deve ser tentado depois da falha');
  const firstReport = calls.find(c => c.name === 'sendMessage' && c.p.text?.includes('Status dos tópicos'));
  assert.match(firstReport.p.text, /Cadastros pendentes: <b>Falhou<\/b>/);
  assert.match(firstReport.p.text, /novamente para tentar somente os que faltam/);

  failTopicName = null;
  calls = [];
  await message({
    text: '/setlogs -1001234567890',
    chat: { id: -1001234567890, type: 'supergroup' },
    from: { id: OWNER, first_name: 'Admin Gabriel' }
  });

  const retryCreations = calls.filter(c => c.name === 'createForumTopic');
  assert.deepEqual(retryCreations.map(c => c.p.name), ['Cadastros pendentes'], 'a segunda execução deve criar somente o que faltou');
  saved = JSON.parse(sql.prepare('SELECT value FROM list_settings WHERE id = 1').get().value);
  assert.ok(saved.promoLogTopic > 0);
  assert.ok(saved.chatsLogTopic > 0);
  assert.ok(saved.supportLogTopic > 0);
  const retryReport = calls.find(c => c.name === 'sendMessage' && c.p.text?.includes('Status dos tópicos'));
  assert.equal((retryReport.p.text.match(/\[Já configurado\]/g) || []).length, 2);
  assert.equal((retryReport.p.text.match(/\[Criado\]/g) || []).length, 1);
});

test('/setlogs recria um tópico salvo que foi apagado do grupo', async () => {
  const currentSettings = {
    ...DEFAULTS,
    promoLogChat: -1001234567890,
    promoLogTopic: 888,
    chatsLogTopic: 777,
    supportLogTopic: 501
  };
  sql.prepare('UPDATE list_settings SET value = ? WHERE id = 1').run(JSON.stringify(currentSettings));
  missingTopicIds.add(888);
  calls = [];

  await message({
    text: '/setlogs -1001234567890',
    chat: { id: -1001234567890, type: 'supergroup' },
    from: { id: OWNER, first_name: 'Admin Gabriel' }
  });

  const creations = calls.filter(c => c.name === 'createForumTopic');
  assert.deepEqual(creations.map(c => c.p.name), ['Divulgações pendentes']);
  const saved = JSON.parse(sql.prepare('SELECT value FROM list_settings WHERE id = 1').get().value);
  assert.notEqual(saved.promoLogTopic, 888);
  assert.ok(saved.promoLogTopic > 0);
  assert.equal(saved.chatsLogTopic, 777);
  assert.equal(saved.supportLogTopic, 501);
  const confirm = calls.find(c => c.name === 'sendMessage' && c.p.text?.includes('Status dos tópicos'));
  assert.match(confirm.p.text, /Divulgações pendentes.*\[Recriado\]/);
});

test('mensagem de serviço forum_topic_created registra o tópico criado', async () => {
  const currentSettings = { ...DEFAULTS, promoLogChat: -1001234567890, supportLogTopic: 0 };
  sql.prepare('UPDATE list_settings SET value = ? WHERE id = 1').run(JSON.stringify(currentSettings));
  calls = [];

  await message({
    forum_topic_created: { name: 'Suporte & Dúvidas' },
    message_thread_id: 999,
    chat: { id: -1001234567890, type: 'supergroup' },
    from: { id: OWNER, first_name: 'Admin Gabriel' }
  });

  const saved = JSON.parse(sql.prepare('SELECT value FROM list_settings WHERE id = 1').get().value);
  assert.equal(saved.supportLogTopic, 999);
});

test('/settopic vincula um tópico existente aberto no próprio tópico', async () => {
  const currentSettings = { ...DEFAULTS, promoLogChat: 0, supportLogTopic: 0 };
  sql.prepare('UPDATE list_settings SET value = ? WHERE id = 1').run(JSON.stringify(currentSettings));
  calls = [];

  await message({
    text: '/settopic suporte',
    chat: { id: -1001234567890, type: 'supergroup' },
    from: { id: OWNER, first_name: 'Admin Gabriel' },
    message_thread_id: 501
  });

  const saved = JSON.parse(sql.prepare('SELECT value FROM list_settings WHERE id = 1').get().value);
  assert.equal(saved.promoLogChat, -1001234567890);
  assert.equal(saved.supportLogTopic, 501);
  assert.ok(calls.some(c => c.name === 'sendMessage' && c.p.text?.includes('Tópico vinculado')));
});

test('relay de mensagens com mídia aplica alusão ao remetente na legenda', async () => {
  const code = 'TK-MEDIA';
  sql.prepare(`
    INSERT INTO list_tickets (
      id, code, user_id, user_name, user_username, status, initial_message,
      log_chat_id, thread_id, topic_name, created, updated
    ) VALUES (
      't_med', ?, 42, 'Gabriel', 'gabriel_user', 'open', 'Dúvida com imagem',
      -1001234567890, 777, 'Ticket #TK-MEDIA', 1000, 1000
    )
  `).run(code);

  calls = [];
  // Usuário envia foto com legenda
  await message({
    photo: [{ file_id: 'ph123' }],
    caption: 'Veja este print do meu canal',
    chat: { id: 42, type: 'private' },
    from: { id: 42, first_name: 'Gabriel' },
    message_id: 501
  });

  const copyCall = calls.find(c => c.name === 'copyMessage' && c.p.chat_id === -1001234567890 && c.p.message_thread_id === 777);
  assert.ok(copyCall, 'deve invocar copyMessage com a nova legenda atribuída');
  assert.match(copyCall.p.caption, /💬 <b>\[Gabriel\]:<\/b>\n\nVeja este print do meu canal/);

  // Admin responde com foto
  calls = [];
  await message({
    photo: [{ file_id: 'ph456' }],
    caption: 'Aqui está a resposta',
    chat: { id: -1001234567890, type: 'supergroup' },
    message_thread_id: 777,
    from: { id: OWNER, first_name: 'Machado' },
    message_id: 502
  });

  const adminCopyCall = calls.find(c => c.name === 'copyMessage' && c.p.chat_id === 42);
  assert.ok(adminCopyCall, 'deve invocar copyMessage para o usuário com a legenda do admin atribuída');
  assert.match(adminCopyCall.p.caption, /💬 <b>\[Machado\]:<\/b>\n\nAqui está a resposta/);
});

test('quando o usuário envia /start enquanto o bot aguarda a dúvida do suporte, não abre chamado e abre a tela inicial', async () => {
  // Usuário entra no suporte
  await privateScreen(42, 'support');
  const waitingState = sql.prepare("SELECT value FROM list_runtime WHERE id = 'await_support_msg:42'").get();
  assert.equal(JSON.parse(waitingState.value), true);

  // Usuário envia /start em vez da dúvida
  calls = [];
  await message(pm('/start'));

  // Não deve criar ticket
  const ticketInDb = sql.prepare("SELECT * FROM list_tickets WHERE user_id = 42").get();
  assert.equal(ticketInDb, undefined, 'não deve criar ticket ao enviar /start');

  // Estado await_support_msg deve ter sido limpo
  const stateAfter = sql.prepare("SELECT value FROM list_runtime WHERE id = 'await_support_msg:42'").get();
  assert.equal(JSON.parse(stateAfter.value), null);

  // Deve responder com a tela inicial
  const startMsg = calls.find(c => ['sendMessage', 'editMessageText'].includes(c.name));
  assert.ok(startMsg);
  assert.match(startMsg.p.text, /impulsionar a sua comunidade/);
});



