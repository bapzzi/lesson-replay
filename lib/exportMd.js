// exportMd.js: 하루치 복기를 "맨 위 한 화면만 읽어도 오늘 한 일을 아는" md로 변환 (2.0 ① spec §3)
// 순서: 제목 + 사실 줄 → (선택) TIL 프롬프트 → 한눈에 표 → 흐름(구간별, 필기·코드 시간순) → 다시 볼 곳
//       → 부록 A 파일별 하루 변화(파일당 diff 하나) → 부록 B 시행착오 후보의 구간별 변화 → 부록 C 필기 전문
// 흐름은 한 화면 분량을 지키려고 연속 필기를 한 줄로 묶는다(첫 필기 앞부분 + 외 N개). 전문은 부록 C
// AI 없이 기록만 재배치한다. 본문은 파일 이름만, 전체 경로는 부록 제목에서 한 번
// 자동 생성·설정 파일(mvnw·.gitignore·lock 등)은 diff를 싣지 않고 순위에서도 뺀다. 새 파일 diff는 앞부분만
// opts = { prompt, marks: ['file|start'], fileDiffs: Map(file → diff), sceneDiffs: Map('file|start' → diff) }
const { t } = require('./i18n');
const { langName, isBoilerplate } = require('./fileKinds');
const STATUS = { '🟢': t('export.statusNew'), '🟡': t('export.statusMod'), '🔴': t('export.statusDel'), '♻️': t('export.statusRework') };
const DIFF_MAX_LINES = 300;    // diff 하나당 상한
const TOTAL_DIFF_BUDGET = 3000; // 부록 전체 diff 상한. AI 입력 한도를 넘는 원자재 방지
const TRIAL_SCENES = 4;        // 하루 이 구간 수 이상 고친 파일 = 시행착오 후보
const NEW_FILE_MAX = 60;       // 새로 만든 파일은 diff 앞부분만(전체 내용은 복기 화면에서)

function cleanDiff(raw, max, newFile) {
  max = max || DIFF_MAX_LINES;
  const lines = raw.split('\n')
    .filter(l => !/^(diff --git|index |--- |\+\+\+ |\\ No newline|new file mode|deleted file mode|old mode|new mode|similarity index|rename (from|to))/.test(l));
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (lines.length > max) {
    const tail = newFile ? t('export.newFileHead', { total: lines.length, shown: max })
      : t('export.longDiff', { n: lines.length - max });
    return [...lines.slice(0, max), tail];
  }
  return lines;
}

const DOW = t('date.weekdays').split(' ');
const base = (p) => p.split('/').pop();
const dirOf = (p) => p.split('/').slice(0, -1).join('/');
const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
const chg = (s) => ((s.stat || {}).add || 0) + ((s.stat || {}).del || 0);
// 순위: 직접 쓴 파일이 먼저, 그다음 변경량
const byMine = (fa, ca, fb, cb) => (isBoilerplate(fa) - isBoilerplate(fb)) || (cb - ca);
const addOf = (s) => (s.stat || {}).add || 0;
const delOf = (s) => (s.stat || {}).del || 0;
const noteTime = (n) => n.time || '';
const oneLine = (t) => t.split('\n').map(x => x.trim()).filter(Boolean).join(' / ');
const plusMinus = (a, d) => [a ? `+${a}` : '', d ? `−${d}` : ''].filter(Boolean).join(' ');
const clip = (t, n) => (t.length > n ? t.slice(0, n).trimEnd() + '…' : t);
const NOTE_ONE = 120, NOTE_MANY = 80; // 흐름에서 필기 한 줄 길이(혼자 / 묶음의 첫 필기)
const BATCH_MIN = 3; // 같은 분 동시 저장을 한 줄로 묶는 최소 파일 수

// 같은 파일 연속 씬(사이에 필기·다른 파일이 없을 때)을 한 줄로(화면 묶음과 같은 규칙),
// 사이에 코드가 없는 연속 필기도 한 줄로
function runs(items) {
  const out = [];
  for (const it of items) {
    const last = out[out.length - 1];
    if (it.type === 'scene' && last && last.type === 'run' && last.file === it.file) last.scenes.push(it);
    else if (it.type === 'scene') out.push({ type: 'run', file: it.file, scenes: [it] });
    else if (it.type === 'note' && last && last.type === 'notes') last.notes.push(it);
    else if (it.type === 'note') out.push({ type: 'notes', notes: [it] });
    else out.push(it);
  }
  // 같은 분에 3개 이상 파일을 한꺼번에 저장한 묶음(전체 저장·외부 도구)은 「동시 저장」 한 줄로
  const merged = [];
  for (const r of out) {
    const single = r.type === 'run' && r.scenes.length === 1 && r.scenes[0].start === r.scenes[0].end;
    const last = merged[merged.length - 1];
    if (single && last && last.type === 'batch' && last.time === r.scenes[0].start) last.scenes.push(r.scenes[0]);
    else if (single) merged.push({ type: 'batch', time: r.scenes[0].start, scenes: [r.scenes[0]] });
    else merged.push(r);
  }
  return merged.flatMap(m => (m.type === 'batch' && m.scenes.length < BATCH_MIN
    ? m.scenes.map(sc => ({ type: 'run', file: sc.file, scenes: [sc] })) : [m]));
}

function runStatus(scenes) {
  if (scenes.some(s => s.icon === '♻️')) return t('export.statusRework');
  return STATUS[scenes[0].icon] || t('export.statusMod');
}

function buildExportMd(model, summaries, opts) {
  summaries = summaries || {};
  opts = opts || {};
  const marks = opts.marks || [];
  const fileDiffs = opts.fileDiffs || new Map();
  const sceneDiffs = opts.sceneDiffs || new Map();
  const items = model.chapters.flatMap(ch => ch.items);
  const scenes = items.filter(i => i.type === 'scene');
  const notes = items.filter(i => i.type === 'note');
  const unit = model.mode === 'sessions' ? t('export.unitSession') : t('export.unitPart');

  // 같은 이름 파일은 상위 폴더를 붙여 구분(화면 칩과 같은 규칙)
  const files = [...new Set(scenes.map(s => s.file))];
  const nameCount = new Map();
  for (const f of files) nameCount.set(base(f), (nameCount.get(base(f)) || 0) + 1);
  const label = (f) => nameCount.get(base(f)) > 1 && dirOf(f) ? `${dirOf(f).split('/').pop()}/${base(f)}` : base(f);

  const L = [];
  const dow = DOW[new Date(`${model.date}T12:00:00`).getDay()];
  L.push(`# ${t('export.title', { date: model.date, dow })}`);
  L.push('');

  // ── 사실 줄 ──
  const times = [...scenes.flatMap(s => [s.start, s.end]), ...notes.map(noteTime).filter(Boolean)].sort();
  const parts = model.chapters.filter(ch => ch.isPart);
  const usedParts = parts.filter(ch => ch.items.length);
  const fileState = new Map(); // file → 새로 만듦 / 삭제 / 수정
  for (const f of files) {
    const ss = scenes.filter(s => s.file === f);
    const last = ss[ss.length - 1];
    fileState.set(f, last.icon === '🔴' ? t('export.statusDel')
      : ss.some(s => s.icon === '🟢' || s.icon === '♻️') ? t('export.statusNew') : t('export.statusMod'));
  }
  const cnt = (st) => [...fileState.values()].filter(v => v === st).length;
  const nNew = cnt(t('export.statusNew')), nMod = cnt(t('export.statusMod')), nDel = cnt(t('export.statusDel'));
  const rwCount = scenes.filter(s => s.icon === '♻️').length;
  const facts = [
    times.length ? t('export.factRange', { from: times[0], to: times[times.length - 1] }) : t('export.factNone'),
    `${unit} ${usedParts.length}`,
    t('export.factFiles', { n: files.length }) + (files.length
      ? t('export.factBreakdown', { new: nNew, mod: nMod, del: nDel ? t('export.factDel', { n: nDel }) : '' }) : ''),
    t('export.factNotes', { n: notes.length })
  ];
  if (rwCount) facts.push(t('export.factRework', { n: rwCount }));
  L.push(facts.join(' · '));
  // 가장 많이 바뀐 곳: 바로 위 폴더로 묶어 추가+삭제가 가장 큰 곳(동률이면 파일 수)
  const byDir = new Map();
  const mine = scenes.filter(s => !isBoilerplate(s.file));
  for (const s of (mine.length ? mine : scenes)) {
    const d = dirOf(s.file) || '.';
    const e = byDir.get(d) || { files: new Set(), add: 0, del: 0 };
    e.files.add(s.file); e.add += addOf(s); e.del += delOf(s);
    byDir.set(d, e);
  }
  const top = [...byDir.entries()].sort((a, b) =>
    (b[1].add + b[1].del) - (a[1].add + a[1].del) || b[1].files.size - a[1].files.size)[0];
  if (top) {
    const shortDir = top[0] === '.' ? t('export.topLevel') : top[0].split('/').slice(-2).join('/');
    L.push(t('export.mostChanged', { dir: shortDir, n: top[1].files.size,
      pm: plusMinus(top[1].add, top[1].del) || t('export.zeroChange') }));
  }
  // 언어: 직접 쓴 파일 기준 개수(많은 순)
  const langs = new Map();
  for (const f of files.filter(x => !isBoilerplate(x))) langs.set(langName(f), (langs.get(langName(f)) || 0) + 1);
  if (langs.size) {
    L.push(t('export.languages', { list: [...langs.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') }));
  }
  L.push('');

  if (opts.prompt) {
    L.push(`## ${t('export.hPrompt')}`);
    L.push('');
    for (const line of opts.prompt.split('\n')) L.push(`> ${line}`);
    L.push('');
  }

  // ── 한눈에 ──
  const withItems = model.chapters.filter(ch => ch.items.length);
  if (withItems.length) {
    L.push(`## ${t('export.hGlance')}`);
    L.push('');
    L.push(`| ${t('export.colSegment')} | ${t('export.colTime')} | ${t('export.colNotes')} | ${t('export.colFiles')} |`);
    L.push('|---|---|---|---|');
    for (const ch of withItems) {
      const ss = ch.items.filter(i => i.type === 'scene');
      const byFile = new Map();
      for (const s of ss) {
        const e = byFile.get(s.file) || { n: 0, c: 0, isNew: false };
        e.n++; e.c += chg(s); e.isNew = e.isNew || s.icon === '🟢' || s.icon === '♻️';
        byFile.set(s.file, e);
      }
      const ranked = [...byFile.entries()].sort((a, b) => byMine(a[0], a[1].c, b[0], b[1].c));
      const shown = ranked.slice(0, 2).map(([f, e]) => {
        const tags = [e.isNew ? t('export.tagNew') : '', e.n > 1 ? t('export.segments', { n: e.n }) : ''].filter(Boolean).join(', ');
        return `${label(f)}${tags ? `(${tags})` : ''}`;
      });
      if (ranked.length > 2) shown.push(t('export.more', { n: ranked.length - 2 }));
      L.push(`| ${ch.label} | ${ch.range || ''} | ${ch.items.filter(i => i.type === 'note').length} | ${shown.join(', ') || t('export.notesOnly')} |`);
    }
    const empty = parts.filter(ch => !ch.items.length).map(ch => ch.label);
    if (empty.length) { L.push(''); L.push(t('export.emptyParts', { list: empty.join('·') })); }
    L.push('');
  }

  // ── 흐름 ──
  if (withItems.length) {
    L.push(`## ${t('export.hFlow')}`);
    L.push('');
    for (const ch of withItems) {
      L.push(`### ${ch.label}${ch.range ? ` ${ch.range}` : ''}`);
      const learned = (summaries[ch.label] || '').trim();
      if (learned) L.push(`- ${t('export.learned', { text: oneLine(learned) })}`);
      for (const it of runs(ch.items)) {
        if (it.type === 'notes') {
          const ns = it.notes, t0 = noteTime(ns[0]), t1 = noteTime(ns[ns.length - 1]);
          const when = t0 && t1 && t0 !== t1 ? `${t0}~${t1} ` : t0 ? `${t0} ` : '';
          L.push(ns.length === 1
            ? `- ${t('export.flowNote', { when, text: clip(oneLine(ns[0].text), NOTE_ONE) })}`
            : `- ${t('export.flowNotes', { when, text: clip(oneLine(ns[0].text), NOTE_MANY), n: ns.length - 1 })}`);
        }
        else if (it.type === 'noise') L.push(`- ${t('export.flowNoise', { time: it.time, n: it.files.length })}`);
        else if (it.type === 'batch') {
          const ss = [...it.scenes].sort((a, b) => byMine(a.file, chg(a), b.file, chg(b)));
          const shown = ss.slice(0, 2).map(sc => `${label(sc.file)}(${STATUS[sc.icon] || t('export.statusMod')})`);
          const rest = ss.length - shown.length;
          const pm = plusMinus(sum(ss, addOf), sum(ss, delOf));
          L.push(`- ${t('export.flowBatch', { time: it.time, n: ss.length, files: shown.join(', ') })}`
            + `${rest ? ` ${t('export.more', { n: rest })}` : ''}${pm ? ` · ${pm}` : ''}`);
        }
        else {
          const ss = it.scenes, first = ss[0], last = ss[ss.length - 1];
          const range = first.start === last.end ? first.start : `${first.start}~${last.end}`;
          const pm = plusMinus(sum(ss, addOf), sum(ss, delOf));
          const sig = (first.stat || {}).sig;
          const bits = [runStatus(ss), ss.length > 1 ? t('export.segments', { n: ss.length }) : '', pm].filter(Boolean).join(' ');
          L.push(`- ${range} ${label(it.file)} ${bits}${sig ? ` · \`${sig}\`` : ''}`);
        }
      }
      L.push('');
    }
  }

  // ── 다시 볼 곳 ──
  const sceneCount = new Map();
  for (const s of scenes) sceneCount.set(s.file, (sceneCount.get(s.file) || 0) + 1);
  const trial = files.filter(f => !isBoilerplate(f)
    && (scenes.some(s => s.file === f && s.icon === '♻️') || sceneCount.get(f) >= TRIAL_SCENES));
  const marked = scenes.filter(s => marks.includes(`${s.file}|${s.start}`));
  L.push(`## ${t('export.hReview')}`);
  L.push('');
  if (!marked.length && !trial.length) L.push(`- ${t('export.none')}`);
  for (const s of marked) L.push(`- ★ ${s.start} ${label(s.file)}`);
  for (const f of trial) {
    const why = scenes.some(s => s.file === f && s.icon === '♻️')
      ? t('export.statusRework') : t('export.segmentsFixed', { n: sceneCount.get(f) });
    L.push(`- ${t('export.trial', { file: label(f), why })}`);
  }
  L.push('');

  // ── 부록 ──
  let spent = 0, omitted = 0;
  const pushDiff = (raw, max, newFile) => {
    const dls = cleanDiff(raw || '', max, newFile);
    if (!dls.length) { L.push(t('export.noDiff')); return; }
    if (spent + dls.length > TOTAL_DIFF_BUDGET) { omitted++; L.push(t('export.diffOmitted')); return; }
    spent += dls.length;
    L.push('```diff');
    for (const dl of dls) L.push(dl);
    L.push('```');
  };
  if (files.length) {
    L.push(`## ${t('export.hAppendixA')}`);
    L.push('');
    for (const f of files.filter(x => !isBoilerplate(x))) {
      const ss = scenes.filter(s => s.file === f);
      const isNew = fileState.get(f) === t('export.statusNew');
      L.push(`### ${label(f)}`);
      L.push(`\`${f}\` · ${langName(f)} · ${fileState.get(f)} · ${t('export.segments', { n: ss.length })} · ${plusMinus(sum(ss, addOf), sum(ss, delOf)) || t('export.zeroChange')}`);
      L.push('');
      // 시행착오 후보는 부록 B에 구간별 변화가 전부 있다. 하루 diff를 한 번 더 싣지 않는다
      if (trial.includes(f)) L.push(t('export.seeAppendixB'));
      else pushDiff(fileDiffs.get(f), isNew ? NEW_FILE_MAX : 0, isNew);
      L.push('');
    }
    const boiler = files.filter(isBoilerplate);
    if (boiler.length) {
      L.push(t('export.boilerplate', { list: boiler.map(f => `\`${f}\``).join(', ') }));
      L.push('');
    }
  }
  if (trial.length) {
    L.push(`## ${t('export.hAppendixB')}`);
    L.push('');
    for (const f of trial) {
      L.push(`### ${label(f)}`);
      L.push('');
      for (const s of scenes.filter(x => x.file === f)) {
        L.push(`#### ${s.start === s.end ? s.start : `${s.start}~${s.end}`} ${STATUS[s.icon] || t('export.statusMod')} ${plusMinus(addOf(s), delOf(s))}`.trimEnd());
        pushDiff(sceneDiffs.get(`${s.file}|${s.start}`));
        L.push('');
      }
    }
  }
  if (notes.length) {
    L.push(`## ${t('export.hAppendixC')}`);
    L.push('');
    for (const n of notes) {
      const [first, ...rest] = n.text.split('\n');
      L.push(`- ${noteTime(n) ? noteTime(n) + ' ' : ''}${first}`);
      for (const r of rest) L.push(`  ${r}`);
    }
    L.push('');
  }
  if (omitted) {
    L.push(`> ${t('export.omittedNote', { max: TOTAL_DIFF_BUDGET, n: omitted })}`);
    L.push('');
  }
  return L.join('\n');
}

// 부록에 필요한 diff 목록: 파일별 하루 범위, 시행착오 후보의 씬별 범위 (exportDay가 git으로 채운다)
function diffPlan(model) {
  const scenes = model.chapters.flatMap(ch => ch.items).filter(i => i.type === 'scene');
  const files = [...new Set(scenes.map(s => s.file))];
  const perFile = files.filter(f => !isBoilerplate(f)).map(f => {
    const ss = scenes.filter(s => s.file === f);
    const first = ss.reduce((a, s) => (s.start < a.start ? s : a), ss[0]);
    const last = ss.reduce((a, s) => (s.end >= a.end ? s : a), ss[0]);
    return { file: f, from: first.reworkSha || first.firstSha, to: last.lastSha };
  });
  const count = new Map();
  for (const s of scenes) count.set(s.file, (count.get(s.file) || 0) + 1);
  const trialScenes = scenes.filter(s => !isBoilerplate(s.file)
    && (scenes.some(x => x.file === s.file && x.icon === '♻️') || count.get(s.file) >= TRIAL_SCENES));
  return { perFile, trialScenes };
}

module.exports = { buildExportMd, diffPlan, cleanDiff };
