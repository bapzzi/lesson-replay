// exportMd.test.js — TIL 원자재 내보내기 형식 검증 (node --test)
const { test } = require('node:test');
const assert = require('node:assert');
const { buildDay } = require('../lib/model');
const { buildExportMd } = require('../lib/exportMd');

const CONFIG = {
  blocks: ['09:10-10:15'], noiseThreshold: 10, excludePrefixes: []
};

test('내보내기: 프롬프트 인용 + 배운 것 + 필기 + diff 코드 펜스가 한 파일에 담긴다', () => {
  const model = buildDay({
    date: '2026-08-07', config: CONFIG,
    notes: [{ id: 'n1', time: '09:30', text: 'json-server 설명', seq: 570 }],
    commits: [{ sha: 's1', time: '09:20', epoch: 0, msg: '', files: [{ path: 'a.js', status: 'A', oldPath: null }] }]
  });
  const scene = model.chapters[0].items.find(i => i.type === 'scene');
  scene.diffText = 'diff --git a/a.js b/a.js\n+const x = 1;';
  const md = buildExportMd(model, { '파트1': '배운 것 정리' }, { prompt: 'TIL 초안을 작성해줘' });
  assert.ok(md.includes('> TIL 초안을 작성해줘'));
  assert.ok(md.includes('> 배운 것 정리'));
  assert.ok(md.includes('📝 09:30 json-server 설명'));
  assert.ok(md.includes('```diff'));
  assert.ok(md.includes('+const x = 1;'));
  assert.ok(!md.includes('diff --git')); // git 헤더는 걸러진다
  assert.ok(!md.includes('스냅샷')); // 수치 표현 없음
});

test('내보내기: 프롬프트를 비우면 원자재만 나간다', () => {
  const model = buildDay({ date: '2026-08-07', config: CONFIG, notes: [], commits: [] });
  const md = buildExportMd(model, {}, { prompt: '' });
  assert.ok(!md.includes('🤖'));
});

test('내보내기: mode·rename 헤더 줄이 걸러지고 diff 예산(3000줄)을 초과하지 않는다 (B4)', () => {
  const model = buildDay({
    date: '2026-08-07', config: CONFIG, notes: [],
    commits: Array.from({ length: 16 }, (_, i) =>
      ({ sha: `s${i}`, time: `09:${String(11 + i).padStart(2, '0')}`, epoch: 0, msg: '',
         files: [{ path: `f${i}.js`, status: 'A', oldPath: null }] }))
  });
  const scenes = model.chapters.flatMap(ch => ch.items).filter(i => i.type === 'scene');
  for (const s of scenes) {
    s.diffText = 'new file mode 100644\n' + Array.from({ length: 250 }, (_, j) => `+line${j}`).join('\n');
  }
  const md = buildExportMd(model, {}, {});
  assert.ok(!md.includes('new file mode'));
  const diffLines = md.split('\n').filter(l => /^  \+line/.test(l)).length;
  assert.ok(diffLines <= 3000, `diff ${diffLines}줄 — 예산 초과`);
  assert.ok(md.includes('생략했습니다')); // 초과분은 생략 안내로 표면화
});
