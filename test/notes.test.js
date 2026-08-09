// notes.test.js — 필기 타임라인 diff 로직 검증 (node --test)
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { diffNewLines, isScaffoldLine, isBusinessDay,
        lineSimilarity, splitEdits, rewriteTimeline } = require('../lib/notes');

test('diffNewLines: 같은 문장을 두 번 적어도 두 번째가 새 줄로 잡힌다', () => {
  const prev = ['중요!', '한 줄'];
  const cur = ['중요!', '한 줄', '중요!'];
  assert.deepStrictEqual(diffNewLines(prev, cur), ['중요!']);
});

test('diffNewLines: 수정된 줄은 새 줄로, 지운 줄은 무시', () => {
  const prev = ['오타 잇는 줄'];
  const cur = ['오타 없는 줄'];
  assert.deepStrictEqual(diffNewLines(prev, cur), ['오타 없는 줄']);
});

test('isScaffoldLine: 틀 헤딩·안내문은 걸러지고 사용자의 #·> 줄은 남는다', () => {
  assert.ok(isScaffoldLine('## 파트1 (09:10~10:15)'));
  assert.ok(isScaffoldLine('# 2026-08-07 (금) 수업 필기'));
  assert.ok(isScaffoldLine('> 각 파트 제목 아래에 자유롭게 적으세요. 저장할 때마다 적은 시각이 함께 기록되어,'));
  assert.ok(!isScaffoldLine('## 내가 만든 소제목'));
  assert.ok(!isScaffoldLine('> 강사님 인용'));
});

test('splitEdits: 오타 수정은 편집으로, 무관한 줄은 새 줄로 분리된다 (A4)', () => {
  const { newLines, edits } = splitEdits(
    ['props는 단방향 (부모→자식)', '완전히 새로운 필기'],
    ['props는 단방향']);
  assert.deepStrictEqual(edits, [{ from: 'props는 단방향', to: 'props는 단방향 (부모→자식)' }]);
  assert.deepStrictEqual(newLines, ['완전히 새로운 필기']);
});

test('lineSimilarity: 접두·접미 공통 비율 — 전혀 다른 줄은 낮다', () => {
  assert.ok(lineSimilarity('useState 훅', 'useState 훅은 상태') >= 0.6);
  assert.ok(lineSimilarity('useState 훅', '라우터 설정') < 0.6);
});

test('rewriteTimeline: 편집된 줄은 원 시각을 유지한 채 제자리 갱신된다 (A4)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lr-tl-'));
  const p = path.join(dir, 'tl.md');
  fs.writeFileSync(p, '[10:05] props는 단방향\n[10:07] 다른 필기\n', 'utf8');
  const leftovers = rewriteTimeline(p, [{ from: 'props는 단방향', to: 'props는 단방향 (부모→자식)' }]);
  assert.deepStrictEqual(leftovers, []);
  const out = fs.readFileSync(p, 'utf8');
  assert.ok(out.includes('[10:05] props는 단방향 (부모→자식)')); // 시각 유지
  assert.ok(!out.includes('[10:05] props는 단방향\n')); // 원 줄 잔존 없음
  // 타임라인에 없는 편집(붙여넣기 등)은 새 줄로 돌려준다
  assert.deepStrictEqual(rewriteTimeline(p, [{ from: '없는 줄', to: '없는 줄 수정' }]), ['없는 줄 수정']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('isBusinessDay: 주말·휴일 제외', () => {
  assert.strictEqual(isBusinessDay(new Date('2026-08-08T10:00:00'), []), false); // 토
  assert.strictEqual(isBusinessDay(new Date('2026-08-07T10:00:00'), []), true);  // 금
  assert.strictEqual(isBusinessDay(new Date('2026-08-07T10:00:00'), ['2026-08-07']), false);
});
