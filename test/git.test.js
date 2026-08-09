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
