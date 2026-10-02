// notes.test.js — 필기 타임라인 diff 로직 검증 (node --test)
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { diffNewLines, isScaffoldLine, isBusinessDay, isClassHours, ensureScaffold,
        dateStr, primeShadow, trackSave, trackFile,
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
  assert.ok(isScaffoldLine('## 파트1 (09:10~10:20)dd')); // 제목 뒤에 실수로 붙은 글자
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

test('trackSave: 필기의 빈 줄이 타임라인에도 문단 경계로 남는다 (F1)', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'lr-tk-'));
  const dir = path.join(repo, '필기');
  fs.mkdirSync(dir, { recursive: true });
  const date = dateStr();
  const p = path.join(dir, `${date}.md`);
  fs.writeFileSync(p, '## 파트1 (09:10~10:15)\n', 'utf8');
  primeShadow(repo, '필기'); // 기준선

  trackSave(repo, '필기', p, '## 파트1 (09:10~10:15)\n첫 주제\n이어지는 줄\n\n다른 주제\n');
  const tl = fs.readFileSync(path.join(dir, `${date}-타임라인.md`), 'utf8').split('\n');
  assert.ok(tl[0].endsWith('첫 주제'));
  assert.ok(tl[1].endsWith('이어지는 줄'));
  assert.strictEqual(tl[2], '');            // 빈 줄 = 문단 경계
  assert.ok(tl[3].endsWith('다른 주제'));
  fs.rmSync(repo, { recursive: true, force: true });
});

test('trackFile: VS Code 밖에서 디스크에 직접 쓴 필기도 타임라인에 남는다 (v1.5.0 F1)', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'lr-tf-'));
  const dir = path.join(repo, '필기');
  fs.mkdirSync(dir, { recursive: true });
  const date = dateStr();
  const p = path.join(dir, `${date}.md`);
  fs.writeFileSync(p, '## 파트1 (09:10~10:15)\n', 'utf8');
  primeShadow(repo, '필기');

  fs.writeFileSync(p, '## 파트1 (09:10~10:15)\nIntelliJ에서 적은 줄\n', 'utf8'); // 다른 IDE의 저장
  assert.ok(trackFile(repo, '필기', p));
  assert.ok(trackFile(repo, '필기', p)); // 감시 이벤트가 겹쳐 두 번 와도
  const tl = fs.readFileSync(path.join(dir, `${date}-타임라인.md`), 'utf8').trim().split('\n');
  assert.strictEqual(tl.length, 1); // 한 번만 기록
  assert.match(tl[0], /^\[\d{2}:\d{2}\] IntelliJ에서 적은 줄$/);
  assert.strictEqual(trackFile(repo, '필기', path.join(dir, '없는파일.md')), false);
  fs.rmSync(repo, { recursive: true, force: true });
});

test('trackSave: 줄 끝 공백이 있어도 이어 쓴 줄이 계단식으로 쌓이지 않는다 (F7)', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'lr-tr-'));
  const dir = path.join(repo, '필기');
  fs.mkdirSync(dir, { recursive: true });
  const date = dateStr();
  const p = path.join(dir, `${date}.md`);
  const head = '## 파트1 (09:10~10:15)\n';
  fs.writeFileSync(p, head, 'utf8');
  primeShadow(repo, '필기');

  // 쉼표 뒤 스페이스를 치고 잠깐 멈추면 그 상태로 자동 저장된다 — 실제 사용 패턴
  trackSave(repo, '필기', p, `${head}H/W `);
  trackSave(repo, '필기', p, `${head}H/W, OS, JVM, `);
  trackSave(repo, '필기', p, `${head}H/W, OS, JVM, lib, APP.`);

  const tl = fs.readFileSync(path.join(dir, `${date}-타임라인.md`), 'utf8').trimEnd().split('\n');
  assert.strictEqual(tl.length, 1);          // 중간 버전이 쌓이지 않는다
  assert.ok(tl[0].endsWith('H/W, OS, JVM, lib, APP.'));
  fs.rmSync(repo, { recursive: true, force: true });
});

test('trackSave: 문단을 나눠 저장해도 빈 줄 경계가 남는다 (F8)', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'lr-tp-'));
  const dir = path.join(repo, '필기');
  fs.mkdirSync(dir, { recursive: true });
  const date = dateStr();
  const p = path.join(dir, `${date}.md`);
  const head = '## 파트1 (09:10~10:15)\n';
  fs.writeFileSync(p, head, 'utf8');
  primeShadow(repo, '필기');

  trackSave(repo, '필기', p, `${head}첫 주제\n`);          // 저장 1
  trackSave(repo, '필기', p, `${head}첫 주제\n\n다른 주제\n`); // 저장 2 — 빈 줄로 나눈 새 문단

  const tl = fs.readFileSync(path.join(dir, `${date}-타임라인.md`), 'utf8').trimEnd().split('\n');
  assert.ok(tl[0].endsWith('첫 주제'));
  assert.strictEqual(tl[1], '');             // 저장이 나뉘어도 문단 경계가 살아남는다
  assert.ok(tl[2].endsWith('다른 주제'));
  fs.rmSync(repo, { recursive: true, force: true });
});

test('refreshPartHeadings: 시간표를 고치면 기존 틀의 파트 시각도 따라간다 (F4)', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'lr-rh-'));
  const cfg = { notesDir: '필기', blocks: ['09:10-10:15', '10:15-11:30'], holidays: [] };
  const p = ensureScaffold(repo, cfg, true);
  fs.appendFileSync(p, '내가 적은 필기\n', 'utf8');

  ensureScaffold(repo, { ...cfg, blocks: ['09:10-10:15', '10:30-11:30'] }, true);
  const after = fs.readFileSync(p, 'utf8');
  assert.ok(after.includes('## 파트2 (10:30~11:30)'));
  assert.ok(!after.includes('10:15~11:30'));
  assert.ok(after.includes('내가 적은 필기')); // 본문은 보존

  // 파트 수가 다르면 손대지 않는다
  ensureScaffold(repo, { ...cfg, blocks: ['09:10-10:15'] }, true);
  assert.ok(fs.readFileSync(p, 'utf8').includes('## 파트2 (10:30~11:30)'));
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

// ── 2.0 ① 필기 틀 ──
const notesLib = require('../lib/notes');

test('renderTemplate: 한·영 자리표시를 같은 값으로 바꾸고, 빈 {파트}가 남긴 빈 줄을 정리한다', () => {
  const r = notesLib.renderTemplate('# {날짜} ({요일}) / {date} {weekday}\n\n{파트}\n\n\n## 막힌 것\n',
    { date: '2026-10-05', dow: '월', parts: '' });
  assert.strictEqual(r, '# 2026-10-05 (월) / 2026-10-05 월\n\n## 막힌 것\n');
});

test('ensureScaffold: 틀 파일이 없으면 1.x와 똑같은 기본 틀(시간표 있음)', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'lr-tpl-'));
  const cfg = { notesDir: '필기', blocks: ['09:10-10:20', '10:30-11:30'], holidays: [] };
  const p = notesLib.ensureScaffold(repo, cfg, true);
  const legacy = [`# ${dateStr()} (${['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()]}) 수업 필기`, '',
    '> 각 파트 제목 아래에 자유롭게 적으세요. 저장할 때마다 적은 시각이 함께 기록되어,',
    '> 수업 복기에서 코드 흐름과 자동으로 교차됩니다.', '',
    '## 파트1 (09:10~10:20)', '', '## 파트2 (10:30~11:30)', ''].join('\n');
  assert.strictEqual(fs.readFileSync(p, 'utf8'), legacy);
  fs.rmSync(repo, { recursive: true, force: true });
});

test('ensureScaffold: 사용자가 만든 _틀.md를 쓰고, 시간표가 없으면 요일과 무관하게 만든다', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'lr-tpl2-'));
  const cfg = { notesDir: '필기', blocks: [], holidays: [dateStr()] }; // 오늘을 휴일로 둬도
  fs.mkdirSync(path.join(repo, '필기'));
  fs.writeFileSync(path.join(repo, '필기', '_틀.md'), '# {날짜} 알고리즘\n\n{파트}\n\n## 오늘 문제\n');
  const p = notesLib.ensureScaffold(repo, cfg, false);
  assert.ok(p, '시간표가 없으면 휴일에도 생성');
  assert.strictEqual(fs.readFileSync(p, 'utf8'), `# ${dateStr()} 알고리즘\n\n## 오늘 문제\n`);
  fs.rmSync(repo, { recursive: true, force: true });
});

test('ensureTemplateFile: 없으면 시간표 유무에 맞는 기본 틀로 만들고, 있으면 건드리지 않는다', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'lr-tpl3-'));
  const p = notesLib.ensureTemplateFile(repo, { notesDir: '필기', blocks: [] });
  assert.match(fs.readFileSync(p, 'utf8'), /학습 필기/);
  fs.writeFileSync(p, '내 틀');
  notesLib.ensureTemplateFile(repo, { notesDir: '필기', blocks: ['09:00-10:00'] });
  assert.strictEqual(fs.readFileSync(p, 'utf8'), '내 틀');
  fs.rmSync(repo, { recursive: true, force: true });
});
