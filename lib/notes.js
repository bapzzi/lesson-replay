// notes.js — 필기 틀 생성(영업일)·필기 타임라인 기록·파트별 한 줄 정리 저장
const fs = require('fs');
const path = require('path');
const { parseBlocks } = require('./model');

function dateStr(d) {
  d = d || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function timeStr(d) {
  d = d || new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// 영업일 판정: 주말 + 설정된 휴일 제외
function isBusinessDay(d, holidays) {
  d = d || new Date();
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  return !(holidays || []).includes(dateStr(d));
}

function notesPath(repo, notesDir, date) { return path.join(repo, notesDir, `${date}.md`); }
function timelinePath(repo, notesDir, date) { return path.join(repo, notesDir, `${date}-타임라인.md`); }
function summaryPath(repo, notesDir, date) { return path.join(repo, notesDir, `${date}-한줄정리.json`); }

// 필기는 자유 서술이라 markdownlint 류의 문서 규격 검사가 붙으면 온통 경고가 된다
// (제목 아래 빈 줄·연속 빈 줄 등). 필기 폴더 한정으로 검사를 꺼 둔다. 이미 있으면 존중.
function ensureLintOptOut(dir) {
  const p = path.join(dir, '.markdownlint.json');
  if (fs.existsSync(p)) return;
  try { fs.writeFileSync(p, '{\n  "default": false\n}\n', 'utf8'); } catch { /* 없어도 필기엔 지장 없음 */ }
}

// 필기 틀: 파트 헤딩을 미리 깔아 둔 md (이미 있으면 건드리지 않음)
// 자동 생성은 영업일만, force=true(사용자가 직접 요청)면 주말·휴일에도 생성
function ensureScaffold(repo, config, force) {
  if (!repo) return null;
  if (!force && !isBusinessDay(new Date(), config.holidays)) return null;
  const date = dateStr();
  const p = notesPath(repo, config.notesDir, date);
  if (fs.existsSync(p)) { ensureLintOptOut(path.dirname(p)); return p; }
  const blocks = parseBlocks(config.blocks);
  const dow = ['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()];
  const body = [
    `# ${date} (${dow}) 수업 필기`,
    '',
    '> 각 파트 제목 아래에 자유롭게 적으세요. 저장할 때마다 적은 시각이 함께 기록되어,',
    '> 수업 복기에서 코드 흐름과 자동으로 교차됩니다.',
    '',
    ...blocks.flatMap(b => [`## ${b.label} (${b.startStr}~${b.endStr})`, '']),
  ].join('\n');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body, 'utf8');
  ensureLintOptOut(path.dirname(p));
  return p;
}

// 틀에서 자동 생성된 줄인가 — 타임라인에 넣지 않는다 (사용자가 쓴 #·> 줄은 기록 대상)
function isScaffoldLine(l) {
  const t = l.trim();
  if (!t) return true;
  if (/^# \d{4}-\d{2}-\d{2}.*수업 필기$/.test(t)) return true;
  if (/^## .+\(\d{2}:\d{2}~\d{2}:\d{2}\)$/.test(t)) return true;
  if (t.startsWith('> 각 파트 제목') || t.startsWith('> 수업 복기에서')) return true;
  return false;
}

// 멀티셋 diff: 같은 문장을 두 번 적어도 두 번째가 새 줄로 잡힌다
function diffNewLines(prev, cur) {
  const cnt = new Map();
  for (const l of prev) cnt.set(l, (cnt.get(l) || 0) + 1);
  const added = [];
  for (const l of cur) {
    const c = cnt.get(l) || 0;
    if (c > 0) cnt.set(l, c - 1);
    else added.push(l);
  }
  return added;
}

// 두 줄의 유사도(0~1): 공통 접두+접미 비율 — 오타 수정·꼬리 덧붙임을 "같은 줄의 편집"으로 본다
function lineSimilarity(a, b) {
  const max = Math.max(a.length, b.length);
  if (!max) return 1;
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  if (p + s >= Math.min(a.length, b.length)) return 1; // 순수 덧붙임/잘라냄 — 짧은 쪽이 통째로 남아 있다
  return (p + s) / max;
}

// 새 줄 vs 편집 분리: 지워진 줄과 60% 이상 겹치는 새 줄 = 편집(짝 지음), 나머지 = 진짜 새 줄
function splitEdits(added, removed) {
  const pool = [...removed];
  const newLines = [], edits = [];
  for (const l of added) {
    let best = -1, bestSim = 0;
    pool.forEach((r, i) => {
      const s = lineSimilarity(r, l);
      if (s > bestSim) { bestSim = s; best = i; }
    });
    if (best >= 0 && bestSim >= 0.6) { edits.push({ from: pool[best], to: l }); pool.splice(best, 1); }
    else newLines.push(l);
  }
  return { newLines, edits };
}

// 편집된 줄을 타임라인에서 제자리 갱신(원 시각 유지·중복 없음). 못 찾은 편집은 새 줄로 반환
function rewriteTimeline(p, edits) {
  let lines;
  try { lines = fs.readFileSync(p, 'utf8').split(/\r?\n/); }
  catch { return edits.map(e => e.to); } // 타임라인 자체가 없으면 전부 새 줄 취급
  const leftovers = [];
  let changed = false;
  for (const e of edits) {
    let done = false;
    for (let i = lines.length - 1; i >= 0; i--) { // 최근 것부터 — 같은 문장 반복 시 마지막 기록을 갱신
      const m = lines[i].match(/^\[(\d{2}:\d{2})\] (.*)$/);
      if (m && m[2] === e.from) { lines[i] = `[${m[1]}] ${e.to}`; done = changed = true; break; }
    }
    if (!done) leftovers.push(e.to);
  }
  if (changed) fs.writeFileSync(p, lines.join('\n'), 'utf8');
  return leftovers;
}

// 필기 저장 → 이전 내용과 비교해 새 줄만 [HH:mm]으로 타임라인에 축적
const shadow = new Map(); // fsPath -> lines[]

function primeShadow(repo, notesDir) {
  const p = notesPath(repo, notesDir, dateStr());
  if (fs.existsSync(p) && !shadow.has(p)) {
    shadow.set(p, fs.readFileSync(p, 'utf8').replace(/^﻿/, '').split(/\r?\n/));
  }
}

// 저장된 문서가 오늘 필기면 새 줄을 타임라인에 기록. 처리했으면 true
function trackSave(repo, notesDir, savedFsPath, text) {
  const date = dateStr();
  const p = notesPath(repo, notesDir, date);
  if (path.normalize(savedFsPath) !== path.normalize(p)) return false;
  const cur = text.replace(/^﻿/, '').split(/\r?\n/);
  const prev = shadow.get(p);
  shadow.set(p, cur);
  if (!prev) return true; // 첫 저장은 기준선만 (틀 자체를 타임라인에 넣지 않음)
  const added = diffNewLines(prev, cur).filter(l => !isScaffoldLine(l));
  const removed = diffNewLines(cur, prev).filter(l => !isScaffoldLine(l));
  // 오타 수정 등 기존 줄의 편집은 타임라인 원 줄을 제자리 갱신(시각 유지) — 중복·시각 왜곡 방지
  const { newLines, edits } = splitEdits(added, removed);
  const tl = timelinePath(repo, notesDir, date);
  const pending = edits.length ? [...newLines, ...rewriteTimeline(tl, edits)] : newLines;
  if (pending.length) {
    const t = timeStr();
    fs.appendFileSync(tl, pending.map(l => `[${t}] ${l}`).join('\n') + '\n', 'utf8');
  }
  return true;
}

// 파트별 한 줄 정리 — 필기 폴더의 json에 저장
function loadSummaries(repo, notesDir, date) {
  try { return JSON.parse(fs.readFileSync(summaryPath(repo, notesDir, date), 'utf8')); }
  catch { return {}; }
}
function saveSummary(repo, notesDir, date, part, text) {
  const p = summaryPath(repo, notesDir, date);
  const cur = loadSummaries(repo, notesDir, date);
  if (text.trim()) cur[part] = text.trim(); else delete cur[part];
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(cur, null, 2), 'utf8');
}

module.exports = { dateStr, timeStr, isBusinessDay, notesPath, timelinePath,
                   ensureScaffold, primeShadow, trackSave, loadSummaries, saveSummary,
                   diffNewLines, isScaffoldLine, lineSimilarity, splitEdits, rewriteTimeline };
