// reviewData.test.js — 복기노트 시드·저장·정렬 검증 (node --test)
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { seedFromTimeline, loadNotes, saveNotes, reviewNotesPath } = require('../lib/reviewData');

test('seedFromTimeline: [HH:mm] 줄 → seq(분) 부여', () => {
  const n = seedFromTimeline('[09:12] 첫 필기\n[10:20] 둘째');
  assert.strictEqual(n.length, 2);
  assert.strictEqual(n[0].seq, 9 * 60 + 12);
  assert.strictEqual(n[1].text, '둘째');
  assert.ok(n[0].id && n[1].id && n[0].id !== n[1].id);
});

test('seedFromTimeline: 3분 이내 연속 줄은 한 단락으로 뭉친다', () => {
  const n = seedFromTimeline(
    '[10:52] 첫 줄\n[10:52] 둘째 줄\n[10:54] 셋째 줄\n[11:00] 새 단락');
  assert.strictEqual(n.length, 2);
  assert.strictEqual(n[0].text, '첫 줄\n둘째 줄\n셋째 줄');
  assert.strictEqual(n[0].time, '10:52');
  assert.strictEqual(n[1].text, '새 단락');
});

test('loadNotes: JSON 없으면 타임라인에서 시드해 저장, 이후엔 JSON이 단일원천', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-'));
  const notes1 = loadNotes(root, '필기', '2026-08-07', '[09:12] 원본 필기');
  assert.strictEqual(notes1[0].text, '원본 필기');
  assert.ok(fs.existsSync(reviewNotesPath(root, '필기', '2026-08-07')));
  // 복기 화면에서 수정 → 타임라인이 아니라 JSON이 읽힌다
  notes1[0].text = '수정된 필기';
  saveNotes(root, '필기', '2026-08-07', notes1);
  const notes2 = loadNotes(root, '필기', '2026-08-07', '[09:12] 원본 필기');
  assert.strictEqual(notes2[0].text, '수정된 필기');
  fs.rmSync(root, { recursive: true, force: true });
});

test('saveNotes/loadNotes: seq 순으로 정렬 유지', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-'));
  saveNotes(root, '필기', '2026-08-07', [
    { id: 'b', time: '', text: '둘째', seq: 620.5 },
    { id: 'a', time: '10:20', text: '첫째', seq: 620 }
  ]);
  const notes = loadNotes(root, '필기', '2026-08-07', '');
  assert.deepStrictEqual(notes.map(n => n.id), ['a', 'b']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('loadNotes: 시드 후 타임라인에 추가된 줄이 다음 로드에서 병합된다 (A1)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-'));
  const first = loadNotes(root, '필기', '2026-08-09', '[09:12] 오전 필기');
  assert.strictEqual(first.length, 1);
  // 점심에 복기 탭을 열었다 닫고, 오후에 필기가 더 쌓인 상황
  const merged = loadNotes(root, '필기', '2026-08-09', '[09:12] 오전 필기\n[17:10] 오후 필기');
  assert.strictEqual(merged.length, 2);
  assert.strictEqual(merged[1].text, '오후 필기');
  assert.strictEqual(merged[1].seq, 17 * 60 + 10);
  // 재로드해도 중복 병합 없음
  const again = loadNotes(root, '필기', '2026-08-09', '[09:12] 오전 필기\n[17:10] 오후 필기');
  assert.strictEqual(again.length, 2);
  fs.rmSync(root, { recursive: true, force: true });
});

test('loadNotes: 병합돼도 복기 화면에서의 수정·삭제는 유지된다', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-'));
  const first = loadNotes(root, '필기', '2026-08-09', '[09:12] 원본 필기');
  first[0].text = '복기에서 고친 필기';
  saveNotes(root, '필기', '2026-08-09', first); // saveNotes가 seededLines를 보존해야 한다
  const merged = loadNotes(root, '필기', '2026-08-09', '[09:12] 원본 필기\n[17:10] 오후 필기');
  assert.strictEqual(merged.length, 2);
  assert.strictEqual(merged[0].text, '복기에서 고친 필기'); // 수정 보존 + 원본 부활 없음
  fs.rmSync(root, { recursive: true, force: true });
});

test('loadNotes: 구버전 JSON(seededLines 없음)도 마지막 노트 이후 줄만 병합한다', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-'));
  const p = reviewNotesPath(root, '필기', '2026-08-09');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({
    notes: [{ id: 'n1', time: '09:12', text: '오전 필기', seq: 552 }]
  }), 'utf8'); // v0.7.0 이전 형식
  const merged = loadNotes(root, '필기', '2026-08-09', '[09:12] 오전 필기\n[17:10] 오후 필기');
  assert.strictEqual(merged.length, 2);
  assert.strictEqual(merged[1].text, '오후 필기');
  fs.rmSync(root, { recursive: true, force: true });
});

test('marks: 토글로 추가·제거되고 파일에 남는다', () => {
  const { loadMarks, toggleMark } = require('../lib/reviewData');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lr-marks-'));
  const key = 'src/App.js|09:18';
  assert.deepStrictEqual(loadMarks(dir, '필기', '2026-08-09'), []);
  toggleMark(dir, '필기', '2026-08-09', key);
  assert.deepStrictEqual(loadMarks(dir, '필기', '2026-08-09'), [key]);
  toggleMark(dir, '필기', '2026-08-09', 'b.js|10:00');
  toggleMark(dir, '필기', '2026-08-09', key); // 해제
  assert.deepStrictEqual(loadMarks(dir, '필기', '2026-08-09'), ['b.js|10:00']);
  fs.rmSync(dir, { recursive: true, force: true });
});
