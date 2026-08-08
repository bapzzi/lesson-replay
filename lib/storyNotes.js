// storyNotes.js — 복기 뷰 웹뷰 스크립트 中 필기 편집 파트 (storyScript.js가 이어붙임)
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
  function noteEl(n) {
    const el = document.createElement('div');
    el.className = 'item note-item';
    el.dataset.seq = n.seq; el.dataset.id = n.id;
    el.draggable = true;
    el.innerHTML = '<span class="node"></span><span class="handle" title="드래그해서 순서 이동">⠿</span>'
      + (n.time ? '<span class="ntime">' + n.time + '</span>' : '')
      + '<span class="ntext"></span>'
      + '<button class="ndel" title="삭제">✕</button>';
    el.querySelector('.ntext').textContent = n.text;
    return el;
  }
  function zoneEl(prevSeq, nextSeq) {
    const z = document.createElement('div');
    z.className = 'addzone';
    z.dataset.prev = prevSeq; z.dataset.next = nextSeq;
    z.title = '필기 추가';
    return z;
  }
  function midSeq(z) {
    const a = Number(z.dataset.prev);
    let b = Number(z.dataset.next);
    if (b <= a) b = a + 1;
    return a + (b - a) / 2;
  }
  function renderNotes() {
    document.querySelectorAll('.note-item, .addzone').forEach(el => el.remove());
    for (const sec of partSecs) {
      const tl = sec.querySelector('.tl');
      const a = Number(sec.dataset.smin), b = Number(sec.dataset.emin);
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
    ta.placeholder = '필기 — Enter 저장 · Shift+Enter 줄바꿈 · Esc 취소';
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
