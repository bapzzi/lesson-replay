// guards.test.js — 중첩 repo 가드의 경로 비교 검증 (node --test)
// P0 사고 재발 방지: git for Windows는 슬래시(C:/...), VS Code fsPath는 백슬래시(C:\...)
const { test } = require('node:test');
const assert = require('node:assert');
const { normPath, isUnder } = require('../lib/guards');

const win = process.platform === 'win32';

test('normPath: 슬래시/백슬래시·끝 구분자·대소문자를 흡수한다', () => {
  if (!win) return; // 경로 규칙이 OS 의존 — 이 확장의 주력은 Windows
  assert.strictEqual(normPath('C:/Users/me/practice'), normPath('c:\\users\\me\\practice\\'));
});

test('isUnder: git 슬래시 toplevel vs fsPath 백슬래시 하위 폴더 (P0 재현 케이스)', () => {
  if (!win) return;
  // 사고 당시: repoTop='C:/Users/user/practice'(git 출력) vs dir='C:\\Users\\user\\practice\\src'
  assert.ok(isUnder('C:/Users/user/practice', 'C:\\Users\\user\\practice\\src'));
  assert.ok(isUnder('C:/Users/user/practice', 'C:\\Users\\user\\practice'));
  assert.ok(!isUnder('C:/Users/user/practice', 'C:\\Users\\user\\other\\src'));
  // 접두사 함정: practice2는 practice의 하위가 아니다
  assert.ok(!isUnder('C:/Users/user/practice', 'C:\\Users\\user\\practice2\\src'));
});
