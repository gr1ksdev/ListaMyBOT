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
        if (name === 'getMe') return { id: 999, username: 'ListaMyBOT' };
        if (name === 'sendMessage') return { message_id: ++sent };
        return true;
      };
    }
  }),
  EndpointError: class extends Error {}
};

globalThis.__TEST_LIST_SDK = sdk;
registerHooks({
  resolve(specifier, ctx, next) {
    if (specifier === 'sdk' || specifier === 'sdk/db') return { url: 'test:test_list_sdk', shortCircuit: true };
    return next(specifier, ctx);
  },
  load(url, ctx, next) {
    if (url === 'test:test_list_sdk') {
      return {
        format: 'module',
        source: 'export const {db,api,EndpointError}=globalThis.__TEST_LIST_SDK; export const table=()=>({}), integer=()=>({}), text=()=>({});',
        shortCircuit: true
      };
    }
    return next(url, ctx);
  }
});

const { default: testList } = await import('../tgcloud/endpoints/testList.js');
const { DEFAULTS, OWNER } = await import('../tgcloud/lib/domain.js');
const { supplementTestData } = await import('../tgcloud/lib/test_list.js');

function saveSettings(overrides = {}) {
  sql.prepare('INSERT INTO list_settings(id,value,version) VALUES(1,?,1)')
    .run(JSON.stringify({ ...DEFAULTS, ...overrides }));
}

function addChat({ id, title, type = 'channel', url, status = 'approved' }) {
  sql.prepare('INSERT INTO list_chats(id,title,type,url,status,category,position,updated) VALUES(?,?,?,?,?,0,0,1)')
    .run(id, title, type, url, status);
}

const adminCtx = { initData: { user: { id: OWNER } } };
const messages = () => calls.filter(c => c.name === 'sendMessage').map(c => c.p);
const buttons = () => messages().flatMap(m => m.reply_markup?.inline_keyboard?.flat() || []);

beforeEach(() => {
  sql?.close();
  sql = new DatabaseSync(':memory:');
  sql.exec(`
    CREATE TABLE list_settings(id INTEGER PRIMARY KEY, value TEXT, version INTEGER);
    CREATE TABLE list_chats(
      id INTEGER PRIMARY KEY, title TEXT, type TEXT, url TEXT DEFAULT '',
      category INTEGER DEFAULT -1, status TEXT DEFAULT 'draft', owner INTEGER,
      updated INTEGER, menu_chat INTEGER, menu_id INTEGER, display TEXT DEFAULT '',
      position INTEGER DEFAULT 0, last_messages TEXT DEFAULT '[]', error TEXT DEFAULT ''
    );
    CREATE TABLE list_ads(
      id INTEGER PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL DEFAULT '',
      slot_row INTEGER NOT NULL DEFAULT 0, slot_col INTEGER NOT NULL DEFAULT 0,
      style TEXT NOT NULL DEFAULT '', updated INTEGER NOT NULL
    );
  `);
  calls = [];
  sent = 0;
});

const twoAutoCells = { enabled: true, fill: 'random', rows: [[{ kind: 'auto' }, { kind: 'auto' }]] };

test('teste complementa somente os canais/grupos ausentes e ignora links inválidos', () => {
  const real = { id: -1001, title: 'Canal Real', type: 'channel', url: 'https://t.me/canalreal', status: 'approved' };
  const invalid = { id: -1002, title: 'Canal Inválido', type: 'channel', url: 'javascript:alert(1)', status: 'approved' };
  const result = supplementTestData([real, invalid], [], {
    ...DEFAULTS,
    buttonLayout: { enabled: true, fill: 'channel', rows: [[{ kind: 'auto' }, { kind: 'auto' }]] }
  });

  assert.equal(result.chats.length, 2);
  assert.ok(result.chats.some(c => c.title === 'Canal Real'));
  assert.equal(result.chats.filter(c => c.title === 'Canal de Teste 1').length, 1);
  assert.equal(result.chats.some(c => c.title === 'Canal Inválido'), false);
  assert.equal(result.usedFake, true);
});

test('teste cria divulgação fictícia para posição fixa sem cadastro', () => {
  const result = supplementTestData([], [], {
    ...DEFAULTS,
    buttonLayout: { enabled: true, fill: 'random', rows: [[{ kind: 'ad', adId: 77 }]] }
  });

  assert.equal(result.ads.length, 1);
  assert.equal(result.ads[0].id, 77);
  assert.equal(result.ads[0].title, 'Divulgação de Teste 1');
  assert.equal(result.usedFake, true);
});

test('teste com banco vazio envia lista fictícia e não grava nada', async () => {
  saveSettings({ footerButtons: false, buttonLayout: twoAutoCells });

  await testList({}, adminCtx);

  assert.equal(sql.prepare('SELECT count(*) AS n FROM list_chats').get().n, 0);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM list_ads').get().n, 0);
  assert.match(messages()[0].text, /Modo de teste/);
  assert.equal(buttons().length, 2);
  assert.ok(buttons().every(b => /de Teste/.test(b.text)));
});

test('teste usa dados reais e completa apenas a quantidade faltante', async () => {
  saveSettings({ footerButtons: false, buttonLayout: { ...twoAutoCells, fill: 'random' } });
  addChat({ id: -1001, title: 'Canal Real', type: 'channel', url: 'https://t.me/canalreal' });

  await testList({}, adminCtx);

  assert.equal(sql.prepare('SELECT count(*) AS n FROM list_chats').get().n, 1);
  assert.match(messages()[0].text, /Modo de teste/);
  assert.ok(buttons().some(b => b.text === 'Canal Real'));
  assert.ok(buttons().some(b => /de Teste/.test(b.text)));
});

test('teste sem dados fictícios não envia aviso quando a lista real basta', async () => {
  saveSettings({
    footerButtons: false,
    buttonLayout: { enabled: true, fill: 'channel', rows: [[{ kind: 'auto' }, { kind: 'auto' }]] }
  });
  addChat({ id: -1001, title: 'Canal A', type: 'channel', url: 'https://t.me/canala' });
  addChat({ id: -1002, title: 'Canal B', type: 'channel', url: 'https://t.me/canalb' });

  await testList({}, adminCtx);

  assert.equal(messages().some(m => /Modo de teste/.test(m.text || '')), false);
  assert.deepEqual(buttons().map(b => b.text).sort(), ['Canal A', 'Canal B']);
});

test('teste do modo simples envia canais e grupos fictícios separadamente', async () => {
  saveSettings({ listType: 'simple', footerButtons: false, buttonLayout: { enabled: false } });

  await testList({}, adminCtx);

  const texts = messages().map(m => m.text);
  assert.ok(texts.some(t => /Lista Simples — Canais/.test(t)));
  assert.ok(texts.some(t => /Lista Simples — Grupos/.test(t)));
  assert.ok(buttons().some(b => /^Canal de Teste/.test(b.text)));
  assert.ok(buttons().some(b => /^Grupo de Teste/.test(b.text)));
  assert.equal(sql.prepare('SELECT count(*) AS n FROM list_chats').get().n, 0);
});
