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

test('prévia espelha o envio real com layout, cores, categorias e anúncios em uma mensagem', () => {
  const settings = {
    ...DEFAULTS,
    text: 'Olá, comunidade!',
    order: 'alphabetical',
    groupCategories: true,
    footerButtons: true,
    buttonLayout: {
      enabled: true,
      fill: 'random',
      rotate: true,
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

  const expected = normalize(
    makePages(chats, settings, 5, ads, 'TestBot', '', { roundIndex: 2, destinationId: 3 })
  );
  const actual = normalize(
    buildPreviewPages({
      chats,
      settings,
      ads,
      seed: 5,
      botUsername: 'TestBot',
      roundIndex: 2,
      destinationId: 3,
    })
  );

  assert.equal(actual.length, 1);
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

test('prévia espelha divulgação aleatória e lista rotativa sem rodapé', () => {
  const rotationAds = [
    { id: 10, title: 'Parceiro Fixo', url: 'https://t.me/parceiro', style: 'primary' },
    { id: 11, title: 'Parceiro Beta', url: 'https://t.me/parceirobeta', style: 'success' },
    { id: 12, title: 'Parceiro Gama', url: 'https://t.me/parceirogama', style: 'danger' },
  ];
  const settings = {
    ...DEFAULTS,
    text: 'Lista rotativa',
    order: 'alphabetical',
    groupCategories: false,
    footerButtons: false,
    buttonLayout: {
      enabled: true,
      fill: 'random',
      rotate: true,
      rows: [
        [{ kind: 'ad', adId: 10 }, { kind: 'adRandom' }],
        [{ kind: 'adRandom' }, { kind: 'auto' }],
      ],
    },
  };

  const expected = normalize(
    makePages(chats, settings, 9, rotationAds, '', '', { roundIndex: 4, destinationId: 6 })
  );
  const actual = normalize(
    buildPreviewPages({
      chats,
      settings,
      ads: rotationAds,
      seed: 9,
      roundIndex: 4,
      destinationId: 6,
    })
  );

  assert.equal(actual.length, 1);
  assert.deepEqual(actual, expected);
});
