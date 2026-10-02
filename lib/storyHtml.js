// storyHtml.js: 복기 스토리 뷰(웹뷰) HTML. 스타일=storyCss.js, 스크립트=storyScript.js, 아이콘=storyIcons.js
// 설계(v1.5.0 IDE 마감): 레퍼런스 = GitHub Primer Timeline(세로선 + 배지 + 구간 구분선) ·
//   IntelliJ Local History(굵지 않은 파일명, 회색 시각, 오른쪽 정렬 메타, 줄 배경 diff + 줄 번호)
//   필기 = 원형 배지(하루의 이야기), 코드 변경 = 배경 없는 작은 아이콘(세부). 위계를 배지 크기로 만든다
//   필기·같은 파일 연속 씬 묶음은 스크립트가 그린다(필기는 추가·수정·삭제·드래그로 위치가 바뀌므로)
// 화면 카피 = 명사형 개조식(웹 카피 규칙). 줄표로 절을 잇지 않는다
const { toMin } = require('./model');
const CSS = require('./storyCss');
const SCRIPT = require('./storyScript');
const { ICONS, icon } = require('./storyIcons');

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ICON_CLASS = { '🟢': 'g', '🟡': 'y', '🔴': 'r', '♻️': 'p' };
const ICON_LABEL = { '🟢': '새로 만듦', '🟡': '수정', '🔴': '삭제', '♻️': '지웠다 다시 만듦' };
const NODE_ICON = { g: 'diff-added', y: 'diff-modified', r: 'diff-removed', p: 'sync' };

// 변경량 막대: 하루 최대 변경량 대비 제곱근 비율(작은 변경도 보이게), 최대 48px. 초록=추가, 빨강=삭제
function barHtml(add, del, max) {
  const tot = (add || 0) + (del || 0);
  if (!tot) return '';
  const w = Math.max(2, Math.round(Math.sqrt(tot / Math.max(max, 1)) * 48));
  const wa = Math.round(w * (add || 0) / tot), wd = w - wa;
  return `<span class="bar" aria-hidden="true">${wa ? `<i class="ba" style="width:${wa}px"></i>` : ''}${wd ? `<i class="bd" style="width:${wd}px"></i>` : ''}</span>`;
}

function chId(key) { return 'ch-' + key.replace(/[^\w가-힣]/g, '_'); }

// 씬 = 접힌 행. 노드 옆 시각 열(필기와 같은 자리) → 파일명 → 첫 변경 요약 → 오른쪽 끝에 변경량
// 행 클릭=이력 펼침(♻️ 씬은 지우기 전 판과의 비교가 기본) / 시각 클릭=그 시점 스냅샷 열기
function sceneHtml(s, idx, marked, statMax) {
  const cls = ICON_CLASS[s.icon] || 'y';
  const range = s.start === s.end ? s.start : `${s.start}~${s.end}`;
  const tip = [s.file, ICON_LABEL[s.icon], s.extras.length ? `함께: ${s.extras.slice(0, 4).join(', ')}` : '']
    .filter(Boolean).join(' · ');
  const st = s.stat || {};
  const stat = (st.add || st.del)
    ? `<span class="stat">${st.add ? `<i class="sa">+${st.add}</i>` : ''}${st.del ? `<i class="sd">−${st.del}</i>` : ''}</span>` : '';
  const sig = `<code class="sig">${st.sig ? esc(st.sig) : ''}</code>`;
  const badge = s.icon === '♻️' ? `<span class="rwb">갈아엎음</span>` : '';
  const rwNote = s.icon === '♻️' && s.reworkSha
    ? `<span class="rwnote">지우기 전 판 ↔ 새 판</span>` : '';
  const markKey = `${s.file}|${s.start}`;
  return `
  <details class="item scene" data-seq="${toMin(s.start)}" data-idx="${idx}" data-path="${esc(s.file)}" data-mark="${esc(markKey)}"
    data-cls="${cls}" data-add="${st.add || 0}" data-del="${st.del || 0}" data-start="${s.start}" data-end="${s.end}">
    <summary title="클릭: 이 구간의 변경 이력">
      <span class="node ${cls}" role="img" aria-label="${ICON_LABEL[s.icon] || '수정'}">${icon(NODE_ICON[cls])}</span>
      <button class="time" title="이 시점(${range} 마지막 저장)의 파일 열기">${range}</button>
      <span class="file" title="${esc(tip)}">${esc(s.file.split('/').pop())}</span>
      ${badge}${sig}
      <span class="meta">${barHtml(st.add, st.del, statMax)}${stat}</span>
      <span class="acts">
        <button class="act mk${marked ? ' on' : ''}" title="다시 볼 것 표시 (사이드바·★ 칩에 모임)">${icon(marked ? 'star-full' : 'star-empty')}</button>
        <button class="act op off${s.movedOff ? ' on' : ''}" data-op="off" title="${s.movedOff ? '파트로 되돌리기' : '수업과 무관한 변경: 「시간 외」로 보내기'}">${icon('arrow-down')}</button>
        <button class="act op hide" data-op="hide" title="복기·TIL 내보내기에서 숨기기 (커밋은 그대로)">${icon('eye-closed')}</button>
      </span>
      ${icon('chevron-right', 'chev')}
    </summary>
    <div class="diffbox">
      <div class="diff-tools">${rwNote}<span class="sp"></span>
        <button class="dbtn opendiff" title="VS Code diff 편집기에서 이 구간 비교">${icon('diff')}diff 편집기로 열기</button>
        <button class="dbtn opencur" data-path="${esc(s.file)}" title="디스크의 최신 파일을 이 씬의 수정 위치로 열기">${icon('go-to-file')}현재 파일 열기</button>
      </div>
      <div class="diff" aria-busy="true"><div class="skel"><i></i><i></i><i></i><i></i></div></div>
    </div>
  </details>`;
}

function noiseHtml(n) {
  const shown = n.files.slice(0, 200);
  const rows = shown.map(f =>
    `<div class="nfile"><span class="st st-${f.status}">${f.status}</span>${esc(f.path)}</div>`).join('');
  const more = n.files.length > shown.length
    ? `<div class="nfile dim">… 외 ${n.files.length - shown.length}개</div>` : '';
  return `
  <details class="item nz" data-seq="${toMin(n.time)}">
    <summary><span class="node z">${icon('git-commit')}</span><span class="time">${n.time}</span>일괄 작업 · 파일 ${n.files.length}개${icon('chevron-right', 'chev')}</summary>
    <div class="nlist">${rows}${more}</div>
  </details>`;
}

// 미니맵: 파트=폭 비례 세그먼트, 활동 밀도=배경 히트(진할수록 스냅샷 많음)
function minimapHtml(model) {
  const parts = model.chapters.filter(c => c.isPart);
  if (!parts.length) return '';
  const BUCKET = 5; // 분
  let dayMax = 1;
  const partBuckets = parts.map(p => {
    const n = Math.max(1, Math.ceil((p.endMin - p.startMin) / BUCKET));
    const buckets = new Array(n).fill(0);
    for (const it of p.items) {
      if (it.type !== 'scene') continue;
      for (const t of it.times) {
        const i = Math.min(n - 1, Math.floor((toMin(t) - p.startMin) / BUCKET));
        buckets[i]++;
      }
    }
    dayMax = Math.max(dayMax, ...buckets);
    return buckets;
  });
  const segs = [];
  let cursor = model.dayStartMin;
  parts.forEach((p, pi) => {
    if (p.startMin > cursor) segs.push(`<div class="mm-gap" style="flex-grow:${p.startMin - cursor}"></div>`);
    const b = partBuckets[pi];
    const stops = b.map((v, i) => {
      const a = v ? Math.round(15 + (v / dayMax) * 60) : 0;
      const c = a ? `color-mix(in srgb, var(--accent) ${a}%, transparent)` : 'transparent';
      return `${c} ${(i / b.length * 100).toFixed(1)}% ${((i + 1) / b.length * 100).toFixed(1)}%`;
    }).join(', ');
    segs.push(`<button class="mm-part" style="flex-grow:${p.endMin - p.startMin};background-image:linear-gradient(90deg, ${stops})"
      data-target="${chId(p.key)}" title="${esc(p.label)} ${esc(p.range)}">
      <span class="mm-label">${esc(p.label.replace('파트', ''))}</span></button>`);
    cursor = p.endMin;
  });
  return `<nav class="minimap" aria-label="하루 타임라인">
    <span class="mm-time">${esc(parts[0].range.split('~')[0])}</span>
    <div class="mm-bar">${segs.join('')}</div>
    <span class="mm-time">${esc(parts[parts.length - 1].range.split('~')[1])}</span>
  </nav>`;
}

// 배운 것: 비어 있으면 「＋ 배운 것」 한 줄로 접는다(9월 실사용상 대부분 비어 있었다). 적은 파트는 그대로
function learnHtml(label, text) {
  const empty = !text.trim();
  return `
      <div class="learn${empty ? ' empty' : ''}">
        <button class="learn-add">＋ 배운 것</button>
        <textarea data-part="${esc(label)}" rows="1" placeholder="이 파트에서 배운 것">${esc(text)}</textarea>
        <span class="saved" data-part="${esc(label)}">저장됨</span>
      </div>`;
}

const LEGEND = [['n', 'edit', '필기'], ['g', 'diff-added', '새로 만듦'], ['y', 'diff-modified', '수정'],
  ['r', 'diff-removed', '삭제'], ['p', 'sync', '갈아엎음']]
  .map(([c, ic, l]) => `<span class="lg"><i class="node ${c}">${icon(ic)}</i>${l}</span>`).join('')
  + `<span class="lg">${icon('star-full', 'lg-star')}다시 볼 것</span>`;

function render(model, summaries, nav, opts) {
  summaries = summaries || {};
  nav = nav || {};
  opts = opts || {};
  const notes = opts.notes || [];
  const marks = opts.marks || [];

  const sceneData = [];
  const statMax = Math.max(1, ...model.chapters.flatMap(c => c.items)
    .filter(i => i.type === 'scene').map(i => ((i.stat || {}).add || 0) + ((i.stat || {}).del || 0)));
  const chaptersHtml = model.chapters.map(ch => {
    // 필기는 스크립트가 그린다. 서버 렌더는 씬·일괄 작업만
    const items = ch.items.map(it => {
      if (it.type === 'note') return '';
      if (it.type === 'noise') return noiseHtml(it);
      sceneData.push({ file: it.file, firstSha: it.firstSha, lastSha: it.lastSha,
                       reworkSha: it.reworkSha || null, start: it.start, end: it.end });
      return sceneHtml(it, sceneData.length - 1, marks.includes(`${it.file}|${it.start}`), statMax);
    }).join('');
    if (!ch.isPart) {
      return `
    <section class="chapter gap" id="${chId(ch.key)}" data-smin="${toMin(ch.range.split('~')[0] || '00:00') || 0}">
      <div class="gap-h"><span>${esc(ch.label)}</span></div>
      <div class="tl">${items}</div>
    </section>`;
    }
    // 빈 파트(기록·정리 모두 없음)는 한 줄로 접는다. 빈 껍데기가 화면을 차지하지 않게
    const sum = summaries[ch.label] || '';
    const isEmpty = !ch.items.length && !sum.trim();
    return `
    <section class="chapter part${isEmpty ? ' ep' : ''}" id="${chId(ch.key)}" data-smin="${ch.startMin}" data-emin="${ch.endMin}">
      <div class="ch-h"><span class="ch-label">${esc(ch.label)}</span>
        <span class="ch-range">${esc(ch.range)}</span>
        ${isEmpty ? `<button class="ep-toggle">기록 없음 · ＋ 배운 것</button>` : ''}</div>
      <div class="ep-body">${learnHtml(ch.label, sum)}
      <div class="tl">${items}</div>
      </div>
    </section>`;
  }).join('');

  const dow = ['일', '월', '화', '수', '목', '금', '토'][new Date(`${model.date}T12:00:00`).getDay()];
  const emptyDay = model.itemCount === 0 && !notes.length;

  const body = emptyDay ? `
  <div class="empty-day">
    <p><b>이 날짜의 스냅샷 없음</b></p>
    <p>① 하단 상태바 「⏺ 수업 기록중」 확인 → ② 코드 저장(Ctrl+S) → ③ 20초 뒤 스냅샷 기록</p>
  </div>` : `<div class="day">${chaptersHtml}</div>
  <div class="end-card">
    <p>복기 끝</p>
    <button id="export2">TIL 원자재로 내보내기</button>
  </div>`;

  // </script> 조기 종료 방지
  const notesJson = JSON.stringify(notes).replace(/</g, '\\u003c');

  const rwCount = model.chapters.flatMap(c => c.items)
    .filter(i => i.type === 'scene' && i.icon === '♻️').length;
  const statLine = emptyDay ? '' :
    `<span class="daystat">파일 ${model.totalFiles} · 씬 ${model.sceneCount}${rwCount ? ` · <button class="rwjump" title="갈아엎은 씬으로 이동">갈아엎음 ${rwCount}</button>` : ''}${notes.length ? ` · 필기 ${notes.length}` : ''}</span>`;
  // 칩: 동명 파일은 부모 폴더로 구분, 씬 수 표시, 15개째부터는 "외 N개"로 펼침(조용한 컷 금지)
  const nameCount = new Map();
  for (const f of model.fileList) nameCount.set(f.name, (nameCount.get(f.name) || 0) + 1);
  const chipLabel = (f) => {
    if (nameCount.get(f.name) < 2) return f.name;
    const seg = f.path.split('/');
    return seg.length > 1 ? `${seg[seg.length - 2]}/${f.name}` : f.name;
  };
  const CHIP_MAX = 14;
  const chipHtml = (f, hid) =>
    `<button class="chip${hid ? ' hid' : ''}" data-path="${esc(f.path)}" data-name="${esc(chipLabel(f))}"
      title="${esc(f.path)}: 이 파일의 씬만 보기">${esc(chipLabel(f))}${f.scenes > 1 ? `<span class="cnt">${f.scenes}</span>` : ''}</button>`;
  const overflow = model.fileList.length > CHIP_MAX
    ? `<button class="chip more" title="나머지 파일 칩 펼치기">외 ${model.fileList.length - CHIP_MAX}개</button>` : '';
  const markChip = `<button class="chip mark-chip${marks.length ? '' : ' none'}" data-markfilter="1"
    title="★ 표시한 씬만 보기">${icon('star-full')}다시 볼 것</button>`;
  // 숨긴 씬이 있으면 몇 개를 감췄는지 화면에 남긴다(조용한 누락 금지)
  const hiddenChip = model.hiddenCount
    ? `<button class="chip unhide" data-unhide="1" title="숨긴 씬을 모두 복기에 되돌리기">숨김 ${model.hiddenCount}개 · 되돌리기</button>` : '';
  const chips = (!emptyDay && (model.fileList.length > 1 || model.hiddenCount)) ? `
  <div class="chips"><button class="chip cur" data-path="">전체</button>${markChip}${hiddenChip}${model.fileList.map((f, i) => chipHtml(f, i >= CHIP_MAX)).join('')}${overflow}</div>` : '';

  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>${CSS}</style></head>
<body>
  <div class="top"><h1>${esc(model.date)} <span class="dow">${dow}</span></h1>
    ${statLine}</div>
  <div class="toolbar">
    <button id="prev" ${nav.prev ? `data-date="${esc(nav.prev)}"` : 'disabled'}>◀ ${nav.prev ? esc(nav.prev) : ''}</button>
    <button id="next" ${nav.next ? `data-date="${esc(nav.next)}"` : 'disabled'}>${nav.next ? esc(nav.next) : ''} ▶</button>
    <span class="legend-i" tabindex="0">표기
      <span class="legend-pop">${LEGEND}</span></span>
    <span class="sp"></span>
    <button id="export" title="배운 것·필기·코드 diff를 md 한 파일로 저장 (설정 includeTilPrompt를 켜면 AI 요청 프롬프트 포함)">TIL 원자재로 내보내기</button>
  </div>
  ${emptyDay ? '' : minimapHtml(model)}
  ${chips}
  ${body}
<script>
  const notesData = ${notesJson};
  const sceneData = ${JSON.stringify(sceneData).replace(/</g, '\\u003c')};
  const pageDate = ${JSON.stringify(model.date)};
  const statMax = ${statMax};
  const ICONS = ${JSON.stringify(ICONS)};
  function ic(name, cls) {
    return '<svg class="ci' + (cls ? ' ' + cls : '') + '" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' + ICONS[name] + '</svg>';
  }
${SCRIPT}
</script>
</body></html>`;
}

module.exports = { render };
