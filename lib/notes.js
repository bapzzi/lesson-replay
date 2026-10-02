// notes.js — 필기 틀 생성(영업일)·필기 타임라인 기록·파트별 한 줄 정리 저장
const fs = require('fs');
const path = require('path');
const { parseBlocks } = require('./model');
const { t } = require('./i18n');

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

// 수업 시간대인가 — 첫 파트 시작 ~ 마지막 파트 끝. 알림을 수업 중에만 띄우기 위한 판정
function isClassHours(blockStrs, d) {
  const blocks = parseBlocks(blockStrs || []);
  if (!blocks.length) return false;
  d = d || new Date();
  const now = d.getHours() * 60 + d.getMinutes();
  return now >= blocks[0].start && now <= blocks[blocks.length - 1].end;
}

// 틀이 깐 파트 제목 줄 — 시각 현행화·타임라인 제외 판정에 함께 쓴다
const PART_HEADING = /^## .+\(\d{2}:\d{2}~\d{2}:\d{2}\)$/;
const PART_HEADING_START = /^## .+\(\d{2}:\d{2}~\d{2}:\d{2}\)/;

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

// 시간표를 고쳤을 때 이미 만들어진 틀의 파트 시각도 따라가게 한다.
// 제목 문구는 사용자가 고쳤을 수 있으므로 (HH:MM~HH:MM) 부분만 바꾼다.
// 파트 수가 다르면(사용자가 지웠거나 더했으면) 손대지 않는다.
function refreshPartHeadings(p, blocks) {
  let text;
  try { text = fs.readFileSync(p, 'utf8'); } catch { return; }
  const lines = text.split(/\r?\n/);
  const idx = lines.map((l, i) => [l, i]).filter(([l]) => PART_HEADING.test(l.trim())).map(([, i]) => i);
  if (idx.length !== blocks.length) return;
  let changed = false;
  idx.forEach((li, k) => {
    const b = blocks[k];
    const next = lines[li].replace(/\(\d{2}:\d{2}~\d{2}:\d{2}\)\s*$/, `(${b.startStr}~${b.endStr})`);
    if (next !== lines[li]) { lines[li] = next; changed = true; }
  });
  if (changed) fs.writeFileSync(p, lines.join('\n'), 'utf8');
}

// 필기 틀 파일: 필기 폴더의 _틀.md(영어 표시면 _template.md). 사용자가 직접 고친다. 없으면 내장 기본 틀
// 자리표시 {날짜}{요일}{파트} = {date}{weekday}{parts}. {파트}는 시간표 파트 제목 줄들(시간표가 없으면 빈칸)
const TEMPLATE_NAMES = ['_틀.md', '_template.md'];
const DOW = t('date.weekdays').split(' ');

function defaultTemplate(hasTimetable) {
  return hasTimetable
    ? ['# ' + t('notes.tplClassTitle'), '',
       '> ' + t('notes.tplHint1'),
       '> ' + t('notes.tplHint2'), '', '{파트}', ''].join('\n')
    : ['# ' + t('notes.tplFreeTitle'), '', ''].join('\n');
}

function renderTemplate(text, { date, dow, parts }) {
  const v = { '날짜': date, 'date': date, '요일': dow, 'weekday': dow, '파트': parts, 'parts': parts };
  const out = text.replace(/\{(날짜|date|요일|weekday|파트|parts)\}/g, (_, k) => v[k] || '');
  return out.replace(/\n{3,}/g, '\n\n'); // 빈 {파트} 자리가 남긴 연속 빈 줄 정리
}

function templatePath(repo, notesDir) {
  const dir = path.join(repo, notesDir);
  for (const n of TEMPLATE_NAMES) if (fs.existsSync(path.join(dir, n))) return path.join(dir, n);
  return path.join(dir, TEMPLATE_NAMES[0]);
}

function loadTemplate(repo, notesDir) {
  const p = templatePath(repo, notesDir);
  try { return fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n'); } catch { return null; }
}

// 「필기 틀 편집」: 틀 파일이 없으면 내장 기본으로 만들어 경로를 돌려준다
function ensureTemplateFile(repo, config) {
  const p = templatePath(repo, config.notesDir);
  if (!fs.existsSync(p)) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, defaultTemplate((config.blocks || []).length > 0), 'utf8');
    ensureLintOptOut(path.dirname(p));
  }
  return p;
}

// 필기 틀: 파트 헤딩을 미리 깔아 둔 md (이미 있으면 시각만 현행화)
// 자동 생성은 시간표가 있을 때 영업일만. 시간표가 없으면(자동 세션) 요일과 무관하게 만든다.
// force=true(사용자가 직접 요청)면 언제나 생성
function ensureScaffold(repo, config, force) {
  if (!repo) return null;
  const hasTimetable = (config.blocks || []).length > 0;
  if (!force && hasTimetable && !isBusinessDay(new Date(), config.holidays)) return null;
  const date = dateStr();
  const p = notesPath(repo, config.notesDir, date);
  const blocks = parseBlocks(config.blocks);
  if (fs.existsSync(p)) {
    ensureLintOptOut(path.dirname(p));
    refreshPartHeadings(p, blocks);
    return p;
  }
  const tpl = loadTemplate(repo, config.notesDir) || defaultTemplate(hasTimetable);
  const body = renderTemplate(tpl, {
    date, dow: DOW[new Date().getDay()],
    parts: blocks.map(b => `## ${b.label} (${b.startStr}~${b.endStr})`).join('\n\n')
  });
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body, 'utf8');
  ensureLintOptOut(path.dirname(p));
  return p;
}

// 틀에서 자동 생성된 줄인가 — 타임라인에 넣지 않는다 (사용자가 쓴 #·> 줄은 기록 대상)
function isScaffoldLine(l) {
  const t = l.trim();
  if (!t) return true;
  if (/^# \d{4}-\d{2}-\d{2}.*(수업|학습) 필기$/.test(t)) return true;
  // 제목 줄 끝에 글자가 붙어도(`## 파트1 (09:10~10:20)dd`, 09-09 실측) 제목 줄은 기록하지 않는다
  if (PART_HEADING_START.test(t)) return true;
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
      // 타임라인은 trim해서 저장하므로 비교·기록 모두 trim 기준으로 맞춘다.
      // (원본 그대로 비교하면 줄 끝 공백 하나에 매칭이 깨져 편집이 새 줄로 쌓인다 — 계단식 중복)
      if (m && m[2] === e.from.trim()) { lines[i] = `[${m[1]}] ${e.to.trim()}`; done = changed = true; break; }
    }
    if (!done) leftovers.push(e.to);
  }
  if (changed) fs.writeFileSync(p, lines.join('\n'), 'utf8');
  return leftovers;
}

// 타임라인에 마지막으로 기록된 본문 줄 (문단 경계 판정의 기준점)
function lastRecordedLine(p) {
  let text;
  try { text = fs.readFileSync(p, 'utf8'); } catch { return null; }
  const lines = text.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/^\[\d{2}:\d{2}\] (.+)$/);
    if (m) return m[1].trim();
  }
  return null;
}

// 필기 저장 → 이전 내용과 비교해 새 줄만 [HH:mm]으로 타임라인에 축적
const shadow = new Map(); // fsPath -> lines[]

function primeShadow(repo, notesDir) {
  const p = notesPath(repo, notesDir, dateStr());
  if (fs.existsSync(p) && !shadow.has(p)) {
    shadow.set(p, fs.readFileSync(p, 'utf8').replace(/^﻿/, '').split(/\r?\n/));
  }
}

// 필기에서 빈 줄로 나눠 적은 문단은 타임라인에서도 나눠 둔다(빈 줄로 표시).
// 복기가 시각 간격만 보고 뭉치면, 사용자가 이미 준 "여긴 다른 얘기" 정보가 버려진다.
// 본문 순서대로 훑으며 기록 대상 줄을 고르고, 사이에 빈 줄이 있었으면 경계를 남긴다.
// anchor = 타임라인에 마지막으로 기록된 줄. 그 줄을 지나온 뒤 빈 줄을 만나면 문단 경계로 본다
// — 문단을 나눠 저장해도(한 문단 쓰고 저장 → 다음 문단 쓰고 저장) 사용자가 준 경계가 살아남는다
function formatPending(cur, pending, t, anchor) {
  const want = new Map();
  for (const l of pending) want.set(l, (want.get(l) || 0) + 1);
  const out = [];
  let sawBlank = false, emitted = false, passedAnchor = false;
  for (const raw of cur) {
    const line = raw.trim();
    if (!line) { sawBlank = true; continue; }
    const n = want.get(raw) || want.get(line) || 0;
    if (!n) {
      if (anchor && !passedAnchor && line === anchor) { passedAnchor = emitted = true; sawBlank = false; }
      continue;
    }
    want.set(want.has(raw) ? raw : line, n - 1);
    if (emitted && sawBlank) out.push('');
    out.push(`[${t}] ${line}`);
    emitted = true; sawBlank = false;
  }
  // 본문에서 못 찾은 줄(편집 회수분 등)은 순서를 보존해 뒤에 붙인다
  for (const l of pending) {
    const key = want.has(l) ? l : l.trim();
    const n = want.get(key) || 0;
    if (n > 0) { want.set(key, n - 1); out.push(`[${t}] ${l.trim()}`); }
  }
  return out.join('\n') + '\n';
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
    fs.appendFileSync(tl, formatPending(cur, pending, timeStr(), lastRecordedLine(tl)), 'utf8');
  }
  return true;
}

// 디스크의 필기 파일을 읽어 trackSave에 넘긴다. VS Code 밖(IntelliJ·메모장)에서 저장한 필기도
// 시각이 남게 하려는 것. VS Code 저장과 겹쳐 두 번 불려도 두 번째는 바뀐 줄이 없어 아무것도 안 쓴다
function trackFile(repo, notesDir, fsPath) {
  let text;
  try { text = fs.readFileSync(fsPath, 'utf8'); } catch { return false; }
  return trackSave(repo, notesDir, fsPath, text);
}

// 필기 폴더 감시: 오늘 필기 파일이 바뀌면 onChange(경로). 에디터는 저장 한 번에 이벤트를 여러 번
// 보내므로 300ms 모아서 한 번만 부른다. 폴더가 없으면 감시하지 않는다(틀이 생긴 뒤 다시 시도)
function watchNotesDir(dir, onChange, log) {
  let w = null, timer = null;
  try {
    w = fs.watch(dir, (_ev, name) => {
      if (!name || String(name) !== `${dateStr()}.md`) return;
      clearTimeout(timer);
      timer = setTimeout(() => onChange(path.join(dir, String(name))), 300);
    });
    w.on('error', (e) => { if (log) log(t('log.notesWatchError', { msg: e.message })); });
  } catch (e) {
    if (log) log(t('log.notesWatchFailed', { dir, msg: e.message }));
    return { dir, close() {} };
  }
  return { dir, close() { clearTimeout(timer); try { w.close(); } catch { /* 이미 닫힘 */ } } };
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

module.exports = { dateStr, timeStr, isBusinessDay, isClassHours, notesPath, timelinePath,
                   ensureScaffold, primeShadow, trackSave, trackFile, watchNotesDir,
                   defaultTemplate, renderTemplate, templatePath, ensureTemplateFile,
                   loadSummaries, saveSummary,
                   diffNewLines, isScaffoldLine, lineSimilarity, splitEdits, rewriteTimeline,
                   lastRecordedLine };
