import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

const window = new Window();
globalThis.DOMParser = window.DOMParser;

const { sanitizeTelegramHtml, isValidTelegramLink, resolveStyle } = await import('../src/lib/utils.js');

test('prévia remove scripts, eventos e links perigosos', () => {
  assert.equal(
    sanitizeTelegramHtml('<b onclick="alert(1)">Olá</b><script>alert(1)</script>'),
    '<b>Olá</b>'
  );
  assert.equal(
    sanitizeTelegramHtml('<a href="javascript:alert(1)">Clique</a>'),
    '<a>Clique</a>'
  );
  assert.equal(
    sanitizeTelegramHtml('<img src=x onerror="alert(1)">Texto'),
    'Texto'
  );
});

test('prévia usa a mesma validação de link do envio real', () => {
  assert.equal(isValidTelegramLink('https://t.me/canalteste'), true);
  assert.equal(isValidTelegramLink('https://t.me/+Abc_123'), true);
  assert.equal(isValidTelegramLink('https://t.me/joinchat/Abc_123'), true);
  assert.equal(isValidTelegramLink('http://t.me/canalteste'), false);
  assert.equal(isValidTelegramLink('https://t.me.evil.test/canal'), false);
  assert.equal(isValidTelegramLink(''), false);
});

test('cor do layout respeita a cor individual do C/G e as cores globais', () => {
  const settings = {
    chatColors: { 2: 'success' },
    channelColor: 'primary',
    groupColor: 'primary',
    buttonColor: 'danger',
  };

  assert.equal(resolveStyle({ id: 1, type: 'channel' }, settings, 'danger'), 'danger');
  assert.equal(resolveStyle({ id: 1, type: 'channel', style: 'primary' }, settings, 'danger'), 'primary');
  assert.equal(resolveStyle({ id: 2, type: 'channel' }, settings, 'danger'), 'success');
  assert.equal(resolveStyle({ id: 2, type: 'channel', style: 'none' }, settings, 'danger'), '');
  assert.equal(resolveStyle({ id: 3, type: 'group' }, settings, ''), 'primary');
  assert.equal(resolveStyle({ id: 4, type: 'channel' }, settings, ''), 'primary');
});

test('prévia preserva a formatação aceita pelo Telegram', () => {
  assert.equal(
    sanitizeTelegramHtml('<b>Negrito</b> <i>itálico</i><blockquote>citação</blockquote>'),
    '<b>Negrito</b> <i>itálico</i><blockquote>citação</blockquote>'
  );
  assert.equal(
    sanitizeTelegramHtml('<a href="https://t.me/canal" onclick="x()">Canal</a>'),
    '<a href="https://t.me/canal">Canal</a>'
  );
  assert.equal(
    sanitizeTelegramHtml('<span class="tg-spoiler">segredo</span>'),
    '<span class="tg-spoiler">segredo</span>'
  );
});
