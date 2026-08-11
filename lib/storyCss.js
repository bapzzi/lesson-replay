// storyCss.js — 복기 스토리 뷰 스타일 (storyHtml.js에서 분리)
// 디자인 문법 = VS Code 네이티브(GitLens류 웹뷰 지향): 테마 변수 상속, 2~3px 라운드,
//   버튼=button.* 변수, 필터 토글=inputOption.* 변수, 호버=list/toolbar 변수. 장식 이모지 없음.
// 시그니처 = 활동 밀도 미니맵 + 하루가 한 줄로 이어지는 세로 레일 (구조는 유지)
module.exports = `
  :root { --g:#3fb950; --y:#d29922; --r:#f85149; --p:#a371f7;
          --mk:#e3b341;
          --dim: var(--vscode-descriptionForeground);
          --line: var(--vscode-editorGroup-border);
          --bg: var(--vscode-editor-background);
          --card: var(--vscode-editorWidget-background);
          --hover: var(--vscode-list-hoverBackground);
          --mono: var(--vscode-editor-font-family);
          --mmH: 52px; }
  body { --accent: var(--vscode-textLink-foreground); }
  /* 라이트 테마: 흰 배경 대비가 서는 상태색 (GitHub light 팔레트) */
  body[data-vscode-theme-kind="vscode-light"], body.vscode-light,
  body[data-vscode-theme-kind="vscode-high-contrast-light"] {
    --g:#1a7f37; --y:#9a6700; --r:#cf222e; --p:#8250df; --mk:#9a6700; }
  * { box-sizing: border-box; }
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
         font-size: var(--vscode-font-size, 13px); line-height: 1.55;
         max-width: 1000px; margin: 0 auto; padding: 0 24px 100px; }

  /* ── 헤더·툴바 ── */
  .top { display:flex; align-items:center; gap:12px; padding-top:16px; }
  h1 { font-size: 19px; font-weight: 600; margin: 0; }
  h1 .dow { color: var(--dim); font-weight: 400; font-size: 13px; }
  .daystat { color: var(--dim); font-size: 12px; }
  .toolbar { display:flex; gap:6px; align-items:center; margin: 12px 0 8px; flex-wrap:wrap; }
  /* 보조 버튼 = 투명 + 툴바 호버(네이티브 아이콘 버튼 문법) */
  .toolbar button { font-family:inherit; font-size:12px; padding:3px 8px; border-radius:3px;
    border:1px solid transparent; background:transparent; color:var(--vscode-foreground); cursor:pointer; }
  .toolbar button:hover:not(:disabled) { background: var(--vscode-toolbar-hoverBackground, var(--hover)); }
  .toolbar button:disabled { opacity:.3; cursor:default; }
  .toolbar .sp { flex:1; }
  /* 범례: 상시 텍스트 대신 ⓘ 호버 팝 — 익숙해진 뒤의 글자 소음 제거 */
  .legend-i { position: relative; color: var(--dim); font-size: 11.5px; margin-left: 6px;
    cursor: help; user-select: none; }
  .legend-pop { position: absolute; top: calc(100% + 6px); left: 0; z-index: 40;
    white-space: nowrap; padding: 6px 12px; border-radius: 3px;
    background: var(--card); border: 1px solid var(--vscode-editorWidget-border, var(--line));
    box-shadow: 0 2px 8px var(--vscode-widget-shadow, rgba(0,0,0,.16));
    color: var(--vscode-foreground); opacity: 0; pointer-events: none; }
  .legend-i:hover .legend-pop, .legend-i:focus .legend-pop { opacity: 1; }
  .legend-pop .lr { color: var(--r); font-weight: 700; font-style: normal; }
  .ld { display:inline-block; width:9px; height:9px; border-radius:50%; font-style:normal;
    vertical-align: baseline; }
  .ld.g { background: var(--g); } .ld.y { background: var(--y); }
  .ld.p { background: var(--p); }
  .ld.n { background: var(--bg); border: 2px solid var(--mk); }
  /* 내보내기 = 이 화면의 유일한 주 동작 → 네이티브 primary 버튼 */
  .toolbar button#export { border: none; border-radius: 2px; padding: 4px 12px;
    background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  .toolbar button#export:hover { background: var(--vscode-button-hoverBackground); }

  /* ── 파일 필터 칩 = 네이티브 토글 옵션(검색창 .Aa 토글 문법) ── */
  .chips { display:flex; gap:4px; flex-wrap:wrap; margin: 10px 0 0; }
  .chip { font-family: var(--mono); font-size: 11.5px; padding: 2px 8px; border-radius: 3px;
    border: 1px solid transparent; background: transparent; color: var(--dim);
    cursor: pointer; }
  .chip:hover { background: var(--vscode-toolbar-hoverBackground, var(--hover));
    color: var(--vscode-foreground); }
  .chip.cur { background: var(--vscode-inputOption-activeBackground, color-mix(in srgb, var(--accent) 18%, transparent));
    color: var(--vscode-inputOption-activeForeground, var(--vscode-foreground));
    border-color: var(--vscode-inputOption-activeBorder, transparent); }
  .chip.mark-chip { color: var(--mk); }
  .chip.mark-chip.none { display: none; }
  .chip .cnt { color: var(--dim); font-size: 10px; margin-left: 4px; }
  .chip.hid { display: none; }
  .chip.more { border-color: var(--line); border-style: dashed; }
  section.chapter.fhide { display: none; }
  .mm-part.dim { opacity: .3; }
  .rwjump { border:none; background:none; color: var(--p); font-size: 12px; cursor:pointer;
    padding: 0 2px; font-weight: 600; }
  .rwjump:hover { text-decoration: underline; }
  button:focus-visible, textarea:focus-visible {
    outline: 1px solid var(--vscode-focusBorder); outline-offset: 1px; }

  /* ── 시그니처: 활동 밀도 미니맵 (상단 고정) ── */
  .minimap { position: sticky; top: 0; z-index: 20; height: var(--mmH);
    display:flex; align-items:center; gap:8px; background: var(--bg);
    border-bottom: 1px solid var(--line); padding: 8px 0; }
  .mm-time { color: var(--dim); font-size: 10.5px; font-variant-numeric: tabular-nums; flex:none; }
  .mm-bar { flex:1; display:flex; gap:2px; height: 24px; }
  .mm-part { position:relative; border:1px solid var(--line); border-radius:3px;
    background-color: var(--card); background-repeat:no-repeat; background-size:100% 100%;
    cursor:pointer; padding:0; min-width:24px; }
  .mm-part .mm-label { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
    font-size:10px; color:var(--vscode-foreground); font-weight:600; pointer-events:none;
    background: color-mix(in srgb, var(--bg) 72%, transparent); border-radius: 3px; padding: 0 4px; }
  .mm-part:hover { border-color: var(--accent); }
  .mm-part.cur { border-color: var(--accent); }
  .mm-part.cur::after { content:''; position:absolute; left:2px; right:2px; bottom:-6px;
    height:2px; background: var(--accent); }
  .mm-gap { min-width:3px; }

  /* ── 하루 = 끊기지 않는 레일 ── */
  .day { position: relative; padding-left: 34px; margin-top: 14px; }
  .day::before { content:''; position:absolute; left: 12px; top: 6px; bottom: 6px; width: 1px;
    background: var(--line); }
  .chapter { scroll-margin-top: calc(var(--mmH) + 10px); }
  .chapter.part { margin: 0 0 30px; padding-top: 4px;
    border-top: 1px solid color-mix(in srgb, var(--line) 70%, transparent); }
  .ch-h { position: sticky; top: var(--mmH); z-index: 10;
    display: flex; align-items: baseline; gap: 10px;
    background: var(--bg); padding: 8px 0 5px; margin-left:-34px; padding-left:34px; }
  .ph-node { position:absolute; left: 8px; top: 13px; width: 9px; height: 9px;
    border-radius: 50%; background: var(--accent); border: 2px solid var(--bg); }
  .ch-label { font-size: 18px; font-weight: 700; color: var(--vscode-foreground);
    text-transform: uppercase; letter-spacing: .04em; }
  .ch-range { color: var(--dim); font-size: 12.5px; font-variant-numeric: tabular-nums; }
  .gap-h { color: var(--dim); font-size: 11px; font-style: italic; padding: 2px 0; opacity:.75; }

  /* 빈 파트 = 한 줄 접기 */
  .ep-toggle { border:none; background:none; color: var(--dim); font-size: 11.5px; cursor:pointer;
    padding: 1px 6px; border-radius: 3px; }
  .ep-toggle:hover { color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, var(--hover)); }
  section.ep .ep-body { display:none; }
  section.chapter.part.ep { margin-bottom: 16px; }
  section.ep .ch-h { padding-bottom: 2px; }
  section.ep .ch-label { opacity: .6; }

  /* ── 배운 것 ── */
  .learn { position:relative; margin: 2px 0 8px; }
  .learn textarea { width:100%; resize:none; overflow:hidden; font-family:inherit; font-size: 13px;
    line-height:1.5; padding: 6px 26px 6px 10px;
    color: var(--vscode-input-foreground); background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, var(--line)); border-radius: 2px; }
  .learn textarea::placeholder { color: var(--dim); opacity:.7; }
  .learn textarea:focus { border-color: var(--vscode-focusBorder); outline: none; }
  .saved { position:absolute; right:9px; top:6px; color: var(--g); font-size: 12px; opacity: 0; }
  .saved.on { opacity: 1; }

  /* ── 타임라인 아이템 ── */
  .item { position: relative; display:flex; align-items:baseline; gap:8px; padding: 3px 0; }
  .node { position:absolute; left: -26px; top: 7px; width: 10px; height: 10px;
    border-radius: 50%; border: 2px solid var(--bg); }
  .node.g { background: var(--g); } .node.y { background: var(--y); }
  .node.p { background: var(--p); }
  /* 삭제=✕ 글자 — 색뿐 아니라 형태로도 구분(적록색약 대응) */
  .node.r { background: none; border: none; color: var(--r); font-weight: 700;
    font-size: 11px; line-height: 10px; text-align: center; }
  .node.rw { box-shadow: 0 0 0 2px var(--bg), 0 0 0 3px var(--p); }
  .time { color: var(--dim); font-size: 11.5px; font-variant-numeric: tabular-nums; }

  /* 씬 = 접힌 행: 행 클릭=이력 펼침, 파일명 클릭=원본 열기. 호버=네이티브 리스트 행 */
  details.scene { display:block; padding:0; }
  details.scene summary { list-style:none; position:relative; display:flex; align-items:baseline;
    gap:10px; padding: 11px 8px; margin: 1px 0; border-radius: 3px; cursor:pointer; user-select:none; }
  details.scene summary::-webkit-details-marker { display:none; }
  details.scene summary:hover { background: var(--hover); }
  details.scene summary .node { left: -26px; top: 14px; }
  /* 파일 타입 아이콘 — 인라인 SVG (색은 SVG 안에, 기타 파일만 테마 dim) */
  .fx { flex:none; width: 15px; height: 15px; align-self: center; }
  .fx-etc { color: var(--dim); }
  .file { font-family: var(--mono); font-size: 13px; font-weight: 600;
    padding: 1px 5px; margin: -1px 0 -1px -5px; border-radius: 3px;
    border:none; background:none; color: var(--vscode-foreground); cursor:pointer; }
  .file:hover { color: var(--vscode-textLink-foreground); text-decoration: underline;
    text-underline-offset: 3px; }
  /* 씬 행 스탯·시그니처·배지 — 클릭 전에도 정보가 보이게. 시각은 우측 끝 고정 컬럼(시간 축) */
  .stat { font-family: var(--mono); font-size: 11.5px; flex:none; }
  .stat .sa { color: var(--g); font-style: normal; margin-right: 4px; }
  .stat .sd { color: var(--r); font-style: normal; }
  .sig { font-family: var(--mono); font-size: 11.5px; color: var(--dim);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1 1 auto; min-width: 0;
    text-align: left; }
  /* 배지 = 네이티브 badge 변수(없으면 보라 폴백) */
  .rwb { flex:none; font-size: 10px; font-weight: 600; border-radius: 2px; padding: 1px 5px;
    color: var(--vscode-badge-foreground, var(--p));
    background: var(--vscode-badge-background, color-mix(in srgb, var(--p) 20%, transparent)); }
  details.scene summary button.time { margin-left:auto; flex:none; border:none; background:none;
    cursor:pointer; color: var(--dim); font-size: 11.5px; font-variant-numeric: tabular-nums;
    padding: 0 2px; font-family: inherit; }
  details.scene summary button.time:hover { color: var(--vscode-textLink-foreground);
    text-decoration: underline; text-underline-offset: 3px; }
  .scene-actions { margin: 0 0 2px 8px; display:flex; gap:10px; align-items:center; }
  .rwnote { font-size: 11px; color: var(--p); }
  .opencur { border:none; background:none; color: var(--dim); font-size: 11px; cursor:pointer;
    padding: 1px 4px; }
  .opencur:hover { color: var(--vscode-textLink-foreground); text-decoration: underline; }
  /* 다시 볼 것 ★ — 마크된 것만 상시, 나머지는 호버 시 */
  .mk { border:none; background:none; cursor:pointer; font-size: 13px; padding: 0 2px;
    color: var(--dim); opacity: 0; flex:none; }
  details.scene summary:hover .mk { opacity: .75; }
  .mk.on, .mk:hover { opacity: 1; color: var(--mk); }
  /* 씬 정리 ⤓ ✕ — 평소엔 숨고 호버 시에만. 실수로 누르기 어렵게 ★보다 약하게 둔다 */
  .op { border:none; background:none; cursor:pointer; font-size: 12px; padding: 0 2px;
    color: var(--dim); opacity: 0; flex:none; }
  details.scene summary:hover .op { opacity: .55; }
  .op:hover { opacity: 1; color: var(--vscode-textLink-foreground); }
  .op.off.on { opacity: 1; color: var(--vscode-textLink-foreground); }
  .chip.unhide { color: var(--dim); font-style: italic; }

  .chev { flex:none; margin-left: 4px; color: var(--dim); font-size: 11px; opacity: .45;
    transform-origin: 40% 50%; }
  details.scene summary:hover .chev { opacity:.95; }
  details.scene[open] .chev { opacity:.95; transform: rotate(90deg); }
  pre.diff { margin: 2px 0 6px 8px; padding: 8px 12px; overflow: auto;
    max-height: 380px; min-height: 48px; resize: vertical; /* 우하단 핸들로 세로 확장 — 로드 후 JS가 max-height 해제 */
    background: var(--vscode-textCodeBlock-background, var(--card)); border-radius: 3px;
    font-family: var(--mono); font-size: 12px; line-height: 1.5; white-space: pre; }
  .dl { color: var(--r); } .da { color: var(--g); } .dh { color: var(--dim); }

  .nz summary { list-style:none; cursor:pointer; color: var(--dim); font-size: 12px; user-select:none; }
  .nz summary::-webkit-details-marker { display:none; }
  .nz .node { position:absolute; }
  .nzn { background: var(--dim); left:-25px; top:5px; width:8px; height:8px;
    border-radius:50%; border:2px solid var(--bg); position:absolute; }
  .nlist { max-height: 200px; overflow-y: auto; padding: 4px 0 4px 2px; }
  .nfile { font-size: 11.5px; font-family: var(--mono); padding: 1px 0; color: var(--dim); }
  .st { display: inline-block; width: 16px; font-weight: 700; }
  .st-D { color: var(--r); } .st-A { color: var(--g); } .st-M { color: var(--y); }

  /* ── 필기 카드 = 메모지 문법: 노란 틴트 + 좌측 바 + 연필 — 코드 행과 한눈에 구분 ── */
  .note-item { border: 1px solid color-mix(in srgb, var(--mk) 38%, transparent);
    border-left: 3px solid var(--mk); border-radius: 3px;
    background: color-mix(in srgb, var(--mk) 9%, var(--bg));
    padding: 6px 8px 6px 6px; margin: 5px 0; display:flex; align-items:flex-start; gap:6px; }
  .note-item .node { background: var(--bg); border: 2px solid var(--mk); width:8px; height:8px;
    left:-24px; top:10px; }
  .npen { flex:none; width: 13px; height: 13px; color: var(--mk); margin-top: 3px; }
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
    border:1px solid var(--vscode-focusBorder); border-radius:2px; }

  /* ── 필기 추가 존 (호버·드롭 대상) ── */
  .addzone { position:relative; height: 8px; cursor: pointer; }
  .addzone::before { content:'＋ 필기'; position:absolute; left:0; right:0; top:50%;
    transform:translateY(-50%); font-size:10.5px; color: var(--vscode-textLink-foreground);
    text-align:left; padding-left: 2px;
    border-top: 1px dashed color-mix(in srgb, var(--vscode-textLink-foreground) 55%, transparent);
    line-height: 0; opacity: 0; }
  .addzone:hover { height: 18px; }
  .addzone:hover::before { opacity: 1; line-height: 2.4; }
  .addzone.drop { height: 18px; }
  .addzone.drop::before { content:''; opacity:1;
    border-top: 2px solid var(--vscode-focusBorder); }

  /* 복기 종료 카드 — 세션의 명시적 끝 + 다음 행동(TIL) 연결 */
  .end-card { text-align:center; margin: 44px 0 20px; color: var(--dim); }
  .end-card .ec-line { width: 1px; height: 26px; margin: 0 auto 12px;
    background: linear-gradient(var(--line), transparent); }
  .end-card p { margin: 0 0 10px; font-size: 12.5px; }
  .end-card button { font-family:inherit; font-size: 13px; cursor:pointer;
    padding: 5px 14px; border-radius: 2px; border: none;
    color: var(--vscode-button-foreground); background: var(--vscode-button-background); }
  .end-card button:hover { background: var(--vscode-button-hoverBackground); }

  .empty-day { text-align:center; margin-top: 60px; color: var(--dim); }
  .empty-day b { color: var(--vscode-foreground); }

  @media (prefers-reduced-motion: no-preference) {
    .saved, .ndel, .addzone::before { transition: opacity .18s; }
    .mm-part, .toolbar button, .chip, .file { transition: border-color .12s, color .12s, background-color .12s; }
  }
  @media (max-width: 560px) {
    .sig { display: none; } /* 좁은 폭: 시그니처는 접고 스탯·시각만 */
    .chips { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 4px; }
    .day { padding-left: 24px; }
    .day::before { left: 7px; }
    .ph-node { left: 3px; }
    .ch-h { margin-left:-24px; padding-left:24px; }
    .node, .nzn { left: -21px; }
    .note-item .node { left: -20px; }
  }
`;
