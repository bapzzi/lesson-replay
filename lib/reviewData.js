// reviewData.js — 복기 화면에서 편집하는 필기의 단일원천(날짜별 JSON)
// 원본 `<date>-타임라인.md`는 건드리지 않는다: 첫 열람 때 시드로 가져오고,
// 이후 타임라인에 "새로 추가된 줄"만 seededLines(소비한 줄 수) 기준으로 이어서 병합한다
// — 복기 화면을 하루 중간에 열어도 오후 필기가 증발하지 않는다.
// JSON 안에서의 수정·삭제·순서 변경은 타임라인으로 되돌리지 않는다(단방향).
const fs = require('fs');
const path = require('path');
const { parseNotes, toMin } = require('./model');

function reviewNotesPath(root, notesDir, date) {
  return path.join(root, notesDir, `${date}-복기노트.json`);
}

// 단락화: 연속 줄의 시각 간격이 gapMinutes 이내면 한 필기로 뭉친다(한 줄씩 끊긴 필기 방지)
function groupLines(parsed, gapMinutes) {
  const gap = gapMinutes == null ? 3 : gapMinutes;
  const grouped = [];
  for (const n of parsed) {
    const last = grouped[grouped.length - 1];
    if (last && toMin(n.time) - toMin(last.endTime) <= gap) {
      last.text += '\n' + n.text;
      last.endTime = n.time;
    } else {
      grouped.push({ time: n.time, endTime: n.time, text: n.text });
    }
  }
  return grouped;
}

// 타임라인 md의 [HH:mm] 줄 → 복기노트 시드. seq = 분(minute) 값 — 타임라인 위 정렬 키
function seedFromTimeline(timelineText, gapMinutes) {
  return groupLines(parseNotes(timelineText), gapMinutes).map((g, i) => ({
    id: `n${i + 1}`, time: g.time, text: g.text, seq: toMin(g.time)
  }));
}

// 구버전 JSON(seededLines 없음)의 시드 경계 추정: 마지막 노트 시각 이전 줄은 시드된 것으로 본다
function legacySeededLines(parsed, notes) {
  if (!notes.length) return parsed.length; // 전부 지운 상태 — 부활시키지 않는다
  const maxSeq = Math.max(...notes.map(n => n.seq || 0));
  return parsed.filter(n => toMin(n.time) <= maxSeq).length;
}

// 복기노트 로드. 파일이 없으면 시드, 있으면 시드 이후 타임라인 추가분만 병합
function loadNotes(root, notesDir, date, timelineText, gapMinutes) {
  const p = reviewNotesPath(root, notesDir, date);
  const parsed = parseNotes(timelineText || '');
  let data = null;
  try { data = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { /* 없거나 깨짐 → 시드 */ }
  if (!data || !Array.isArray(data.notes)) {
    const notes = seedFromTimeline(timelineText || '', gapMinutes);
    if (notes.length) writeNotesFile(p, notes, parsed.length);
    return notes;
  }
  let notes = sortNotes(data.notes);
  const seeded = Number.isInteger(data.seededLines)
    ? data.seededLines : legacySeededLines(parsed, notes);
  if (parsed.length > seeded) {
    const fresh = groupLines(parsed.slice(seeded), gapMinutes).map((g, i) => ({
      id: `t${seeded + i + 1}`, time: g.time, text: g.text, seq: toMin(g.time)
    }));
    notes = sortNotes([...notes, ...fresh]);
    writeNotesFile(p, notes, parsed.length);
  }
  return notes;
}

function writeNotesFile(p, notes, seededLines) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ notes: sortNotes(notes), seededLines }, null, 2), 'utf8');
}

// 웹뷰 저장 경로 — 파일에 있던 seededLines를 보존한다(없으면 legacy 추정 유지)
function saveNotes(root, notesDir, date, notes) {
  const p = reviewNotesPath(root, notesDir, date);
  let seededLines;
  try { seededLines = JSON.parse(fs.readFileSync(p, 'utf8')).seededLines; } catch { /* 첫 저장 */ }
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const data = { notes: sortNotes(notes) };
  if (Number.isInteger(seededLines)) data.seededLines = seededLines;
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

function sortNotes(notes) {
  return [...notes].sort((a, b) => a.seq - b.seq);
}

// ── "다시 볼 것" 마크: 씬 단위 재방문 큐 (키 = "파일경로|시작시각") ──
function marksPath(root, notesDir, date) {
  return path.join(root, notesDir, `${date}-복기마크.json`);
}

function loadMarks(root, notesDir, date) {
  try {
    const data = JSON.parse(fs.readFileSync(marksPath(root, notesDir, date), 'utf8'));
    if (Array.isArray(data.marks)) return data.marks;
  } catch { /* 없음 */ }
  return [];
}

function toggleMark(root, notesDir, date, key) {
  const marks = loadMarks(root, notesDir, date);
  const i = marks.indexOf(key);
  if (i >= 0) marks.splice(i, 1); else marks.push(key);
  const p = marksPath(root, notesDir, date);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ marks }, null, 2), 'utf8');
  return marks;
}

module.exports = { reviewNotesPath, seedFromTimeline, loadNotes, saveNotes,
                   marksPath, loadMarks, toggleMark };
