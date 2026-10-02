// storyNotes.js: 복기 뷰 웹뷰 스크립트 中 필기 편집·연속 씬 묶음 파트 (storyScript.js가 이어붙임)
// 전제: notesData·pageDate·vscode·fit()·partSecs가 앞 스크립트(storyScript)에서 정의됨
module.exports = `
  // ── 필기: 렌더·추가·수정·삭제·드래그 ──
  let saveTimer = null;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() =>
      vscode.postMessage({ cmd: 'saveNotes', date: pageDate, notes: notesData }), 300);
  }
  function sectionFor(seq) {
    let best = null, bestD = Infinity;
    for (const s of partSecs) {
      const a = Number(s.dataset.smin), b = Number(s.dataset.emin);
      if (seq >= a && seq < b) return s;
      const d = seq < a ? a - seq : seq - b;
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }
  // 필기 = 상자 없이 한 줄: 빈 원 노드 + 시각 + 본문. 손잡이·삭제는 호버·포커스 때만
  function noteEl(n) {
    const el = document.createElement('div');
    el.className = 'item note-item';
    el.dataset.seq = n.seq; el.dataset.id = n.id;
    el.draggable = true;
    el.tabIndex = 0; // ↑↓ 키보드 이동 대상
    el.innerHTML = '<span class="node n" role="img" aria-label="' + T['web.note'] + '">' + ic('edit') + '</span>'
      + '<span class="ntime">' + (n.time || '') + '</span>'
      + '<span class="ntext"></span>'
      + '<span class="acts"><span class="act handle" title="' + T['web.dragTip'] + '" aria-hidden="true">' + ic('gripper') + '</span>'
      + '<button class="act ndel" title="' + T['web.noteDelete'] + '">' + ic('close') + '</button></span>';
    el.querySelector('.ntext').textContent = n.text;
    return el;
  }
  function zoneEl(prevSeq, nextSeq) {
    const z = document.createElement('div');
    z.className = 'addzone';
    z.dataset.prev = prevSeq; z.dataset.next = nextSeq;
    z.title = T['web.noteAdd'];
    return z;
  }
  function midSeq(z) {
    const a = Number(z.dataset.prev);
    let b = Number(z.dataset.next);
    if (b <= a) b = a + 1;
    return a + (b - a) / 2;
  }
  // ── 같은 파일 연속 씬 묶기 ──
  // 사이에 필기·다른 파일이 끼면 묶지 않는다(필기와 코드의 교차가 이 화면의 핵심이라).
  // 필기가 옮겨질 때마다 renderNotes가 풀고 다시 묶는다. 열려 있던 묶음은 첫 씬 기준으로 기억
  function unwrapGroups(tl, openSet) {
    tl.querySelectorAll(':scope > .sgroup').forEach(g => {
      const members = [...g.querySelectorAll(':scope > .sg-body > details.scene')];
      if (g.classList.contains('open') && members[0]) openSet.add(members[0].dataset.idx);
      for (const d of members) tl.insertBefore(d, g);
      g.remove();
    });
  }
  function groupHead(run) {
    const first = run[0], last = run[run.length - 1];
    const cls = run.some(d => d.dataset.cls === 'p') ? 'p' : first.dataset.cls;
    const NODE_ICON = { g: 'diff-added', y: 'diff-modified', r: 'diff-removed', p: 'sync' };
    const add = run.reduce((s, d) => s + Number(d.dataset.add || 0), 0);
    const del = run.reduce((s, d) => s + Number(d.dataset.del || 0), 0);
    const h = document.createElement('button');
    h.className = 'sg-head';
    h.title = T['web.groupTip'];
    h.innerHTML = '<span class="node ' + cls + '">' + ic(NODE_ICON[cls] || 'diff-modified') + '</span>'
      + '<span class="sg-time">' + first.dataset.start + '~' + last.dataset.end + '</span>'
      + '<span class="file"></span><span class="sg-n">' + tt('web.segments', { n: run.length }) + '</span>'
      + (run.some(d => d.querySelector('.rwb')) ? '<span class="rwb">' + T['web.rework'] + '</span>' : '')
      + '<span class="sig"></span>'
      + '<span class="meta">' + barHtml(add, del)
      + (add || del ? '<span class="stat">' + (add ? '<i class="sa">+' + add + '</i>' : '')
        + (del ? '<i class="sd">−' + del + '</i>' : '') + '</span>' : '') + '</span>'
      + '<span class="acts"><span class="act sg-mk" title="' + T['web.groupMarkTip'] + '">' + ic('star-full') + '</span></span>'
      + ic('chevron-right', 'chev');
    h.querySelector('.file').textContent = first.querySelector('.file').textContent;
    h.querySelector('.sg-mk').hidden = !run.some(d => d.querySelector('.mk.on'));
    return h;
  }
  // storyHtml.js barHtml과 같은 규칙(하루 최대 대비 제곱근, 최대 48px)
  function barHtml(add, del) {
    const tot = add + del;
    if (!tot) return '';
    const w = Math.max(2, Math.round(Math.sqrt(tot / Math.max(statMax, 1)) * 48));
    const wa = Math.round(w * add / tot), wd = w - wa;
    return '<span class="bar" aria-hidden="true">' + (wa ? '<i class="ba" style="width:' + wa + 'px"></i>' : '')
      + (wd ? '<i class="bd" style="width:' + wd + 'px"></i>' : '') + '</span>';
  }
  function groupRuns(tl, openSet) {
    const runs = [];
    let run = [];
    for (const el of tl.children) {
      if (el.classList.contains('addzone')) continue; // 추가 존은 끼어 있어도 연속으로 본다
      if (el.matches('details.scene') && run.length && run[0].dataset.path === el.dataset.path) run.push(el);
      else { if (run.length > 1) runs.push(run); run = el.matches('details.scene') ? [el] : []; }
    }
    if (run.length > 1) runs.push(run);
    for (const r of runs) {
      const g = document.createElement('div');
      g.className = 'item sgroup' + (openSet.has(r[0].dataset.idx) ? ' open' : '');
      const body = document.createElement('div');
      body.className = 'sg-body';
      tl.insertBefore(g, r[0]);
      g.append(groupHead(r), body);
      const end = r[r.length - 1];
      let n = r[0];
      while (n) { const next = n.nextElementSibling; body.appendChild(n); if (n === end) break; n = next; }
    }
  }

  function renderNotes() {
    document.querySelectorAll('.note-item, .addzone').forEach(el => el.remove());
    for (const sec of partSecs) {
      const tl = sec.querySelector('.tl');
      const a = Number(sec.dataset.smin), b = Number(sec.dataset.emin);
      const openSet = new Set();
      unwrapGroups(tl, openSet);
      const statics = [...tl.children];
      const mine = notesData.filter(n => sectionFor(n.seq) === sec)
        .sort((x, y) => x.seq - y.seq).map(noteEl);
      // 접힌 빈 파트라도 필기가 배정되면 자동으로 펼친다 (필기가 안 보이는 사고 방지)
      if (mine.length && sec.classList.contains('ep')) {
        sec.classList.remove('ep');
        const t = sec.querySelector('.ep-toggle');
        if (t) t.remove();
      }
      const all = [...statics, ...mine].sort((x, y) => Number(x.dataset.seq) - Number(y.dataset.seq));
      tl.textContent = '';
      let prev = a;
      for (const el of all) {
        tl.appendChild(zoneEl(prev, Number(el.dataset.seq)));
        tl.appendChild(el);
        prev = Number(el.dataset.seq);
      }
      tl.appendChild(zoneEl(prev, b));
      groupRuns(tl, openSet);
    }
  }

  // 추가: 존 클릭 → 그 자리에서 바로 입력
  document.addEventListener('click', (e) => {
    const z = e.target.closest('.addzone');
    if (!z || document.querySelector('.note-edit')) return;
    const seq = midSeq(z);
    const wrap = document.createElement('div');
    wrap.className = 'item note-item';
    wrap.innerHTML = '<span class="node"></span>';
    const ta = document.createElement('textarea');
    ta.className = 'note-edit'; ta.rows = 1;
    ta.placeholder = T['web.notePlaceholder'];
    wrap.appendChild(ta);
    z.after(wrap);
    ta.focus();
    let done = false; // Enter→blur 이중 커밋 방지
    const commit = (cancel) => {
      if (done) return;
      done = true;
      const text = ta.value.trim();
      wrap.remove();
      if (cancel || !text) { renderNotes(); return; }
      notesData.push({ id: 'u' + Date.now(), time: '', text, seq });
      persist(); renderNotes();
    };
    ta.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); commit(false); }
      if (ev.key === 'Escape') commit(true);
    });
    ta.addEventListener('blur', () => commit(false));
    ta.addEventListener('input', () => fit(ta));
  });

  // 수정: 본문 클릭 → 인라인 편집
  document.addEventListener('click', (e) => {
    const tx = e.target.closest('.ntext');
    if (!tx || document.querySelector('.note-edit')) return;
    const item = tx.closest('.note-item');
    const n = notesData.find(x => x.id === item.dataset.id);
    if (!n) return;
    const ta = document.createElement('textarea');
    ta.className = 'note-edit'; ta.rows = 1; ta.value = n.text;
    tx.replaceWith(ta);
    fit(ta); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    let done = false; // Enter→blur 이중 커밋 방지
    const commit = (cancel) => {
      if (done) return;
      done = true;
      if (!cancel) {
        const text = ta.value.trim();
        if (!text) notesData.splice(notesData.indexOf(n), 1);
        else n.text = text;
        persist();
      }
      renderNotes();
    };
    ta.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); commit(false); }
      if (ev.key === 'Escape') commit(true);
    });
    ta.addEventListener('blur', () => commit(false));
    ta.addEventListener('input', () => fit(ta));
  });

  // 삭제
  document.addEventListener('click', (e) => {
    const del = e.target.closest('.ndel');
    if (!del) return;
    const id = del.closest('.note-item').dataset.id;
    const i = notesData.findIndex(x => x.id === id);
    if (i >= 0) { notesData.splice(i, 1); persist(); renderNotes(); }
  });

  // 드래그 재배치: 필기를 존 위에 놓으면 그 위치의 seq를 받는다
  let dragId = null;
  document.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.note-item');
    if (!item) return;
    dragId = item.dataset.id;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  document.addEventListener('dragend', () => {
    document.querySelectorAll('.dragging').forEach(x => x.classList.remove('dragging'));
    document.querySelectorAll('.addzone.drop').forEach(x => x.classList.remove('drop'));
    dragId = null;
  });
  document.addEventListener('dragover', (e) => {
    const z = e.target.closest('.addzone');
    if (!z || !dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    z.classList.add('drop');
  });
  document.addEventListener('dragleave', (e) => {
    const z = e.target.closest('.addzone');
    if (z) z.classList.remove('drop');
  });
  document.addEventListener('drop', (e) => {
    const z = e.target.closest('.addzone');
    if (!z || !dragId) return;
    e.preventDefault();
    const n = notesData.find(x => x.id === dragId);
    if (n) { n.seq = midSeq(z); persist(); renderNotes(); }
  });

  renderNotes();
`;
