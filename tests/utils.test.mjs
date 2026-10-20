import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

const window = new Window();
globalThis.DOMParser = window.DOMParser;

const { sanitizeTelegramHtml } = await import('../src/lib/utils.js');

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
