// model.js — 하루치 커밋을 "챕터(파트) → 씬" 스토리 모델로 변환
// 핵심 규칙: 축=시간, 파일=태그 / 파트당 파일별 씬 묶기(파편화 방지) / 일괄 작업(🧹) 뭉침 / 삭제→재생성=♻️
// 시간표에 정의된 파트는 기록이 없어도 챕터로 유지한다 — 강의만 들은 파트에도 정리를 남길 수 있게
// 필기: reviewData의 notes 배열({id,time,text,seq})을 받아 seq(분) 기준으로 배치한다

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
    .map((b, i) => ({ ...b, label: `파트${i + 1}` }));
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
  const blocks = parseBlocks(blockStrs);

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

  // 2) 파일 통계 (노이즈 제외 — 씬 대표 파일 선별용)
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
      return { key: 'gap:before', label: '시간 외', range: `~${blocks[0].startStr}`,
               sort: blocks[0].start - 1000, isPart: false };
    for (let i = 0; i < blocks.length - 1; i++) {
      if (min >= blocks[i].end && min < blocks[i + 1].start)
        return { key: `gap:${i}`, label: '쉬는 시간', range: `${blocks[i].endStr}~${blocks[i + 1].startStr}`,
                 sort: blocks[i].end, isPart: false };
    }
    if (blocks.length && min >= blocks[blocks.length - 1].end)
      return { key: 'gap:after', label: '시간 외', range: `${blocks[blocks.length - 1].endStr}~`,
               sort: blocks[blocks.length - 1].end, isPart: false };
    return { key: 'gap:any', label: '시간 외', range: '', sort: min, isPart: false };
  };

  // 3) 씬 묶기: 같은 파트 안에서 같은 대표 파일은 하나의 씬 (A↔B 번갈아 만져도 파편화 없음)
  //    단, 손을 놓은 텀이 gapMin분을 넘으면 같은 파일이라도 새 단락(씬) — 한 파일을 파트 내내 만져도 복기 단위가 나뉜다
  const scenes = [];
  const sceneMap = new Map(); // `${chapterKey}|${file}` -> scene
  const deletedSoFar = new Map(); // path -> 삭제 커밋 sha (갈아엎기 감지용)
  for (const c of codeCommits) {
    let dom = c.files[0].path;
    if (c.files.length > 1) {
      dom = c.files.reduce((best, f) =>
        (stats.get(f.path).count > stats.get(best).count ? f.path : best), dom);
    }
    const meta = chapterMetaFor(toMin(c.time));
    const k = `${meta.key}|${dom}`;
    let scene = sceneMap.get(k);
    if (scene && toMin(c.time) - toMin(scene.end) > gapMin) scene = null; // 텀 초과 → 새 단락
    if (!scene) {
      scene = {
        type: 'scene', file: dom, chapterKey: meta.key, start: c.time, end: c.time, count: 0,
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
    const domFile = c.files.find(f => f.path === dom);
    if (domFile) { scene.stat.add += domFile.add || 0; scene.stat.del += domFile.del || 0; }
    scene.extras = mergeExtras(scene.extras, c.files, dom);
    // 씬 아이콘: 생성/삭제/재생성 판정 (삭제는 모든 파일 추적 — 파트를 넘긴 재생성도 잡는다)
    for (const f of c.files) {
      if (f.status === 'D') {
        deletedSoFar.set(f.path, c.sha);
        if (f.path === dom) scene.icon = '🔴';
      } else if (f.status === 'A' && f.path === dom) {
        if (deletedSoFar.has(f.path)) {
          scene.icon = '♻️';
          scene.reworkSha = deletedSoFar.get(f.path); // 이 커밋 직전 = 지우기 전 판
        } else if (scene.icon !== '♻️') scene.icon = '🟢';
      }
    }
  }

  // 4) 파일 목록 (필터 칩·사이드바용 — 많이 만진 순, 씬 수 포함)
  const scenesPerFile = new Map();
  for (const s of scenes) scenesPerFile.set(s.file, (scenesPerFile.get(s.file) || 0) + 1);
  const fileList = [...stats.entries()]
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
  const items = [...scenes, ...noiseEvents, ...noteItems];
  for (const it of items) {
    const min = it.type === 'note' ? it.seq : toMin(it.start || it.time);
    const m = chapterMetaFor(min);
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
    date, fileList, totalFiles: fileList.length, chapters,
    sceneCount: scenes.length, noiseCount: noiseEvents.length,
    itemCount: items.length,
    dayStartMin: blocks.length ? blocks[0].start : 0,
    dayEndMin: blocks.length ? blocks[blocks.length - 1].end : 24 * 60
  };
}

function seqOf(it) {
  if (it.type === 'note') return it.seq;
  return toMin(it.start || it.time);
}

function mergeExtras(extras, files, dom) {
  const set = new Set(extras);
  for (const f of files) if (f.path !== dom) set.add(f.path.split('/').pop());
  return [...set];
}

module.exports = { buildDay, parseNotes, parseBlocks, toMin };
