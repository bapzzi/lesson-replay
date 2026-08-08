// reviewData.js — 복기 화면에서 편집하는 필기의 단일원천(날짜별 JSON)
// 원본 `<date>-타임라인.md`는 건드리지 않는다: 첫 열람 때 한 번 시드로 가져온 뒤
// 이후 추가·수정·삭제·순서 변경은 전부 이 JSON에만 반영된다.
const fs = require('fs');
const path = require('path');
const { parseNotes, toMin } = require('./model');

function reviewNotesPath(root, notesDir, date) {
  return path.join(root, notesDir, `${date}-복기노트.json`);
}

// 타임라인 md의 [HH:mm] 줄 → 복기노트 시드. seq = 분(minute) 값 — 타임라인 위 정렬 키
// 단락화: 연속 줄의 시각 간격이 gapMinutes 이내면 한 필기로 뭉친다(한 줄씩 끊긴 필기 방지)
function seedFromTimeline(timelineText, gapMinutes) {
  const gap = gapMinutes == null ? 3 : gapMinutes;
  const grouped = [];
  for (const n of parseNotes(timelineText)) {
    const last = grouped[grouped.length - 1];
    if (last && toMin(n.time) - toMin(last.endTime) <= gap) {
      last.text += '\n' + n.text;
      last.endTime = n.time;
    } else {
      grouped.push({ time: n.time, endTime: n.time, text: n.text });
    }
  }
  return grouped.map((g, i) => ({
    id: `n${i + 1}`, time: g.time, text: g.text, seq: toMin(g.time)
  }));
}

// 복기노트 로드. 파일이 없으면 타임라인에서 시드해 저장 후 반환
function loadNotes(root, notesDir, date, timelineText, gapMinutes) {
  const p = reviewNotesPath(root, notesDir, date);
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (Array.isArray(data.notes)) return sortNotes(data.notes);
  } catch { /* 없거나 깨짐 → 시드 */ }
  const notes = seedFromTimeline(timelineText || '', gapMinutes);
  if (notes.length) saveNotes(root, notesDir, date, notes);
  return notes;
}

function saveNotes(root, notesDir, date, notes) {
  const p = reviewNotesPath(root, notesDir, date);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ notes: sortNotes(notes) }, null, 2), 'utf8');
}

function sortNotes(notes) {
  return [...notes].sort((a, b) => a.seq - b.seq);
}

module.exports = { reviewNotesPath, seedFromTimeline, loadNotes, saveNotes };
