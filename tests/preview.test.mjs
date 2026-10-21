import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, makePages } from '../tgcloud/lib/domain.js';
import { buildPreviewPages } from '../src/lib/preview.js';

function normalize(pages) {
  return pages.map((page) => ({
    text: page.text,
    rows: (page.rows || page.reply_markup.inline_keyboard).map((row) =>
      row.map((button) => ({
        text: button.text,
        url: button.url,
        style: button.style || '',
      }))
    ),
  }));
}

const chats = [
  { id: 1, title: 'Canal Beta', display: 'Beta', type: 'channel', url: 'https://t.me/canalbeta', status: 'approved', category: 1, style: 'success' },
  { id: 2, title: 'Grupo Alfa', type: 'group', url: 'https://t.me/grupoalfa', status: 'approved', category: 0 },
  { id: 3, title: 'Canal Gama', type: 'channel', url: 'https://t.me/canalgama', status: 'approved', category: 2 },
  { id: 4, title: 'Pendente', type: 'channel', url: 'https://t.me/pendente', status: 'pending', category: 0 },
  { id: 5, title: 'Inválido', type: 'channel', url: 'javascript:alert(1)', status: 'approved', category: 0 },
  { id: 6, title: 'Grupo Delta', type: 'group', url: 'https://t.me/grupodelta', status: 'approved', category: 0 },
];

const ads = [{ id: 10, title: 'Parceiro', url: 'https://t.me/parceiro', style: 'primary' }];

test('prévia espelha o envio real com layout, cores, categorias, anúncios e paginação', () => {
  const settings = {
    ...DEFAULTS,
    text: 'Olá, comunidade!',
    order: 'rotate',
    groupCategories: true,
    footerButtons: true,
    buttonLayout: {
      enabled: true,
      fill: 'random',
      rows: [
        [
          { kind: 'chat', chatId: 2, style: 'danger' },
          { kind: 'ad', adId: 10, style: 'success' },
          { kind: 'auto', style: 'primary' },
        ],
        [{ kind: 'auto', style: 'primary' }, { kind: 'auto' }],
      ],
    },
  };

  const expected = normalize(makePages(chats, settings, 5, ads, 'TestBot'));
  const actual = normalize(
    buildPreviewPages({ chats, settings, ads, seed: 5, botUsername: 'TestBot' })
  );

  assert.deepEqual(actual, expected);
});

test('prévia fixa divulgação nova ainda sem id usando adKey', () => {
  const newAd = {
    key: 501,
    title: 'Novo parceiro',
    url: 'https://t.me/novoparceiro',
    style: 'success',
  };
  const settings = {
    ...DEFAULTS,
    text: 'Nova divulgação',
    footerButtons: false,
    buttonLayout: {
      enabled: true,
      fill: 'random',
      rows: [
        [{ kind: 'ad', adKey: 501, style: 'danger' }, { kind: 'auto' }],
        [{ kind: 'auto' }, { kind: 'auto' }],
      ],
    },
  };

  const expected = normalize(makePages(chats, settings, 0, [newAd]));
  const actual = normalize(
    buildPreviewPages({ chats, settings, ads: [newAd], seed: 0 })
  );

  assert.deepEqual(actual, expected);
});

test('prévia espelha anúncios antigos por posição e rodapé desativado', () => {
  const legacyAd = {
    title: 'Antigo parceiro',
    url: 'https://t.me/antigoparceiro',
    style: 'danger',
    slot_row: 0,
    slot_col: 1,
  };
  const settings = {
    ...DEFAULTS,
    text: 'Lista antiga',
    order: 'alphabetical',
    groupCategories: false,
    rowPattern: [1, 2],
    footerButtons: false,
    listAdsConfig: { ...DEFAULTS.listAdsConfig, enabled: false },
  };

  const expected = normalize(makePages(chats, settings, 0, [legacyAd]));
  const actual = normalize(
    buildPreviewPages({ chats, settings, ads: [legacyAd], seed: 0 })
  );

  assert.deepEqual(actual, expected);
});
