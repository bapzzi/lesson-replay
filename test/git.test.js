// git.test.js — git 출력 파서 fixture 검증 (node --test)
// 실제 사고가 나는 곳은 파싱이다 — name-status·numstat(rename)·log -p·날짜 목록
const { test } = require('node:test');
const assert = require('node:assert');
const { parseNameStatusLog, parseNumstat, normalizeNumstatPath,
        parseSignatures, parseDaysList, firstChangedLine } = require('../lib/git');

test('parseNameStatusLog: 커밋·파일·상태·rename oldPath', () => {
  const out = [
    '@@@abc123|1754600400|auto: 09:20 (2 files)',
    'M\tsrc/App.js',
    'R100\tsrc/old.js\tsrc/new.js',
    '@@@def456|1754601000|auto: 09:30 (1 files)',
    'A\tsrc/fresh.js'
  ].join('\n');
  const commits = parseNameStatusLog(out);
  assert.strictEqual(commits.length, 2);
  assert.strictEqual(commits[0].files[0].status, 'M');
  assert.strictEqual(commits[0].files[1].path, 'src/new.js');
  assert.strictEqual(commits[0].files[1].oldPath, 'src/old.js');
  assert.strictEqual(commits[1].files[0].status, 'A');
});

test('normalizeNumstatPath: rename 표기 → 새 이름 (name-status 경로와 매칭)', () => {
  assert.strictEqual(normalizeNumstatPath('src/old.js => src/new.js'), 'src/new.js');
  assert.strictEqual(normalizeNumstatPath('src/{old => new}/a.js'), 'src/new/a.js');
  assert.strictEqual(normalizeNumstatPath('src/plain.js'), 'src/plain.js');
});

test('parseNumstat: sha별 add/del + rename 경로 정규화', () => {
  const out = [
    '@@@abc123',
    '10\t2\tsrc/App.js',
    '5\t0\tsrc/{old => new}/a.js',
    '-\t-\tassets/logo.png' // 바이너리 → 0으로
  ].join('\n');
  const m = parseNumstat(out);
  assert.deepStrictEqual(m.get('abc123').get('src/App.js'), { add: 10, del: 2 });
  assert.deepStrictEqual(m.get('abc123').get('src/new/a.js'), { add: 5, del: 0 });
  assert.deepStrictEqual(m.get('abc123').get('assets/logo.png'), { add: 0, del: 0 });
});

test('parseSignatures: hunk 문맥 우선, 새 파일은 첫 추가 줄 fallback', () => {
  const out = [
    '@@@abc123',
    'diff --git a/src/App.js b/src/App.js',
    '@@ -10,0 +11,2 @@ function App() {',
    '+  const [x, setX] = useState(0);',
    'diff --git a/src/fresh.js b/src/fresh.js',
    '@@ -0,0 +1,3 @@',
    '+export default function Fresh() {'
  ].join('\n');
  const sigs = parseSignatures(out);
  assert.strictEqual(sigs.get('abc123|src/App.js'), 'function App() {');
  assert.strictEqual(sigs.get('abc123|src/fresh.js'), 'export default function Fresh() {');
});

test('parseSignatures: Java package·import·어노테이션은 건너뛰고 클래스·메서드 줄을 쓴다', () => {
  const out = [
    '@@@abc123',
    'diff --git a/src/OpenAiService.java b/src/OpenAiService.java',
    '@@ -0,0 +1,9 @@',
    '+package com.example.inspire_jpa.features.openai.service;',
    '+',
    '+import org.springframework.stereotype.Service;',
    '+@Service',
    '+public class OpenAiService {',
    'diff --git a/src/Ctrl.java b/src/Ctrl.java',
    '@@ -3,0 +4 @@ import lombok.RequiredArgsConstructor;',
    '+    private final OpenAiService svc;',
    'diff --git a/src/Only.java b/src/Only.java',
    '@@ -1 +1 @@',
    '+import java.util.List;'
  ].join('\n');
  const sigs = parseSignatures(out);
  assert.strictEqual(sigs.get('abc123|src/OpenAiService.java'), 'public class OpenAiService {');
  assert.strictEqual(sigs.get('abc123|src/Ctrl.java'), 'private final OpenAiService svc;');
  assert.strictEqual(sigs.get('abc123|src/Only.java'), 'import java.util.List;'); // 전부 잡음이면 첫 후보
});

test('parseDaysList: 중복 제거·최신순·limit — 커밋 수 상한 없음', () => {
  const out = Array.from({ length: 300 }, (_, i) => `2026-08-${String((i % 3) + 1).padStart(2, '0')}`)
    .concat(['2026-07-31']).join('\n');
  const days = parseDaysList(out, 365);
  assert.deepStrictEqual(days, ['2026-08-01', '2026-08-02', '2026-08-03', '2026-07-31']);
});

test('firstChangedLine: 문맥 줄을 지나 첫 +줄의 새 파일 줄 번호', () => {
  const diff = [
    'diff --git a/src/App.jsx b/src/App.jsx',
    '--- a/src/App.jsx', '+++ b/src/App.jsx',
    '@@ -3,6 +3,7 @@ function App() {',
    ' ctx1', ' ctx2', ' ctx3',
    '+  const [x, setX] = useState(0);',
    ' ctx4'
  ].join('\n');
  assert.strictEqual(firstChangedLine(diff), 6); // 시작 3 + 문맥 3줄
});

test('firstChangedLine: 삭제만 있는 hunk는 그 자리의 현재 줄', () => {
  const diff = [
    '@@ -10,4 +10,2 @@',
    ' keep1',
    '-gone1', '-gone2',
    ' keep2'
  ].join('\n');
  assert.strictEqual(firstChangedLine(diff), 11);
});

test('firstChangedLine: hunk 없음(합성 전문 diff 등)=0', () => {
  assert.strictEqual(firstChangedLine('+line1\n+line2'), 0);
  assert.strictEqual(firstChangedLine(''), 0);
});

test('snapshotTarget: 탭 이름이 아니라 query의 실제 경로로 git show 한다', () => {
  const { snapshotTarget } = require('../lib/git');
  assert.deepStrictEqual(snapshotTarget('/abc123/App@1048시점.jsx', 'fe/src/App.jsx'), { sha: 'abc123', file: 'fe/src/App.jsx' });
  assert.deepStrictEqual(snapshotTarget('/abc123^/App@이전.jsx', 'fe/src/App.jsx'), { sha: 'abc123^', file: 'fe/src/App.jsx' });
  assert.deepStrictEqual(snapshotTarget('/abc123/src/App.jsx', ''), { sha: 'abc123', file: 'src/App.jsx' }); // query 없는 옛 주소
});

// ── 2.0 ① 언어 대응: 요약 줄 ──
test('parseSignatures: Python·C·SQL·Node의 가져오기·주석은 건너뛰고, Markdown 제목은 쓴다', () => {
  const out = [
    '@@@s1',
    'diff --git a/a.py b/a.py', '@@ -0,0 +1,3 @@', '+from typing import List', '+# helper', '+def solve(n):',
    'diff --git a/m.c b/m.c', '@@ -0,0 +1,2 @@', '+#include <stdio.h>', '+int main(void) {',
    'diff --git a/q.sql b/q.sql', '@@ -0,0 +1,2 @@', '+-- 2일차', '+SELECT * FROM emp;',
    'diff --git a/s.js b/s.js', '@@ -0,0 +1,3 @@', "+'use strict';", "+const fs = require('fs');", '+export function load() {',
    'diff --git a/n.md b/n.md', '@@ -0,0 +1,1 @@', '+# 오늘 배운 것'
  ].join('\n');
  const sigs = parseSignatures(out);
  assert.strictEqual(sigs.get('s1|a.py'), 'def solve(n):');
  assert.strictEqual(sigs.get('s1|m.c'), 'int main(void) {');
  assert.strictEqual(sigs.get('s1|q.sql'), 'SELECT * FROM emp;');
  assert.strictEqual(sigs.get('s1|s.js'), 'export function load() {');
  assert.strictEqual(sigs.get('s1|n.md'), '# 오늘 배운 것');
});

test('daySignatures: 실제 git으로 Python 함수·JS 화살표 함수 문맥을 잡는다(저장소에는 아무것도 쓰지 않음)', async () => {
  const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
  const { daySignatures } = require('../lib/git');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'lr-sig-'));
  const g = (...a) => cp.execFileSync('git', ['-C', repo, ...a], { stdio: 'pipe' });
  g('init', '-q'); g('config', 'user.email', 'sig@test.local'); g('config', 'user.name', 's');
  const pad = Array.from({ length: 8 }, (_, i) => `    x${i} = ${i}`).join('\n');
  fs.writeFileSync(path.join(repo, 'a.py'), `import os\n\ndef solve(n):\n${pad}\n    return n\n`);
  const jsPad = Array.from({ length: 8 }, (_, i) => `  const v${i} = ${i};`).join('\n');
  fs.writeFileSync(path.join(repo, 'b.js'), `import x from 'x';\n\nexport const load = async (id) => {\n${jsPad}\n  return id;\n};\n`);
  g('add', '-A'); g('commit', '-q', '-m', 'one');
  fs.writeFileSync(path.join(repo, 'a.py'), `import os\n\ndef solve(n):\n${pad}\n    return n * 2\n`);
  fs.writeFileSync(path.join(repo, 'b.js'), `import x from 'x';\n\nexport const load = async (id) => {\n${jsPad}\n  return id + 1;\n};\n`);
  g('add', '-A'); g('commit', '-q', '-m', 'two');
  const sha = g('rev-parse', 'HEAD').toString().trim();
  const today = new Date(); const d = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const sigs = await daySignatures(repo, d);
  assert.strictEqual(sigs.get(`${sha}|a.py`), 'def solve(n):');
  assert.strictEqual(sigs.get(`${sha}|b.js`), 'export const load = async (id) => {');
  assert.ok(!fs.existsSync(path.join(repo, '.gitattributes')));
  fs.rmSync(repo, { recursive: true, force: true });
});
