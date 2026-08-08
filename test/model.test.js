// model.test.js — 스토리 모델 핵심 동작 검증 (node --test)
const { test } = require('node:test');
const assert = require('node:assert');
const { buildDay, parseNotes, parseBlocks } = require('../lib/model');

const CONFIG = {
  blocks: ['09:10-10:15', '10:15-11:30', '13:00-13:45'],
  noiseThreshold: 10, excludePrefixes: ['필기/', '복기/']
};
const c = (sha, time, files) => ({ sha, time, epoch: 0, msg: '', files });
const f = (path, status) => ({ path, status, oldPath: null });

test('parseBlocks: 정렬 후 파트 번호 부여', () => {
  const b = parseBlocks(['13:00-13:45', '09:10-10:15']);
  assert.strictEqual(b[0].label, '파트1');
  assert.strictEqual(b[0].startStr, '09:10');
  assert.strictEqual(b[1].label, '파트2');
});

test('parseNotes: BOM·CRLF 허용, [HH:mm] 줄만', () => {
  const n = parseNotes('﻿[09:12] 첫 필기\r\n잡문\r\n[10:20] 둘째');
  assert.strictEqual(n.length, 2);
  assert.strictEqual(n[0].time, '09:12');
  assert.strictEqual(n[1].text, '둘째');
});

test('같은 파트에서 A↔B 번갈아 저장해도 파일당 씬 1개로 묶인다', () => {
  const day = buildDay({
    date: '2026-08-07', notes: [], config: CONFIG,
    commits: [
      c('s1', '09:20', [f('a.js', 'M')]), c('s2', '09:21', [f('b.js', 'M')]),
      c('s3', '09:22', [f('a.js', 'M')]), c('s4', '09:23', [f('b.js', 'M')])
    ]
  });
  assert.strictEqual(day.sceneCount, 2);
  const part1 = day.chapters.find(ch => ch.label === '파트1');
  assert.strictEqual(part1.items.filter(i => i.type === 'scene').length, 2);
});

test('시간표의 모든 파트는 기록이 없어도 챕터로 유지된다', () => {
  const day = buildDay({
    date: '2026-08-07', notes: [], config: CONFIG,
    commits: [c('s1', '09:20', [f('a.js', 'M')])]
  });
  const parts = day.chapters.filter(ch => ch.isPart);
  assert.strictEqual(parts.length, 3);
  assert.strictEqual(parts[2].items.length, 0);
});

test('삭제 후 재생성은 ♻️로 판정된다', () => {
  const day = buildDay({
    date: '2026-08-07', notes: [], config: CONFIG,
    commits: [
      c('s1', '09:20', [f('a.js', 'A')]),
      c('s2', '10:20', [f('a.js', 'D')]),
      c('s3', '10:30', [f('a.js', 'A')])
    ]
  });
  const scenes = day.chapters.flatMap(ch => ch.items).filter(i => i.type === 'scene');
  const rework = scenes.find(s => s.icon === '♻️');
  assert.ok(rework);
  assert.strictEqual(rework.reworkSha, 's2'); // 지우기 직전 판 비교의 기준 커밋
});

test('noiseThreshold 이상 파일을 건드린 커밋은 🧹로 뭉친다', () => {
  const many = Array.from({ length: 12 }, (_, i) => f(`gen/${i}.js`, 'A'));
  const day = buildDay({
    date: '2026-08-07', notes: [], config: CONFIG,
    commits: [c('s1', '09:20', many)]
  });
  assert.strictEqual(day.noiseCount, 1);
  assert.strictEqual(day.sceneCount, 0);
});

test('복기노트는 seq(분) 기준으로 해당 파트에 교차된다', () => {
  const day = buildDay({
    date: '2026-08-07', config: CONFIG,
    notes: [{ id: 'n1', time: '10:20', text: 'useState 설명', seq: 620 }],
    commits: [c('s1', '10:25', [f('a.js', 'M')])]
  });
  const part2 = day.chapters.find(ch => ch.label === '파트2');
  assert.strictEqual(part2.items[0].type, 'note');
  assert.strictEqual(part2.items[1].type, 'scene');
});

test('같은 파일도 텀이 paragraphGapMinutes를 넘으면 새 단락(씬)으로 나뉜다', () => {
  const day = buildDay({
    date: '2026-08-07', notes: [], config: CONFIG,
    commits: [
      c('s1', '09:20', [f('a.js', 'M')]), c('s2', '09:22', [f('a.js', 'M')]),
      c('s3', '09:40', [f('a.js', 'M')]) // 18분 텀 → 새 단락
    ]
  });
  assert.strictEqual(day.sceneCount, 2);
  const part1 = day.chapters.find(ch => ch.label === '파트1');
  const [sc1, sc2] = part1.items.filter(i => i.type === 'scene');
  assert.strictEqual(sc1.end, '09:22');
  assert.strictEqual(sc2.start, '09:40');
});

test('씬 스탯: 커밋별 numstat(add/del)이 씬 단위로 누적된다', () => {
  const day = buildDay({
    date: '2026-08-07', notes: [], config: CONFIG,
    commits: [
      c('s1', '09:20', [{ path: 'a.js', status: 'M', oldPath: null, add: 10, del: 2 }]),
      c('s2', '09:22', [{ path: 'a.js', status: 'M', oldPath: null, add: 5, del: 1 }])
    ]
  });
  const scene = day.chapters.flatMap(ch => ch.items).find(i => i.type === 'scene');
  assert.deepStrictEqual({ add: scene.stat.add, del: scene.stat.del }, { add: 15, del: 3 });
});

test('드래그로 seq를 바꾸면 씬 사이 어디로든 배치된다 (소수 seq)', () => {
  const day = buildDay({
    date: '2026-08-07', config: CONFIG,
    notes: [{ id: 'n1', time: '', text: '복기 중 추가', seq: 622.5 }],
    commits: [c('s1', '10:20', [f('a.js', 'M')]), c('s2', '10:25', [f('b.js', 'M')])]
  });
  const part2 = day.chapters.find(ch => ch.label === '파트2');
  assert.deepStrictEqual(part2.items.map(i => i.type), ['scene', 'note', 'scene']);
});
