// storyScript.js — 복기 스토리 뷰의 웹뷰 스크립트 (storyHtml.js가 <script>로 삽입)
// 전제: notesData(복기노트 배열)·sceneData·pageDate가 먼저 정의되어 있다
// 필기 편집 파트는 storyNotes.js로 분할 — 끝에 이어붙여 한 스크립트로 실행된다
const NOTES = require('./storyNotes');
module.exports = `
  const vscode = acquireVsCodeApi();

  // ── 파일 열기(시각 클릭=그 시점 스냅샷 / "현재 파일"=디스크 최신)·날짜 이동·내보내기 ──
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button.time');
    if (t) {
      e.preventDefault(); // 시각 클릭이 details 토글로 번지지 않게
      const d = t.closest('details.scene');
      const s = d && sceneData[Number(d.dataset.idx)];
      if (s) vscode.postMessage({ cmd: 'openSnapshot', path: s.file, sha: s.lastSha, time: s.end });
      return;
    }
    const od = e.target.closest('.opendiff');
    if (od) { // VS Code diff 편집기로 이 구간 비교(IDE 기본 화면)
      const d = od.closest('details.scene');
      const s = d && sceneData[Number(d.dataset.idx)];
      if (s) vscode.postMessage({ cmd: 'openDiff', scene: s });
      return;
    }
    const cur = e.target.closest('.opencur');
    if (cur) { // 씬 정보를 함께 보낸다. 파일 맨 위가 아니라 이 씬의 수정 위치로 연다
      const d = cur.closest('details.scene');
      const s = d && sceneData[Number(d.dataset.idx)];
      vscode.postMessage({ cmd: 'openFile', path: cur.dataset.path, scene: s || null });
    }
  });

  // ── "다시 볼 것" 마크: ★ 토글 → 저장 + ★ 칩 노출 갱신 ──
  document.addEventListener('click', (e) => {
    const mk = e.target.closest('.mk');
    if (!mk) return;
    e.preventDefault(); // details 토글로 번지지 않게
    const d = mk.closest('details.scene');
    mk.classList.toggle('on');
    mk.innerHTML = ic(mk.classList.contains('on') ? 'star-full' : 'star-empty');
    vscode.postMessage({ cmd: 'toggleMark', date: pageDate, key: d.dataset.mark });
    const g = d.closest('.sgroup'); // 묶음 머리의 ★ 표시도 같이
    if (g) g.querySelector('.sg-mk').hidden = !g.querySelector('.sg-body .mk.on');
    const any = !!document.querySelector('.mk.on');
    const mc = document.querySelector('.mark-chip');
    if (mc) mc.classList.toggle('none', !any);
  });

  // ── 씬 정리(⤓ 시간 외로 / ✕ 숨기기): 저장 후 화면을 다시 그린다 ──
  // 커밋은 건드리지 않는다. 배치·표시만 바뀌므로 되돌리기가 항상 가능하다.
  document.addEventListener('click', (e) => {
    const op = e.target.closest('.op');
    if (!op) return;
    e.preventDefault(); // details 토글로 번지지 않게
    const d = op.closest('details.scene');
    vscode.postMessage({ cmd: 'setSceneOp', date: pageDate, key: d.dataset.mark, op: op.dataset.op });
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.chip.unhide')) return;
    e.preventDefault();
    vscode.postMessage({ cmd: 'clearSceneOps', date: pageDate, op: 'hide' });
  });

  // ── 파일 필터 칩: 그 파일의 하루 스토리로 좁힌다 (씬·파트·미니맵·스탯 연동) ──
  const dayStatEl = document.querySelector('.daystat');
  const dayStatHtml = dayStatEl ? dayStatEl.innerHTML : '';
  document.addEventListener('click', (e) => {
    const more = e.target.closest('.chip.more');
    if (more) { // "외 N개" → 숨은 칩 전부 펼침
      document.querySelectorAll('.chip.hid').forEach(c => c.classList.remove('hid'));
      more.remove();
      return;
    }
    const chip = e.target.closest('.chip');
    if (!chip || chip.classList.contains('unhide')) return; // 되돌리기 칩은 필터가 아니다
    document.querySelectorAll('.chip.cur').forEach(c => c.classList.remove('cur'));
    chip.classList.add('cur');
    const byMark = chip.dataset.markfilter === '1';
    const p = byMark ? '★' : chip.dataset.path;
    document.body.classList.toggle('filtering', !!p); // 필터 중에는 연속 씬 묶음을 펼쳐 보인다
    let shown = 0;
    document.querySelectorAll('details.scene').forEach(d => {
      const on = byMark ? !!d.querySelector('.mk.on') : (!p || d.dataset.path === p);
      d.style.display = on ? '' : 'none';
      if (on && p) shown++;
    });
    // 씬이 하나도 없는 파트는 통째로 접는다. 남는 화면이 "이 파일의 하루"가 되게
    document.querySelectorAll('section.chapter').forEach(sec => {
      if (!p) { sec.classList.remove('fhide'); return; }
      const has = [...sec.querySelectorAll('details.scene')]
        .some(d => d.style.display !== 'none');
      sec.classList.toggle('fhide', !has);
    });
    // 미니맵·스탯도 같은 데이터를 말하게
    document.querySelectorAll('.mm-part').forEach(b => {
      const sec = document.getElementById(b.dataset.target);
      b.classList.toggle('dim', !!p && (!sec || sec.classList.contains('fhide')));
    });
    if (dayStatEl) {
      dayStatEl.innerHTML = p ? '' : dayStatHtml;
      if (p) dayStatEl.textContent = tt('web.filterStat', { name: byMark ? '★ ' + T['web.marked'] : (chip.dataset.name || ''), n: shown });
    }
  });

  // ── ♻️ 점프: 스탯 줄의 ♻️ 클릭 → 갈아엎은 씬들을 순환 이동 ──
  let rwCursor = -1;
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.rwjump')) return;
    const rws = [...document.querySelectorAll('details.scene')]
      .filter(d => d.querySelector('.rwb') && d.style.display !== 'none');
    if (!rws.length) return;
    rwCursor = (rwCursor + 1) % rws.length;
    const d = rws[rwCursor];
    const g = d.closest('.sgroup');
    if (g) g.classList.add('open');
    d.open = true;
    d.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // ── 빈 파트: 접힌 한 줄 → 클릭 시 정리 칸 펼침 ──
  document.addEventListener('click', (e) => {
    const t = e.target.closest('.ep-toggle');
    if (!t) return;
    const sec = t.closest('section.chapter');
    sec.classList.remove('ep');
    t.remove();
    openLearn(sec.querySelector('.learn'));
  });

  // ── 배운 것: 「＋ 배운 것」 → 입력칸 펼침 ──
  function openLearn(l) {
    if (!l) return;
    l.classList.remove('empty');
    const ta = l.querySelector('textarea');
    fit(ta);
    ta.focus();
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.learn-add');
    if (b) openLearn(b.closest('.learn'));
  });

  // ── 같은 파일 연속 씬 묶음: 머리 클릭 → 구간별 행 펼침/접기 ──
  document.addEventListener('click', (e) => {
    const h = e.target.closest('.sg-head');
    if (h) h.parentElement.classList.toggle('open');
  });

  // ── 씬 이력: 펼칠 때 한 번만 diff 로드 (빨강=지운 줄 · 초록=새 줄) ──
  function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  // diff = IntelliJ식 줄: [이전 줄 번호][새 줄 번호][본문], 추가·삭제는 줄 배경색. hunk 머리는 구분 줄
  // 문법 색칠: highlight.js가 그 언어를 알면 줄 단위로 칠하고, 모르거나 실패하면 글자 그대로
  function hl(text, lang) {
    if (lang && window.hljs && window.hljs.getLanguage(lang)) {
      try { return window.hljs.highlight(text, { language: lang, ignoreIllegals: true }).value; } catch (e) { /* 아래로 */ }
    }
    return escHtml(text);
  }
  function paintDiff(raw, lang) {
    let a = 0, b = 0, out = '';
    const row = (cls, la, lb, text) => '<div class="dline' + (cls ? ' ' + cls : '') + '"><span class="ln">' + la
      + '</span><span class="ln">' + lb + '</span><span class="tx">' + hl(text, lang) + '</span></div>';
    for (const l of raw.split('\\n')) {
      if (/^(diff --git|index |--- |\\+\\+\\+ |\\\\ No newline|new file mode|deleted file mode)/.test(l)) continue;
      const h = l.match(/^@@ -(\\d+)(?:,\\d+)? \\+(\\d+)(?:,\\d+)? @@(.*)$/);
      if (h) { a = +h[1]; b = +h[2]; out += '<div class="dline hunk">' + escHtml(l) + '</div>'; continue; }
      if (l.startsWith('+')) { if (!b) b = 1; out += row('add', '', b, l.slice(1)); b++; }
      else if (l.startsWith('-')) { if (!a) a = 1; out += row('del', a, '', l.slice(1)); a++; }
      else { if (!a && !b) { a = b = 1; } out += row('', a, b, l.slice(1)); a++; b++; }
    }
    return out;
  }
  const diffLoaded = new Set();
  document.addEventListener('toggle', (e) => {
    const d = e.target;
    if (d.tagName !== 'DETAILS' || !d.open || !d.classList.contains('scene')) return;
    const idx = Number(d.dataset.idx);
    if (diffLoaded.has(idx)) return;
    diffLoaded.add(idx);
    vscode.postMessage({ cmd: 'getDiff', idx, scene: sceneData[idx] });
  }, true);
  window.addEventListener('message', (e) => {
    if (e.data.cmd !== 'diff') return;
    const d = document.querySelector('details.scene[data-idx="' + e.data.idx + '"]');
    if (!d) return;
    const pre = d.querySelector('.diff');
    pre.removeAttribute('aria-busy');
    pre.innerHTML = e.data.text ? paintDiff(e.data.text, (sceneData[e.data.idx] || {}).lang) : '<div class="empty">' + T['web.noChange'] + '</div>';
    // 기본 높이(≤380px)는 유지하되, 이후 우하단 핸들로 자유롭게 늘릴 수 있게 캡 해제
    pre.style.height = Math.min(pre.scrollHeight + 4, 380) + 'px';
    pre.style.maxHeight = 'none';
  });
  for (const id of ['prev', 'next']) {
    document.getElementById(id).addEventListener('click', (e) => {
      const d = e.currentTarget.dataset.date;
      if (d) vscode.postMessage({ cmd: 'openDay', date: d });
    });
  }
  for (const id of ['export', 'export2']) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () =>
      vscode.postMessage({ cmd: 'export', date: pageDate }));
  }

  // ── 배운 것: 자동 확장 + 0.6초 디바운스 저장 + 포커스 아웃 즉시 저장 ──
  function fit(t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }
  document.querySelectorAll('.learn textarea').forEach(fit);
  let sumTimer = null;
  function flushSummary(t) {
    clearTimeout(sumTimer);
    vscode.postMessage({ cmd: 'saveSummary', date: pageDate, part: t.dataset.part, text: t.value });
  }
  document.addEventListener('input', (e) => {
    const t = e.target.closest('.learn textarea');
    if (!t) return;
    fit(t);
    clearTimeout(sumTimer);
    sumTimer = setTimeout(() => flushSummary(t), 600);
  });
  document.addEventListener('blur', (e) => {
    const t = e.target && e.target.closest && e.target.closest('.learn textarea');
    if (t) flushSummary(t);
  }, true);
  window.addEventListener('message', (e) => {
    if (e.data.cmd !== 'summarySaved') return;
    const el = document.querySelector('.saved[data-part="' + e.data.part + '"]');
    if (el) { el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 1400); }
  });

  // ── 미니맵: 클릭 점프 + 스크롤 스파이 ──
  document.querySelectorAll('.mm-part').forEach(b => b.addEventListener('click', () => {
    const el = document.getElementById(b.dataset.target);
    if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }));
  const partSecs = [...document.querySelectorAll('section.chapter.part')];
  if (partSecs.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        document.querySelectorAll('.mm-part.cur').forEach(x => x.classList.remove('cur'));
        const mm = document.querySelector('.mm-part[data-target="' + en.target.id + '"]');
        if (mm) mm.classList.add('cur');
      }
    }, { rootMargin: '-70px 0px -70% 0px' });
    partSecs.forEach(s => io.observe(s));
  }

  // ── 키보드: ↑↓로 행 이동(VS Code 목록처럼). Enter·Space로 펼침은 summary·버튼 기본 동작 ──
  function rows() {
    return [...document.querySelectorAll('details.scene > summary, .sg-head, .nz > summary, .note-item')]
      .filter(el => el.offsetParent !== null && el.getClientRects().length);
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    if (e.target.closest('textarea, input')) return;
    const list = rows();
    const cur = e.target.closest('summary, .sg-head, .note-item');
    const i = cur ? list.indexOf(cur) : -1;
    const next = list[e.key === 'ArrowDown' ? Math.min(list.length - 1, i + 1) : Math.max(0, i - 1)];
    if (!next) return;
    e.preventDefault();
    next.focus();
    next.scrollIntoView({ block: 'nearest' });
  });
  document.addEventListener('keydown', (e) => { // 필기 행에서 Enter = 수정
    if (e.key !== 'Enter' || !e.target.classList || !e.target.classList.contains('note-item')) return;
    e.preventDefault();
    const tx = e.target.querySelector('.ntext');
    if (tx) tx.click();
  });

` + NOTES;
