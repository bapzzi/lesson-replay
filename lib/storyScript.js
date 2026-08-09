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
    const cur = e.target.closest('.opencur');
    if (cur) vscode.postMessage({ cmd: 'openFile', path: cur.dataset.path });
  });

  // ── "다시 볼 것" 마크: ★ 토글 → 저장 + ★ 칩 노출 갱신 ──
  document.addEventListener('click', (e) => {
    const mk = e.target.closest('.mk');
    if (!mk) return;
    e.preventDefault(); // details 토글로 번지지 않게
    const d = mk.closest('details.scene');
    mk.classList.toggle('on');
    mk.textContent = mk.classList.contains('on') ? '★' : '☆';
    vscode.postMessage({ cmd: 'toggleMark', date: pageDate, key: d.dataset.mark });
    const any = !!document.querySelector('.mk.on');
    const mc = document.querySelector('.mark-chip');
    if (mc) mc.classList.toggle('none', !any);
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
    if (!chip) return;
    document.querySelectorAll('.chip.cur').forEach(c => c.classList.remove('cur'));
    chip.classList.add('cur');
    const byMark = chip.dataset.markfilter === '1';
    const p = byMark ? '★' : chip.dataset.path;
    let shown = 0;
    document.querySelectorAll('details.scene').forEach(d => {
      const on = byMark ? !!d.querySelector('.mk.on') : (!p || d.dataset.path === p);
      d.style.display = on ? '' : 'none';
      if (on && p) shown++;
    });
    // 씬이 하나도 없는 파트는 통째로 접는다 — 남는 화면이 "이 파일의 하루"가 되게
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
      if (p) dayStatEl.textContent = (byMark ? '★ 다시 볼 것' : (chip.dataset.name || '')) + ' · 씬 ' + shown;
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
    const ta = sec.querySelector('.learn textarea');
    if (ta) ta.focus();
  });

  // ── 씬 이력: 펼칠 때 한 번만 diff 로드 (빨강=지운 줄 · 초록=새 줄) ──
  function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function paintDiff(raw) {
    return raw.split('\\n')
      .filter(l => !/^(diff --git|index |--- |\\+\\+\\+ |\\\\ No newline)/.test(l))
      .map(l => {
        const e = escHtml(l);
        if (l.startsWith('+')) return '<span class="da">' + e + '</span>';
        if (l.startsWith('-')) return '<span class="dl">' + e + '</span>';
        if (l.startsWith('@@')) return '<span class="dh">' + e + '</span>';
        return e;
      }).join('\\n');
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
    pre.innerHTML = e.data.text ? paintDiff(e.data.text) : '(변경 없음)';
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

  // ── 액센트 프리셋 ──
  // className 통째 대입 금지: VS Code가 body에 붙이는 테마 클래스(vscode-light 등)가 지워진다
  function setAccent(acc) {
    document.body.classList.remove('acc-warm', 'acc-mono');
    if (acc) document.body.classList.add('acc-' + acc);
    document.querySelectorAll('.acc').forEach(b =>
      b.classList.toggle('cur', b.dataset.acc === acc));
  }
  document.querySelectorAll('.acc').forEach(b => b.addEventListener('click', () => {
    setAccent(b.dataset.acc);
    vscode.postMessage({ cmd: 'setAccent', accent: b.dataset.acc });
  }));
  setAccent(document.body.classList.contains('acc-warm') ? 'warm'
    : document.body.classList.contains('acc-mono') ? 'mono' : '');

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

` + NOTES;
