// model.js: 하루치 커밋을 "챕터(구간) → 씬" 스토리 모델로 변환
// 구간 = 시간표가 있으면 파트, 없으면 자동 세션(segmentDay 한 곳에서 정한다. 화면·필기 틀·내보내기가 같이 쓴다)
// 핵심 규칙: 축=시간, 파일=태그 / 파트당 파일별 씬 묶기(파편화 방지) / 일괄 작업(🧹) 뭉침 / 삭제→재생성=♻️
// 시간표에 정의된 파트는 기록이 없어도 챕터로 유지한다 — 강의만 들은 파트에도 정리를 남길 수 있게
// 필기: reviewData의 notes 배열({id,time,text,seq})을 받아 seq(분) 기준으로 배치한다
const { t } = require('./i18n');

function toMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function parseBlocks(blockStrs) {
  return blockStrs
    .map(s => {
      const [a, b] = s.split('-');
      return { start: toMin(a), end: toMin(b), startStr: a, endStr: b };
    })
    .sort((x, y) => x.start - y.start)
    .map((b, i) => ({ ...b, label: t('model.part', { n: i + 1 }) }));
}

function hhmm(min) {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// 하루를 구간으로 자른다. 시간표가 있으면 파트(지금 동작), 없으면 활동 시각(커밋·필기)을
// gapMin분 넘게 쉰 곳에서 끊어 세션으로. 세션 범위 = 첫 활동 ~ 마지막 활동(+1분, 끝은 미포함)
// 반환 { mode: 'timetable' | 'sessions', segments: [{ label, start, end, startStr, endStr }] }
function segmentDay({ blocks, times, gapMin }) {
  const parsed = parseBlocks(blocks || []);
  if (parsed.length) return { mode: 'timetable', segments: parsed };
  const gap = gapMin == null ? 30 : gapMin;
  const ts = (times || []).filter(t => Number.isFinite(t)).sort((a, b) => a - b);
  const segments = [];
  for (const t of ts) {
    const cur = segments[segments.length - 1];
    if (cur && t - cur.last <= gap) { cur.last = t; continue; }
    segments.push({ first: t, last: t });
  }
  return {
    mode: 'sessions',
    segments: segments.map((g, i) => {
      const start = Math.floor(g.first), end = Math.floor(g.last) + 1;
      return { label: t('model.session', { n: i + 1 }), start, end, startStr: hhmm(start), endStr: hhmm(end) };
    })
  };
}

// [HH:mm] 필기 타임라인 파싱
function parseNotes(text) {
  const notes = [];
  // PowerShell 산 파일 호환: BOM·CR 제거
  for (const line of (text || '').replace(/^﻿/, '').split(/\r?\n/)) {
    const m = line.match(/^\[(\d{2}:\d{2})\]\s?(.*)$/);
    if (m && m[2].trim()) notes.push({ type: 'note', time: m[1], text: m[2].trim() });
  }
  return notes;
}

function buildDay({ date, commits, notes, config }) {
  const { blocks: blockStrs, noiseThreshold, excludePrefixes } = config;
  const gapMin = config.paragraphGapMinutes == null ? 3 : config.paragraphGapMinutes;
  // 구간: 시간표 또는 자동 세션. 세션은 화면에 실제로 남는 활동(제외 경로를 뺀 커밋 + 필기)으로 자른다
  const activity = commits
    .filter(c => c.files.some(f => !excludePrefixes.some(p => f.path.startsWith(p))))
    .map(c => toMin(c.time))
    .concat((notes || []).map(n => n.seq));
  const { mode, segments: blocks } = segmentDay({ blocks: blockStrs, times: activity, gapMin: config.sessionGapMinutes });

  // 1) 제외 경로 필터 + 노이즈/일반 커밋 분리
  const noiseEvents = [];
  const codeCommits = [];
  for (const c of commits) {
    const files = c.files.filter(f => !excludePrefixes.some(p => f.path.startsWith(p)));
    if (files.length === 0) continue;
    if (files.length >= noiseThreshold) {
      const dels = files.filter(f => f.status === 'D').length;
      const adds = files.filter(f => f.status === 'A').length;
      noiseEvents.push({
        type: 'noise', time: c.time, sha: c.sha,
        total: files.length, adds, dels, mods: files.length - adds - dels,
        files: files.map(f => ({ path: f.path, status: f.status }))
      });
    } else {
      codeCommits.push({ ...c, files });
    }
  }

  // 2) 파일 통계 (노이즈 제외 — 파일 목록 정렬용)
  const stats = new Map(); // path -> {count, events:[{time,status}]}
  for (const c of codeCommits) {
    for (const f of c.files) {
      if (!stats.has(f.path)) stats.set(f.path, { count: 0, events: [] });
      const s = stats.get(f.path);
      s.count++;
      s.events.push({ time: c.time, status: f.status });
    }
  }

  // 챕터 메타: 파트/쉬는 시간/시간 외 판정 + 정렬 키
  const chapterMetaFor = (min) => {
    for (const b of blocks) {
      if (min >= b.start && min < b.end)
        return { key: `part:${b.label}`, label: b.label, range: `${b.startStr}~${b.endStr}`,
                 sort: b.start, isPart: true, startMin: b.start, endMin: b.end };
    }
    if (blocks.length && min < blocks[0].start)
      return { key: 'gap:before', label: t('model.offHours'), range: `~${blocks[0].startStr}`,
               sort: blocks[0].start - 1000, isPart: false };
    for (let i = 0; i < blocks.length - 1; i++) {
      if (min >= blocks[i].end && min < blocks[i + 1].start)
        return { key: `gap:${i}`, label: t('model.break'), range: `${blocks[i].endStr}~${blocks[i + 1].startStr}`,
                 sort: blocks[i].end, isPart: false };
    }
    if (blocks.length && min >= blocks[blocks.length - 1].end)
      return { key: 'gap:after', label: t('model.offHours'), range: `${blocks[blocks.length - 1].endStr}~`,
               sort: blocks[blocks.length - 1].end, isPart: false };
    return { key: 'gap:any', label: t('model.offHours'), range: '', sort: min, isPart: false };
  };

  // 3) 씬 묶기: 커밋의 "모든" 파일이 각자 씬을 얻는다 — 멀티파일 커밋에서 파일이 증발하지 않는다.
  //    같은 파트·같은 파일은 하나의 씬으로 묶이므로(A↔B 번갈아 만져도) 파편화는 없다.
  //    단, 손을 놓은 텀이 gapMin분을 넘으면 같은 파일이라도 새 단락(씬).
  //    삭제 추적(♻️ 감지)은 노이즈 커밋의 삭제까지 시간순으로 반영한다.
  const scenes = [];
  const sceneMap = new Map(); // `${chapterKey}|${file}` -> scene
  const deletedSoFar = new Map(); // path -> 삭제 커밋 sha (갈아엎기 감지용)
  const chrono = [...codeCommits.map(c => ({ c, noise: false })),
                  ...noiseEvents.map(n => ({ c: n, noise: true }))]
    .sort((a, b) => toMin(a.c.time) - toMin(b.c.time));
  for (const { c, noise } of chrono) {
    if (noise) { // 🧹 커밋: 씬은 안 만들되 삭제만 기록 — 대량 삭제 후 재생성도 ♻️로 잡는다
      for (const f of c.files) if (f.status === 'D') deletedSoFar.set(f.path, c.sha);
      continue;
    }
    const meta = chapterMetaFor(toMin(c.time));
    for (const f of c.files) {
      const k = `${meta.key}|${f.path}`;
      let scene = sceneMap.get(k);
      if (scene && toMin(c.time) - toMin(scene.end) > gapMin) scene = null; // 텀 초과 → 새 단락
      if (!scene) {
        scene = {
          type: 'scene', file: f.path, chapterKey: meta.key, start: c.time, end: c.time, count: 0,
          firstSha: c.sha, lastSha: c.sha, times: [], icon: '🟡', extras: [],
          stat: { add: 0, del: 0 } // numstat 누적 — 행의 +n/−n
        };
        sceneMap.set(k, scene);
        scenes.push(scene);
      }
      scene.end = c.time;
      scene.count++;
      scene.lastSha = c.sha;
      scene.times.push(c.time); // 미니맵 활동 밀도 계산용
      scene.stat.add += f.add || 0;
      scene.stat.del += f.del || 0;
      // 씬 아이콘: 생성/삭제/재생성 판정
      if (f.status === 'D') {
        deletedSoFar.set(f.path, c.sha);
        scene.icon = '🔴';
      } else if (f.status === 'A') {
        if (deletedSoFar.has(f.path)) {
          scene.icon = '♻️';
          scene.reworkSha = deletedSoFar.get(f.path); // 이 커밋 직전 = 지우기 전 판
        } else if (scene.icon !== '♻️') scene.icon = '🟢';
      }
    }
  }

  // 3-b) 씬 정리 적용: 수업과 무관한 변경(수업 전 밀린 작업·외부 도구 수정 등)을 치운다.
  //      'hide'=복기에서 제외 / 'off'=남기되 파트에서 빼 "시간 외"로 모은다. 커밋은 그대로다.
  const sceneOps = config.sceneOps || {};
  const opOf = (s) => sceneOps[`${s.file}|${s.start}`] || null;
  const hiddenCount = scenes.filter(s => opOf(s) === 'hide').length;
  const visibleScenes = scenes.filter(s => opOf(s) !== 'hide');
  for (const s of visibleScenes) if (opOf(s) === 'off') s.movedOff = true;

  // 4) 파일 목록 (필터 칩·사이드바용 — 많이 만진 순, 씬 수 포함). 숨긴 씬만 있던 파일은 빠진다
  const scenesPerFile = new Map();
  for (const s of visibleScenes) scenesPerFile.set(s.file, (scenesPerFile.get(s.file) || 0) + 1);
  const fileList = [...stats.entries()]
    .filter(([path]) => scenesPerFile.has(path))
    .sort((a, b) => b[1].count - a[1].count)
    .map(([path]) => ({ path, name: path.split('/').pop(), scenes: scenesPerFile.get(path) || 0 }));

  // 5) 챕터 배치: 파트 챕터는 비어 있어도 미리 깔고, 아이템(씬·필기·노이즈)을 시간으로 배치
  const chMap = new Map();
  for (const b of blocks) {
    const m = chapterMetaFor(b.start);
    chMap.set(m.key, { key: m.key, label: m.label, range: m.range, sort: m.sort,
                       isPart: true, startMin: b.start, endMin: b.end, items: [] });
  }
  const noteItems = (notes || []).map(n => ({ type: 'note', ...n }));
  const items = [...visibleScenes, ...noiseEvents, ...noteItems];
  // 직접 옮긴 씬이 모이는 자리 — 파트 뒤에 오도록 정렬 키를 하루 끝으로 둔다
  const OFF_META = { key: 'gap:moved', label: t('model.movedOff'), range: '',
                     sort: (blocks.length ? blocks[blocks.length - 1].end : 24 * 60) + 1, isPart: false };
  for (const it of items) {
    const min = it.type === 'note' ? it.seq : toMin(it.start || it.time);
    const m = it.movedOff ? OFF_META : chapterMetaFor(min);
    let ch = chMap.get(m.key);
    if (!ch) {
      ch = { key: m.key, label: m.label, range: m.range, sort: m.sort, isPart: m.isPart, items: [] };
      chMap.set(m.key, ch);
    }
    ch.items.push(it);
  }
  const chapters = [...chMap.values()]
    .filter(ch => ch.isPart || ch.items.length) // 쉬는 시간·시간 외는 내용 있을 때만
    .sort((a, b) => a.sort - b.sort);
  for (const ch of chapters) {
    ch.items.sort((a, b) => seqOf(a) - seqOf(b));
  }

  return {
    date, mode, fileList, totalFiles: fileList.length, chapters,
    sceneCount: visibleScenes.length, noiseCount: noiseEvents.length,
    hiddenCount, itemCount: items.length,
    dayStartMin: blocks.length ? blocks[0].start : 0,
    dayEndMin: blocks.length ? blocks[blocks.length - 1].end : 24 * 60
  };
}

function seqOf(it) {
  if (it.type === 'note') return it.seq;
  return toMin(it.start || it.time);
}

module.exports = { buildDay, parseNotes, parseBlocks, segmentDay, toMin, hhmm };
