// recorder.test.js — 파일 감시 제외 규칙 (node --test)
// 목적: ① .git 되먹임 차단 ② 빌드 산출물 churn이 디바운스를 굶기지 않게 ③ 실습 파일은 반드시 통과
const { test } = require('node:test');
const assert = require('node:assert');
const { isIgnoredWatchPath } = require('../lib/recorder');

// VS Code fsPath는 Windows에서 백슬래시로 온다 — 규칙이 두 표기를 모두 흡수하는지 본다
const B = '\\';

test('실습 파일은 감시 대상 — 1.4.0을 만든 SQL 누락 케이스', () => {
  assert.ok(!isIgnoredWatchPath(`C:${B}inspire_6th${B}rds${B}script${B}inspire_rds_6th.sql`));
  assert.ok(!isIgnoredWatchPath(`C:${B}inspire_6th${B}rds${B}script${B}SQL 2일차.sql`)); // 공백·한글 파일명
  assert.ok(!isIgnoredWatchPath(`C:${B}inspire_6th${B}필기${B}2026-08-25.md`));
  assert.ok(!isIgnoredWatchPath('C:/inspire_6th/be/src/main/java/App.java'));
});

test('.git 내부는 제외 — 우리 커밋이 스스로를 다시 깨우지 않게', () => {
  assert.ok(isIgnoredWatchPath(`C:${B}inspire_6th${B}.git${B}index`)); // 백슬래시 표기
  assert.ok(isIgnoredWatchPath('C:/inspire_6th/.git/refs/heads/main')); // 슬래시 표기
});

test('빌드 산출물·의존성 폴더는 제외 — 타이머 굶기기 방지', () => {
  for (const p of ['C:/p/node_modules/react/index.js', 'C:/p/fe/dist/assets/x.js',
                   'C:/p/be/target/classes/A.class', 'C:/p/be/build/libs/a.jar',
                   'C:/p/out/x.txt', 'C:/p/.gradle/cache', 'C:/p/.vscode/settings.json'])
    assert.ok(isIgnoredWatchPath(p), p);
  assert.ok(isIgnoredWatchPath(`C:${B}p${B}fe${B}node_modules${B}react${B}index.js`)); // 백슬래시 표기
});

test('산출물 확장자는 경로와 무관하게 제외', () => {
  assert.ok(isIgnoredWatchPath('C:/p/be/app.log'));
  assert.ok(isIgnoredWatchPath('C:/p/be/A.class'));
  assert.ok(isIgnoredWatchPath('C:/p/be/App.WAR')); // 대소문자 무시
});

test('접두사 함정: 이름이 겹치는 실습 폴더는 제외하지 않는다', () => {
  assert.ok(!isIgnoredWatchPath('C:/p/outbox/memo.txt'));     // out ≠ outbox
  assert.ok(!isIgnoredWatchPath('C:/p/building/note.md'));    // build ≠ building
  assert.ok(!isIgnoredWatchPath('C:/p/src/dist-config.md'));  // dist ≠ dist-config
  assert.ok(!isIgnoredWatchPath('C:/p/src/catalog.sql'));     // .log 접미사 함정
});

test('빈 값·undefined에 터지지 않는다', () => {
  assert.ok(!isIgnoredWatchPath(''));
  assert.ok(!isIgnoredWatchPath(undefined));
});

// ── v1.5.0 토글 신뢰성: 실패 원인 분류(B3) · 묵은 index.lock 정리(B4) ──
const fs = require('fs');
const os = require('os');
const path = require('path');
const { classifyGitError, clearStaleLock } = require('../lib/recorder');

test('classifyGitError: lock·git 없음·권한·기타를 나눈다 (B3)', () => {
  assert.strictEqual(classifyGitError("fatal: Unable to create 'C:/x/.git/index.lock': File exists.").kind, 'lock');
  assert.strictEqual(classifyGitError('spawn git ENOENT').kind, 'nogit');
  assert.strictEqual(classifyGitError('error: open("a.txt"): Permission denied').kind, 'perm');
  const o = classifyGitError('fatal: something else\nsecond line');
  assert.strictEqual(o.kind, 'other');
  assert.strictEqual(o.label, 'fatal: something else');
});

function repoWithLock(ageMs) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'lr-lock-'));
  fs.mkdirSync(path.join(repo, '.git'));
  const lock = path.join(repo, '.git', 'index.lock');
  fs.writeFileSync(lock, '');
  const t = (Date.now() - ageMs) / 1000;
  fs.utimesSync(lock, t, t);
  return { repo, lock };
}

test('clearStaleLock: git 프로세스가 없고 묵은 잠금이면 지운다 (B4)', async () => {
  const { repo, lock } = repoWithLock(60000);
  assert.strictEqual(await clearStaleLock(repo, async () => false), 'cleared');
  assert.ok(!fs.existsSync(lock));
  fs.rmSync(repo, { recursive: true, force: true });
});

test('clearStaleLock: git이 돌고 있거나 방금 생긴 잠금은 건드리지 않는다 (B4)', async () => {
  const a = repoWithLock(60000);
  assert.strictEqual(await clearStaleLock(a.repo, async () => true), 'busy');
  assert.ok(fs.existsSync(a.lock));
  const b = repoWithLock(0);
  assert.strictEqual(await clearStaleLock(b.repo, async () => false), 'fresh');
  assert.ok(fs.existsSync(b.lock));
  assert.strictEqual(await clearStaleLock(os.tmpdir(), async () => false), 'none');
  for (const r of [a.repo, b.repo]) fs.rmSync(r, { recursive: true, force: true });
});
