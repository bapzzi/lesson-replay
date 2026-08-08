// notes.test.js — 필기 타임라인 diff 로직 검증 (node --test)
const { test } = require('node:test');
const assert = require('node:assert');
const { diffNewLines, isScaffoldLine, isBusinessDay } = require('../lib/notes');

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

test('isBusinessDay: 주말·휴일 제외', () => {
  assert.strictEqual(isBusinessDay(new Date('2026-08-08T10:00:00'), []), false); // 토
  assert.strictEqual(isBusinessDay(new Date('2026-08-07T10:00:00'), []), true);  // 금
  assert.strictEqual(isBusinessDay(new Date('2026-08-07T10:00:00'), ['2026-08-07']), false);
});
