// i18n.test.js: 문구 사전(lib/i18n.js · package.nls.json) 규칙 검증 (node --test)
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { t, dict, ko } = require('../lib/i18n');

test('t: {name} 자리를 vars로 채우고, 모르는 키는 키 그대로 돌려준다', () => {
  assert.strictEqual(t('web.segments', { n: 3 }), '3구간');
  assert.strictEqual(t('panel.titleDate', { date: '2026-10-02' }), '복기 2026-10-02');
  assert.strictEqual(t('no.such.key'), 'no.such.key');
  assert.strictEqual(t('no.such.key', { n: 1 }), 'no.such.key');
});

test('t: 한 번에 치환한다(넣은 값 안의 {x}는 다시 바꾸지 않음), vars에 없는 자리는 남긴다', () => {
  assert.strictEqual(t('web.filterStat', { name: '{n}', n: 2 }), '{n} · 씬 2');
  assert.strictEqual(t('web.filterStat', { n: 2 }), '{name} · 씬 2');
  assert.strictEqual(t('export.flowNote', { when: '', text: '$& $1' }), '필기 · $& $1'); // replace 특수 패턴 무시
});

test('t: 필기 틀 자리표시 {날짜}{요일}{파트}는 건드리지 않는다', () => {
  assert.strictEqual(t('notify.templateHint', { 날짜: 'x' }), ko['notify.templateHint']);
  assert.ok(t('notes.tplClassTitle', {}).includes('{날짜}'));
});

test('dict: 접두사로 시작하는 키만 담는다', () => {
  const d = dict('web.');
  assert.ok(Object.keys(d).length > 0);
  assert.ok(Object.keys(d).every(k => k.startsWith('web.')));
  assert.strictEqual(d['web.noChange'], ko['web.noChange']);
});

test('package.json의 %key%는 전부 package.nls.json에 있다', () => {
  const root = path.join(__dirname, '..');
  const pkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
  const nls = JSON.parse(fs.readFileSync(path.join(root, 'package.nls.json'), 'utf8'));
  const keys = [...pkg.matchAll(/"%([^%"]+)%"/g)].map(m => m[1]);
  assert.ok(keys.length > 0);
  assert.deepStrictEqual(keys.filter(k => !(k in nls)), []);
});
