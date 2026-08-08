// storyHtml.js — 복기 스토리 뷰(웹뷰) HTML. 스타일=storyCss.js, 스크립트=storyScript.js
// 설계: "하루가 한 줄로 이어지는 미니멀 복기 노트"
//   상단 고정 미니맵(파트 세그먼트 + 활동 밀도 히트) + 끊기지 않는 세로 레일
//   씬 = 상태색 점 + 파일명(클릭=원본 열기) + 시각. 수치·diff·코드 전문 없음
//   필기는 스크립트가 복기노트 JSON에서 그린다(추가·수정·삭제·드래그 재배치)
const { toMin } = require('./model');
const CSS = require('./storyCss');
const SCRIPT = require('./storyScript');

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ICON_CLASS = { '🟢': 'g', '🟡': 'y', '🔴': 'r', '♻️': 'p' };
const ICON_LABEL = { '🟢': '새로 만듦', '🟡': '수정', '🔴': '삭제', '♻️': '지웠다 다시 만듦' };

function chId(key) { return 'ch-' + key.replace(/[^\w가-힣]/g, '_'); }

// 씬 = 접힌 카드. 행에 스탯(+n/−n)·첫 변경 시그니처까지 — 클릭 전에도 "뭘 했는지" 보이게
// 행 클릭=이력 펼침(♻️ 씬은 지우기 전 판과의 비교가 기본) / 시각 클릭=그 시점 스냅샷 열기
// 시각은 우측 끝 고정 컬럼 — 세로로 훑으면 시간 축이 읽힌다
function sceneHtml(s, idx) {
  const cls = ICON_CLASS[s.icon] || 'y';
  const range = s.start === s.end ? s.start : `${s.start}~${s.end}`;
  const tip = [s.file, ICON_LABEL[s.icon], s.extras.length ? `함께: ${s.extras.slice(0, 4).join(', ')}` : '']
    .filter(Boolean).join(' · ');
  const st = s.stat || {};
  const stat = (st.add || st.del)
    ? `<span class="stat">${st.add ? `<i class="sa">+${st.add}</i>` : ''}${st.del ? `<i class="sd">−${st.del}</i>` : ''}</span>` : '';
  const sig = st.sig ? `<code class="sig">${esc(st.sig)}</code>` : '';
  const badge = s.icon === '♻️' ? `<span class="rwb">♻️ 갈아엎음</span>` : '';
  const rwNote = s.icon === '♻️' && s.reworkSha
    ? `<span class="rwnote">지우기 전 판 ↔ 새 판 비교</span>` : '';
  return `
  <details class="item scene" data-seq="${toMin(s.start)}" data-idx="${idx}" data-path="${esc(s.file)}">
    <summary title="클릭하면 이 구간의 변경 이력이 펼쳐집니다">
      <span class="node ${cls}${s.icon === '♻️' ? ' rw' : ''}">${s.icon === '🔴' ? '✕' : ''}</span>
      <span class="file" title="${esc(tip)}">${esc(s.file.split('/').pop())}</span>
      ${stat}${badge}${sig}
      <button class="time" title="이 시점(${range} 마지막 저장)의 파일 열기">${range}</button>
      <span class="chev">▸</span>
    </summary>
    <div class="scene-actions">${rwNote}<button class="opencur" data-path="${esc(s.file)}" title="지금 디스크에 있는 최신 파일">현재 파일 열기 ↗</button></div>
    <pre class="diff">불러오는 중…</pre>
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
    <summary><span class="node nzn"></span>🧹 일괄 작업 <span class="time">${n.time}</span></summary>
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

function render(model, summaries, nav, opts) {
  summaries = summaries || {};
  nav = nav || {};
  opts = opts || {};
  const accent = opts.accent === 'warm' || opts.accent === 'mono' ? opts.accent : '';
  const notes = opts.notes || [];

  const sceneData = [];
  const chaptersHtml = model.chapters.map(ch => {
    // 필기는 스크립트가 그린다 — 서버 렌더는 씬·일괄 작업만
    const items = ch.items.map(it => {
      if (it.type === 'note') return '';
      if (it.type === 'noise') return noiseHtml(it);
      sceneData.push({ file: it.file, firstSha: it.firstSha, lastSha: it.lastSha,
                       reworkSha: it.reworkSha || null, end: it.end });
      return sceneHtml(it, sceneData.length - 1);
    }).join('');
    if (!ch.isPart) {
      return `
    <section class="chapter gap" id="${chId(ch.key)}" data-smin="${toMin(ch.range.split('~')[0] || '00:00') || 0}">
      <div class="gap-h"><span>${esc(ch.label)}</span></div>
      <div class="tl">${items}</div>
    </section>`;
    }
    // 빈 파트(기록·정리 모두 없음)는 한 줄로 접는다 — 빈 껍데기가 화면을 차지하지 않게
    const isEmpty = !ch.items.length && !(summaries[ch.label] || '').trim();
    return `
    <section class="chapter part${isEmpty ? ' ep' : ''}" id="${chId(ch.key)}" data-smin="${ch.startMin}" data-emin="${ch.endMin}">
      <div class="ch-h"><span class="ph-node"></span><span class="ch-label">${esc(ch.label)}</span>
        <span class="ch-range">${esc(ch.range)}</span>
        ${isEmpty ? `<button class="ep-toggle">기록 없음 · ＋ 정리 남기기</button>` : ''}</div>
      <div class="ep-body">
      <div class="learn">
        <textarea data-part="${esc(ch.label)}" rows="1"
          placeholder="이 파트에서 배운 것">${esc(summaries[ch.label] || '')}</textarea>
        <span class="saved" data-part="${esc(ch.label)}">✓</span>
      </div>
      <div class="tl">${items}</div>
      </div>
    </section>`;
  }).join('');

  const dow = ['일', '월', '화', '수', '목', '금', '토'][new Date(`${model.date}T12:00:00`).getDay()];
  const emptyDay = model.itemCount === 0 && !notes.length;

  const body = emptyDay ? `
  <div class="empty-day">
    <div class="ed-icon">🎬</div>
    <p><b>이 날짜에는 기록된 스냅샷이 없습니다.</b></p>
    <p>① 하단 상태바가 "⏺ 수업 기록중"인지 확인 → ② 코드를 저장(Ctrl+S) → ③ 20초 뒤 스냅샷이 쌓입니다.</p>
  </div>` : `<div class="day">${chaptersHtml}</div>`;

  // </script> 조기 종료 방지
  const notesJson = JSON.stringify(notes).replace(/</g, '\\u003c');

  const rwCount = model.chapters.flatMap(c => c.items)
    .filter(i => i.type === 'scene' && i.icon === '♻️').length;
  const statLine = emptyDay ? '' :
    `<span class="daystat">파일 ${model.totalFiles} · 씬 ${model.sceneCount}${rwCount ? ` · <button class="rwjump" title="갈아엎은 씬으로 이동">♻️ ${rwCount}</button>` : ''}${notes.length ? ` · 필기 ${notes.length}` : ''}</span>`;
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
      title="${esc(f.path)} — 이 파일의 씬만 보기">${esc(chipLabel(f))}${f.scenes > 1 ? `<span class="cnt">×${f.scenes}</span>` : ''}</button>`;
  const overflow = model.fileList.length > CHIP_MAX
    ? `<button class="chip more" title="나머지 파일 칩 펼치기">… 외 ${model.fileList.length - CHIP_MAX}개</button>` : '';
  const chips = (!emptyDay && model.fileList.length > 1) ? `
  <div class="chips"><button class="chip cur" data-path="">전체</button>${model.fileList.map((f, i) => chipHtml(f, i >= CHIP_MAX)).join('')}${overflow}</div>` : '';

  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>${CSS}</style></head>
<body class="${accent ? 'acc-' + accent : ''}">
  <div class="top"><h1>${esc(model.date)} <span class="dow">${dow}</span></h1>
    ${statLine}
    <div class="accents" title="복기 화면 색 바꾸기">
      <button class="acc" data-acc="" title="기본"></button>
      <button class="acc" data-acc="warm" title="웜"></button>
      <button class="acc" data-acc="mono" title="모노"></button>
    </div></div>
  <div class="toolbar">
    <button id="prev" ${nav.prev ? `data-date="${esc(nav.prev)}"` : 'disabled'}>◀ ${nav.prev ? esc(nav.prev) : ''}</button>
    <button id="next" ${nav.next ? `data-date="${esc(nav.next)}"` : 'disabled'}>${nav.next ? esc(nav.next) : ''} ▶</button>
    <span class="legend">🟢 새로 만듦 · 🟡 수정 · <b class="lr">✕</b> 삭제 · ♻️ 갈아엎음 · 📝 필기</span>
    <span class="sp"></span>
    <button id="export" title="프롬프트+배운 것+필기+코드 diff를 md 한 파일로 저장합니다">TIL 원자재로 내보내기</button>
  </div>
  ${emptyDay ? '' : minimapHtml(model)}
  ${chips}
  ${body}
<script>
  const notesData = ${notesJson};
  const sceneData = ${JSON.stringify(sceneData).replace(/</g, '\\u003c')};
  const pageDate = ${JSON.stringify(model.date)};
${SCRIPT}
</script>
</body></html>`;
}

module.exports = { render };
