// exportDay.js — 하루치 복기를 md 파일로 내보낸다. 확장(명령·복기 화면 버튼)과 cli.js가 같이 쓴다
// VS Code API에 의존하지 않는다: til 스킬 같은 바깥 도구가 VS Code 없이 내보낼 수 있게
// c = { blocks, notesDir, noiseThreshold, excludePrefixes, paragraphGapMinutes, tilPrompt, includeTilPrompt }
const fs = require('fs');
const path = require('path');
const { commitsForDate, sceneDiff } = require('./git');
const { buildDay } = require('./model');
const { buildExportMd } = require('./exportMd');
const notes = require('./notes');
const reviewData = require('./reviewData');

// 복기노트: 첫 열람 때 타임라인 md에서 시드 → 이후 날짜별 JSON이 단일원천
function loadReviewNotes(root, c, date) {
  let timelineText = '';
  try { timelineText = fs.readFileSync(notes.timelinePath(root, c.notesDir, date), 'utf8'); }
  catch { /* 필기 없음. 선택 사항 */ }
  return reviewData.loadNotes(root, c.notesDir, date, timelineText, c.paragraphGapMinutes);
}

async function buildModel(repo, root, c, date, reviewNotes) {
  const commits = await commitsForDate(repo, date);
  const sceneOps = reviewData.loadSceneOps(root, c.notesDir, date);
  return buildDay({ date, commits, notes: reviewNotes || [], config: { ...c, sceneOps } });
}

// repo = 실습 git 저장소, root = 필기·복기가 쌓이는 곳(archiveDir, 없으면 repo). 반환 = 만든 파일 경로
async function exportDayToFile(repo, root, c, date) {
  const model = await buildModel(repo, root, c, date, loadReviewNotes(root, c, date));
  for (const ch of model.chapters) {
    for (const it of ch.items) {
      // ♻️ 씬은 화면과 같게 "지우기 전 판 ↔ 새 판" 비교
      if (it.type === 'scene') it.diffText = await sceneDiff(repo, it.reworkSha || it.firstSha, it.lastSha, it.file);
    }
  }
  const md = buildExportMd(model, notes.loadSummaries(root, c.notesDir, date),
    { prompt: c.includeTilPrompt ? c.tilPrompt : '' });
  const dir = path.join(root, '복기');
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, `${date}-복기.md`);
  fs.writeFileSync(p, md, 'utf8');
  return p;
}

module.exports = { loadReviewNotes, buildModel, exportDayToFile };
