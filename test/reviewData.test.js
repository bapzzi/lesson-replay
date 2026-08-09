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
