// notes.test.js — 필기 타임라인 diff 로직 검증 (node --test)
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { diffNewLines, isScaffoldLine, isBusinessDay, isClassHours, ensureScaffold,
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

test('ensureScaffold: 필기 폴더에 markdownlint 해제 파일을 함께 깐다 (자유 서술 경고 방지)', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'lr-sc-'));
  const p = ensureScaffold(repo, { notesDir: '필기', blocks: ['09:10-10:15'], holidays: [] }, true);
  const cfg = path.join(repo, '필기', '.markdownlint.json');
  assert.ok(fs.existsSync(p));
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(cfg, 'utf8')), { default: false });
  // 사용자가 고친 설정은 덮어쓰지 않는다 (틀이 이미 있는 날에도 마찬가지)
  fs.writeFileSync(cfg, '{"MD012": false}', 'utf8');
  ensureScaffold(repo, { notesDir: '필기', blocks: ['09:10-10:15'], holidays: [] }, true);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(cfg, 'utf8')), { MD012: false });
  fs.rmSync(repo, { recursive: true, force: true });
});

test('isClassHours: 첫 파트 시작~마지막 파트 끝 사이만 (기록 꺼짐 알림 조건)', () => {
  const blocks = ['09:10-10:15', '13:00-13:45', '16:45-17:50'];
  assert.strictEqual(isClassHours(blocks, new Date('2026-08-10T09:09:00')), false); // 시작 직전
  assert.strictEqual(isClassHours(blocks, new Date('2026-08-10T09:10:00')), true);
  assert.strictEqual(isClassHours(blocks, new Date('2026-08-10T12:00:00')), true);  // 파트 사이 쉬는 시간도 수업 중
  assert.strictEqual(isClassHours(blocks, new Date('2026-08-10T17:50:00')), true);
  assert.strictEqual(isClassHours(blocks, new Date('2026-08-10T17:51:00')), false); // 종료 후
  assert.strictEqual(isClassHours([], new Date('2026-08-10T10:00:00')), false);     // 시간표 없음 = 침묵
});

test('isBusinessDay: 주말·휴일 제외', () => {
  assert.strictEqual(isBusinessDay(new Date('2026-08-08T10:00:00'), []), false); // 토
  assert.strictEqual(isBusinessDay(new Date('2026-08-07T10:00:00'), []), true);  // 금
  assert.strictEqual(isBusinessDay(new Date('2026-08-07T10:00:00'), ['2026-08-07']), false);
});
