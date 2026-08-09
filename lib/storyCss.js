// storyCss.js — 복기 스토리 뷰 스타일 (storyHtml.js에서 분리)
// VS Code 테마 변수 상속(라이트/다크 자동) + 액센트 프리셋(기본/웜/모노)
// 시그니처 = 활동 밀도 미니맵 + 하루가 한 줄로 이어지는 세로 레일
module.exports = `
  :root { --g:#3fb950; --y:#d29922; --r:#f85149; --p:#a371f7;
          --mk:#e3b341;
          --dim: var(--vscode-descriptionForeground);
          --line: var(--vscode-editorGroup-border);
          --bg: var(--vscode-editor-background);
          --card: var(--vscode-editorWidget-background);
          --mono: var(--vscode-editor-font-family);
          --mmH: 52px; }
  body { --accent: var(--vscode-textLink-foreground); }
  /* 라이트 테마: 흰 배경 대비가 서는 상태색 (GitHub light 팔레트) */
  body[data-vscode-theme-kind="vscode-light"], body.vscode-light,
  body[data-vscode-theme-kind="vscode-high-contrast-light"] {
    --g:#1a7f37; --y:#9a6700; --r:#cf222e; --p:#8250df; --mk:#9a6700; }
  body.acc-warm { --accent: #e8a13c; }
  body.acc-mono { --accent: var(--vscode-foreground); }
  * { box-sizing: border-box; }
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
         font-size: 13px; line-height: 1.55; max-width: 1100px; margin: 0 auto; padding: 0 24px 100px; }

  /* ── 헤더·툴바 ── */
  .top { display:flex; align-items:center; gap:12px; padding-top:14px; }
  h1 { font-size: 21px; font-weight: 800; margin: 0; letter-spacing: -.01em; }
  h1 .dow { color: var(--accent); font-weight: 700; font-size: 14px; }
  .daystat { color: var(--dim); font-size: 12px; }
  .accents { margin-left:auto; display:flex; gap:6px; }
  .acc { width:16px; height:16px; border-radius:50%; cursor:pointer; padding:0;
    border:1px solid var(--line); }
  .acc[data-acc=""] { background: var(--vscode-textLink-foreground); }
  .acc[data-acc="warm"] { background: #e8a13c; }
  .acc[data-acc="mono"] { background: var(--vscode-foreground); }
  .acc.cur { box-shadow: 0 0 0 2px var(--bg), 0 0 0 3.5px var(--accent); }
  .toolbar { display:flex; gap:8px; align-items:center; margin: 10px 0 8px; flex-wrap:wrap; }
  .toolbar button { font-family:inherit; font-size:12px; padding:5px 12px; border-radius:20px;
    border:1px solid var(--line); background:transparent; color:var(--vscode-foreground); cursor:pointer; }
  .toolbar button:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
  .toolbar button:disabled { opacity:.3; cursor:default; }
  .toolbar .sp { flex:1; }
  /* 범례: 상시 텍스트 대신 ⓘ 호버 팝 — 익숙해진 뒤의 글자 소음 제거 */
  .legend-i { position: relative; color: var(--dim); font-size: 11.5px; margin-left: 6px;
    cursor: help; user-select: none; }
  .legend-pop { position: absolute; top: calc(100% + 6px); left: 0; z-index: 40;
    white-space: nowrap; padding: 6px 12px; border-radius: 8px;
    background: var(--card); border: 1px solid var(--line); color: var(--vscode-foreground);
    opacity: 0; pointer-events: none; }
  .legend-i:hover .legend-pop, .legend-i:focus .legend-pop { opacity: 1; }
  .legend-pop .lr { color: var(--r); font-weight: 800; font-style: normal; }
  #export { border-color: var(--accent); color: var(--accent); font-weight: 700; }

  /* ── 파일 필터 칩 ── */
  .chips { display:flex; gap:6px; flex-wrap:wrap; margin: 10px 0 0; }
  .chip { font-family: var(--mono); font-size: 11.5px; padding: 3px 10px; border-radius: 14px;
    border: 1px solid var(--line); background: var(--card); color: var(--vscode-foreground);
    cursor: pointer; }
  .chip:hover { border-color: var(--accent); }
  .chip.cur { border-color: var(--accent); color: var(--accent); font-weight: 700;
    background: color-mix(in srgb, var(--accent) 10%, transparent); }
  .chip.mark-chip { color: var(--mk); border-color: color-mix(in srgb, var(--mk) 55%, transparent); }
  .chip.mark-chip.none { display: none; }
  .chip .cnt { color: var(--dim); font-size: 10px; margin-left: 4px; }
  .chip.hid { display: none; }
  .chip.more { color: var(--dim); border-style: dashed; }
  section.chapter.fhide { display: none; }
  .mm-part.dim { opacity: .3; }
  .rwjump { border:none; background:none; color: var(--p); font-size: 12px; cursor:pointer;
    padding: 0 2px; font-weight: 700; }
  .rwjump:hover { text-decoration: underline; }
  button:focus-visible, textarea:focus-visible {
    outline: 2px solid var(--vscode-focusBorder); outline-offset: 1px; }

  /* ── 시그니처: 활동 밀도 미니맵 (상단 고정) ── */
  .minimap { position: sticky; top: 0; z-index: 20; height: var(--mmH);
    display:flex; align-items:center; gap:8px; background: var(--bg);
    border-bottom: 1px solid var(--line); padding: 8px 0; }
  .mm-time { color: var(--dim); font-size: 10.5px; font-variant-numeric: tabular-nums; flex:none; }
  .mm-bar { flex:1; display:flex; gap:3px; height: 26px; }
  .mm-part { position:relative; border:1px solid var(--line); border-radius:6px;
    background-color: var(--card); background-repeat:no-repeat; background-size:100% 100%;
    cursor:pointer; padding:0; min-width:24px; }
  .mm-part .mm-label { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
    font-size:10px; color:var(--vscode-foreground); font-weight:700; pointer-events:none;
    background: color-mix(in srgb, var(--bg) 72%, transparent); border-radius: 6px; padding: 0 4px; }
  .mm-part:hover { border-color: var(--accent); }
  .mm-part.cur { border-color: var(--accent); }
  .mm-part.cur::after { content:''; position:absolute; left:3px; right:3px; bottom:-6px;
    height:3px; border-radius:2px; background: var(--accent); }
  .mm-gap { min-width:3px; }

  /* ── 하루 = 끊기지 않는 레일 ── */
  .day { position: relative; padding-left: 34px; margin-top: 14px; }
  .day::before { content:''; position:absolute; left: 12px; top: 6px; bottom: 6px; width: 2px;
    border-radius: 1px; background: color-mix(in srgb, var(--accent) 32%, transparent); }
  .chapter { scroll-margin-top: calc(var(--mmH) + 10px); }
  .chapter.part { margin: 0 0 26px; }
  .ch-h { position: sticky; top: var(--mmH); z-index: 10;
    display: flex; align-items: baseline; gap: 10px;
    background: var(--bg); padding: 8px 0 5px; margin-left:-34px; padding-left:34px; }
  .ph-node { position:absolute; left: 7px; top: 12px; width: 12px; height: 12px;
    border-radius: 50%; background: var(--accent); border: 2.5px solid var(--bg); }
  .ch-label { font-size: 16px; font-weight: 800; color: var(--accent); letter-spacing: .01em; }
  .ch-range { color: var(--dim); font-size: 12px; font-variant-numeric: tabular-nums; }
  .gap-h { color: var(--dim); font-size: 11px; font-style: italic; padding: 2px 0; opacity:.75; }

  /* 빈 파트 = 한 줄 접기 */
  .ep-toggle { border:none; background:none; color: var(--dim); font-size: 11.5px; cursor:pointer;
    padding: 1px 6px; border-radius: 6px; }
  .ep-toggle:hover { color: var(--accent); }
  section.ep .ep-body { display:none; }
  section.chapter.part.ep { margin-bottom: 16px; }
  section.ep .ch-h { padding-bottom: 2px; }
  section.ep .ch-label { font-size: 13px; opacity: .7; }

  /* ── 배운 것 ── */
  .learn { position:relative; margin: 2px 0 8px; }
  .learn textarea { width:100%; resize:none; overflow:hidden; font-family:inherit; font-size: 13px;
    line-height:1.5; padding: 7px 26px 7px 12px;
    color: var(--vscode-input-foreground); background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, var(--line)); border-radius: 8px; }
  .learn textarea::placeholder { color: var(--dim); opacity:.7; }
  .learn textarea:focus { border-color: var(--accent); }
  .saved { position:absolute; right:9px; top:7px; color: var(--g); font-size: 12px; opacity: 0; }
  .saved.on { opacity: 1; }

  /* ── 타임라인 아이템 ── */
  .item { position: relative; display:flex; align-items:baseline; gap:8px; padding: 3px 0; }
  .node { position:absolute; left: -27px; top: 7px; width: 12px; height: 12px;
    border-radius: 50%; border: 2px solid var(--bg); }
  .node.g { background: var(--g); } .node.y { background: var(--y); }
  .node.p { background: var(--p); }
  /* 삭제=✕ 글자 — 색뿐 아니라 형태로도 구분(적록색약 대응) */
  .node.r { background: none; border: none; color: var(--r); font-weight: 800;
    font-size: 12px; line-height: 12px; text-align: center; }
  .node.rw { box-shadow: 0 0 0 2px var(--bg), 0 0 0 3.5px var(--p); }
  .time { color: var(--dim); font-size: 11.5px; font-variant-numeric: tabular-nums; }

  /* 씬 = 접힌 카드: 행 클릭=이력 펼침, 파일명 클릭=원본 열기 */
  details.scene { display:block; padding:0; }
  details.scene summary { list-style:none; position:relative; display:flex; align-items:baseline;
    gap:10px; padding: 6px 8px; margin: 1px 0; border-radius: 8px; cursor:pointer; user-select:none; }
  details.scene summary::-webkit-details-marker { display:none; }
  details.scene summary:hover { background: color-mix(in srgb, var(--accent) 9%, transparent); }
  details.scene summary .node { left: -27px; }
  .file { font-family: var(--mono); font-size: 13.5px; font-weight: 700;
    padding: 2px 6px; margin: -2px 0 -2px -6px; border-radius: 6px;
    border:none; background:none; color: var(--vscode-foreground); cursor:pointer; }
  .file:hover { color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, transparent); }
  /* 씬 행 스탯·시그니처·배지 — 클릭 전에도 정보가 보이게. 시각은 우측 끝 고정 컬럼(시간 축) */
  .stat { font-family: var(--mono); font-size: 11.5px; flex:none; }
  .stat .sa { color: var(--g); font-style: normal; margin-right: 4px; }
  .stat .sd { color: var(--r); font-style: normal; }
  .sig { font-family: var(--mono); font-size: 11.5px; color: var(--dim);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1 1 auto; min-width: 0;
    text-align: left; }
  .rwb { flex:none; font-size: 10.5px; font-weight: 700; color: var(--p);
    border: 1px solid color-mix(in srgb, var(--p) 55%, transparent); border-radius: 10px;
    padding: 0 7px; background: color-mix(in srgb, var(--p) 12%, transparent); }
  details.scene summary button.time { margin-left:auto; flex:none; border:none; background:none;
    cursor:pointer; color: var(--dim); font-size: 11.5px; font-variant-numeric: tabular-nums;
    padding: 0 2px; font-family: inherit; }
  details.scene summary button.time:hover { color: var(--accent); text-decoration: underline;
    text-underline-offset: 3px; }
  .scene-actions { margin: 0 0 2px 8px; display:flex; gap:10px; align-items:center; }
  .rwnote { font-size: 11px; color: var(--p); }
  .opencur { border:none; background:none; color: var(--dim); font-size: 11px; cursor:pointer;
    padding: 1px 4px; }
  .opencur:hover { color: var(--accent); text-decoration: underline; }
  /* 다시 볼 것 ★ — 마크된 것만 상시, 나머지는 호버 시 */
  .mk { border:none; background:none; cursor:pointer; font-size: 13px; padding: 0 2px;
    color: var(--dim); opacity: 0; flex:none; }
  details.scene summary:hover .mk { opacity: .75; }
  .mk.on, .mk:hover { opacity: 1; color: var(--mk); }

  .chev { flex:none; margin-left: 4px; color: var(--dim); font-size: 11px; opacity: .45;
    transform-origin: 40% 50%; }
  details.scene summary:hover .chev { opacity:.95; }
  details.scene[open] .chev { opacity:.95; transform: rotate(90deg); }
  pre.diff { margin: 2px 0 6px 8px; padding: 8px 12px; overflow: auto;
    max-height: 380px; min-height: 48px; resize: vertical; /* 우하단 핸들로 세로 확장 — 로드 후 JS가 max-height 해제 */
    border-left: 2px solid var(--line);
    font-family: var(--mono); font-size: 12px; line-height: 1.5; white-space: pre; }
  .dl { color: var(--r); } .da { color: var(--g); } .dh { color: var(--dim); }

  .nz summary { list-style:none; cursor:pointer; color: var(--dim); font-size: 12px; user-select:none; }
  .nz summary::-webkit-details-marker { display:none; }
  .nz .node { position:absolute; }
  .nzn { background: var(--dim); left:-26px; top:5px; width:10px; height:10px;
    border-radius:50%; border:2px solid var(--bg); position:absolute; }
  .nlist { max-height: 200px; overflow-y: auto; padding: 4px 0 4px 2px; }
  .nfile { font-size: 11.5px; font-family: var(--mono); padding: 1px 0; color: var(--dim); }
  .st { display: inline-block; width: 16px; font-weight: 700; }
  .st-D { color: var(--r); } .st-A { color: var(--g); } .st-M { color: var(--y); }

  /* ── 필기 카드 ── */
  .note-item { border: 1px solid var(--line); border-radius: 8px; background: var(--card);
    padding: 5px 8px 5px 4px; margin: 4px 0; display:flex; align-items:flex-start; gap:6px; }
  .note-item .node { background: var(--bg); border: 2px solid var(--dim); width:8px; height:8px;
    left:-25px; top:8px; }
  .handle { color: var(--dim); cursor: grab; user-select:none; font-size: 12px; line-height:1.5;
    padding: 0 2px; letter-spacing:-1px; opacity:.6; flex:none; }
  .note-item:hover .handle { opacity: 1; }
  .note-item.dragging { opacity:.4; }
  .ntext { flex:1; font-size: 12.5px; white-space: pre-wrap; word-break: break-word; cursor: text; }
  .ntime { color: var(--dim); font-size: 10.5px; font-variant-numeric: tabular-nums; flex:none;
    padding-top: 2px; margin-right: 2px; }
  .ndel { border:none; background:none; color: var(--dim); cursor:pointer; font-size: 13px;
    padding: 0 3px; opacity: 0; flex:none; }
  .note-item:hover .ndel { opacity: .8; }
  .ndel:hover { color: var(--r); }
  .note-edit { flex:1; resize:none; overflow:hidden; font-family:inherit; font-size:12.5px;
    line-height:1.5; padding:2px 6px; color: var(--vscode-input-foreground);
    background: var(--vscode-input-background);
    border:1px solid var(--accent); border-radius:6px; }

  /* ── 필기 추가 존 (호버·드롭 대상) ── */
  .addzone { position:relative; height: 8px; cursor: pointer; }
  .addzone::before { content:'＋ 필기'; position:absolute; left:0; right:0; top:50%;
    transform:translateY(-50%); font-size:10.5px; color: var(--accent); text-align:left;
    padding-left: 2px; border-top: 1px dashed color-mix(in srgb, var(--accent) 55%, transparent);
    line-height: 0; opacity: 0; }
  .addzone:hover { height: 18px; }
  .addzone:hover::before { opacity: 1; line-height: 2.4; }
  .addzone.drop { height: 18px; }
  .addzone.drop::before { content:''; opacity:1; border-top: 2px solid var(--accent); }

  /* 복기 종료 카드 — 세션의 명시적 끝 + 다음 행동(TIL) 연결 */
  .end-card { text-align:center; margin: 44px 0 20px; color: var(--dim); }
  .end-card .ec-line { width: 2px; height: 26px; margin: 0 auto 12px;
    background: linear-gradient(color-mix(in srgb, var(--accent) 32%, transparent), transparent); }
  .end-card p { margin: 0 0 10px; font-size: 12.5px; }
  .end-card button { font-family:inherit; font-size: 13px; font-weight: 700; cursor:pointer;
    padding: 8px 20px; border-radius: 20px; color: var(--accent);
    border: 1px solid var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); }
  .end-card button:hover { background: color-mix(in srgb, var(--accent) 16%, transparent); }

  .empty-day { text-align:center; margin-top: 60px; color: var(--dim); }
  .empty-day .ed-icon { font-size: 40px; margin-bottom: 8px; }
  .empty-day b { color: var(--vscode-foreground); }

  @media (prefers-reduced-motion: no-preference) {
    .saved, .ndel, .addzone::before { transition: opacity .18s; }
    .mm-part, .toolbar button, .file { transition: border-color .12s, color .12s; }
  }
  @media (max-width: 560px) {
    .sig { display: none; } /* 좁은 폭: 시그니처는 접고 스탯·시각만 */
    .chips { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 4px; }
    .day { padding-left: 24px; }
    .day::before { left: 7px; }
    .ph-node { left: 2px; }
    .ch-h { margin-left:-24px; padding-left:24px; }
    .node, .nzn { left: -21px; }
    .note-item .node { left: -20px; }
  }
`;
