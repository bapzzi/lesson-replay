// storyCss.js: 복기 스토리 뷰 스타일 (storyHtml.js에서 분리)
// v1.5.0 IDE 마감. 레퍼런스 = GitHub Primer Timeline · IntelliJ Local History (storyHtml.js 머리말)
//   색은 전부 VS Code 테마 변수: 상태 = gitDecoration.*(탐색기의 A·M·D 색), diff = diffEditor.*, 선택 = list.*
//   수치(오너 확정 "하이브리드"): 글자 크기는 VS Code 테마를 따르고 3단(작게·기본·크게), 간격 4의 배수,
//   클릭 영역 24px 이상(_design-system/spec-numeric.md §1·§2·§7)
//   레일 기하: .day 왼쪽 여백 --indent, 세로선 중심 x = --rail. 배지(24px)·작은 노드(16px) 모두 이 중심에 맞춘다
module.exports = `
  :root {
    --g: var(--vscode-gitDecoration-addedResourceForeground, #81b88b);
    --y: var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d);
    --r: var(--vscode-gitDecoration-deletedResourceForeground, #c74e39);
    --p: var(--vscode-charts-orange, #d18616); --mk: #e3b341;
    --dim: var(--vscode-descriptionForeground);
    --line: var(--vscode-editorGroup-border);
    --rule: color-mix(in srgb, var(--vscode-foreground) 16%, transparent);
    --bg: var(--vscode-editor-background);
    --card: var(--vscode-editorWidget-background);
    --hover: var(--vscode-list-hoverBackground);
    --sel: var(--vscode-list-inactiveSelectionBackground, var(--hover));
    --focus: var(--vscode-list-focusOutline, var(--vscode-focusBorder));
    --mono: var(--vscode-editor-font-family);
    --fs: var(--vscode-font-size, 13px);
    --fs-s: calc(var(--fs) - 2px);
    --fs-l: calc(var(--fs) + 5px);
    --hit: 24px; --row: 28px; --tcol: 80px;
    --indent: 40px; --rail: 16px;
    --mmH: 52px;
  }
  body { --accent: var(--vscode-textLink-foreground); }
  body[data-vscode-theme-kind="vscode-light"], body.vscode-light,
  body[data-vscode-theme-kind="vscode-high-contrast-light"] { --mk:#9a6700; }
  * { box-sizing: border-box; }
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground);
         font-size: var(--fs); line-height: 1.5;
         max-width: 1440px; margin: 0 auto; padding: 0 24px 96px; }
  button { font-family: inherit; }
  .ci { flex:none; width: 16px; height: 16px; display:block; }
  button:focus-visible, textarea:focus-visible, summary:focus-visible, .note-item:focus-visible,
  .sg-head:focus-visible { outline: 1px solid var(--focus); outline-offset: -1px; }

  /* 헤더·툴바 */
  .top { display:flex; align-items:baseline; gap:12px; padding-top:16px; }
  h1 { font-size: var(--fs-l); font-weight: 600; margin: 0; }
  h1 .dow { color: var(--dim); font-weight: 400; font-size: var(--fs); }
  .daystat { color: var(--dim); font-size: var(--fs-s); }
  .toolbar { display:flex; gap:4px; align-items:center; margin: 8px 0; flex-wrap:wrap; }
  .toolbar button { font-size: var(--fs); min-height: var(--hit); padding: 0 8px; border-radius:3px;
    border:1px solid transparent; background:transparent; color:var(--vscode-foreground); cursor:pointer; }
  .toolbar button:hover:not(:disabled) { background: var(--vscode-toolbar-hoverBackground, var(--hover)); }
  .toolbar button:disabled { opacity:.6; cursor:not-allowed; }
  .toolbar .sp { flex:1; }
  .legend-i { position: relative; display:inline-flex; align-items:center; min-height: var(--hit);
    color: var(--dim); font-size: var(--fs-s); padding: 0 8px; border-radius: 3px; cursor: help; user-select: none; }
  .legend-i:hover { background: var(--vscode-toolbar-hoverBackground, var(--hover)); }
  .legend-pop { display:none; position: absolute; top: 100%; left: 0; z-index: 40;
    white-space: nowrap; padding: 8px 12px; border-radius: 4px; gap: 12px;
    background: var(--vscode-editorHoverWidget-background, var(--card));
    border: 1px solid var(--vscode-editorHoverWidget-border, var(--line));
    box-shadow: 0 2px 8px var(--vscode-widget-shadow, rgba(0,0,0,.16)); color: var(--vscode-foreground); }
  .legend-i:hover .legend-pop, .legend-i:focus .legend-pop { display:flex; }
  .legend-pop .lg { display:inline-flex; align-items:center; gap:4px; }
  .legend-pop .node { position: static; transform: none; }
  .lg-star { color: var(--mk); }
  .toolbar button#export { border: none; border-radius: 2px; padding: 0 12px;
    background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  .toolbar button#export:hover { background: var(--vscode-button-hoverBackground); }

  /* 파일 필터 칩 = 네이티브 토글 옵션 */
  .chips { display:flex; gap:4px; flex-wrap:wrap; margin: 8px 0 0; }
  .chip { display:inline-flex; align-items:center; gap:4px; font-size: var(--fs-s); min-height: var(--hit);
    padding: 0 8px; border-radius: 3px; border: 1px solid transparent; background: transparent;
    color: var(--dim); cursor: pointer; }
  .chip .ci { width: 12px; height: 12px; }
  .chip:hover { background: var(--vscode-toolbar-hoverBackground, var(--hover)); color: var(--vscode-foreground); }
  .chip.cur { background: var(--vscode-inputOption-activeBackground, color-mix(in srgb, var(--accent) 18%, transparent));
    color: var(--vscode-inputOption-activeForeground, var(--vscode-foreground));
    border-color: var(--vscode-inputOption-activeBorder, transparent); }
  .chip.mark-chip { color: var(--mk); }
  .chip.mark-chip.none, .chip.hid { display: none; }
  .chip .cnt { min-width: 16px; padding: 0 4px; border-radius: 8px; text-align:center; font-size: var(--fs-s);
    background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
  .chip.more { border-color: var(--line); border-style: dashed; }
  .chip.unhide { font-style: italic; }
  section.chapter.fhide { display: none; }
  .mm-part.dim { opacity: .3; }
  .rwjump { border:none; background:none; color: var(--p); font-size: var(--fs-s); cursor:pointer; padding: 4px; }
  .rwjump:hover { text-decoration: underline; }

  /* 활동 밀도 미니맵 (상단 고정) */
  .minimap { position: sticky; top: 0; z-index: 20; height: var(--mmH);
    display:flex; align-items:center; gap:8px; background: var(--bg);
    border-bottom: 1px solid var(--line); padding: 8px 0; }
  .mm-time { color: var(--dim); font-size: var(--fs-s); font-variant-numeric: tabular-nums; flex:none; }
  .mm-bar { flex:1; display:flex; gap:2px; height: var(--hit); }
  .mm-part { position:relative; border:1px solid var(--line); border-radius:3px;
    background-color: var(--card); background-repeat:no-repeat; background-size:100% 100%;
    cursor:pointer; padding:0; min-width: var(--hit); }
  .mm-part .mm-label { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
    font-size: var(--fs-s); color:var(--vscode-foreground); font-weight:600; pointer-events:none;
    background: color-mix(in srgb, var(--bg) 72%, transparent); border-radius: 3px; padding: 0 4px; }
  .mm-part:hover, .mm-part.cur { border-color: var(--accent); }
  .mm-part.cur::after { content:''; position:absolute; left:2px; right:2px; bottom:-8px;
    height:2px; background: var(--accent); }
  .mm-gap { min-width:4px; }

  /* 하루 = 끊기지 않는 2px 세로선(Primer Timeline) */
  .day { position: relative; padding-left: var(--indent); margin-top: 8px; }
  .day::before { content:''; position:absolute; left: calc(var(--rail) - 1px); top: 0; bottom: 0; width: 2px;
    background: var(--rule); }
  .chapter { scroll-margin-top: calc(var(--mmH) + 12px); }
  .chapter.part { margin: 0 0 16px; }
  /* 파트 사이 = 구분선 + 여백(Primer Timeline.Break의 역할. 굵은 띠는 쓰지 않는다) */
  .chapter.part ~ .chapter.part { margin-top: 16px; }
  .chapter.part ~ .chapter.part .ch-h { border-top: 1px solid var(--rule); }
  .ch-h { position: sticky; top: var(--mmH); z-index: 10;
    display: flex; align-items: baseline; gap: 8px;
    background: var(--bg); padding: 12px 0 4px; margin-left: calc(-1 * var(--indent)); padding-left: var(--indent); }
  .ch-label { font-size: var(--fs); font-weight: 600; color: var(--vscode-foreground); }
  .ch-range { color: var(--dim); font-size: var(--fs-s); font-variant-numeric: tabular-nums; }
  .gap-h { color: var(--dim); font-size: var(--fs-s); padding: 8px 0 4px; }

  .ep-toggle, .learn-add { border:none; background:none; color: var(--dim); font-size: var(--fs-s); cursor:pointer;
    min-height: var(--hit); padding: 0 8px; border-radius: 3px; }
  .ep-toggle:hover, .learn-add:hover { color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, var(--hover)); }
  section.ep .ep-body { display:none; }
  section.ep .ch-label { opacity: .6; }

  /* 배운 것 */
  .learn { position:relative; margin: 0 0 4px; }
  .learn textarea { width:100%; resize:none; overflow:hidden; font-family:inherit; font-size: var(--fs);
    line-height:1.5; padding: 4px 56px 4px 8px; margin: 4px 0;
    color: var(--vscode-input-foreground); background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, var(--line)); border-radius: 2px; }
  .learn textarea::placeholder { color: var(--dim); }
  .learn textarea:focus { border-color: var(--vscode-focusBorder); outline: none; }
  .learn.empty textarea, .learn.empty .saved, .learn:not(.empty) .learn-add { display:none; }
  .saved { position:absolute; right:8px; top:8px; color: var(--dim); font-size: var(--fs-s); opacity: 0; }
  .saved.on { opacity: 1; }

  /* 레일 노드. 작은 노드(코드 변경) = 16px codicon, 배경으로 세로선을 끊는다 */
  .item { position: relative; }
  .node { position:absolute; left: calc(var(--rail) - var(--indent) - 8px); top: 50%; transform: translateY(-50%);
    display:flex; align-items:center; justify-content:center; width: 16px; height: 16px; background: var(--bg); }
  .node.g { color: var(--g); } .node.y { color: var(--y); } .node.r { color: var(--r); }
  .node.p { color: var(--p); } .node.z { color: var(--dim); }
  /* 필기 배지 = 24px 원(Primer Timeline.Badge). 하루의 이야기라 코드 노드보다 크다 */
  .node.n { width: 24px; height: 24px; left: calc(var(--rail) - var(--indent) - 12px); border-radius: 50%;
    color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, var(--bg));
    box-shadow: 0 0 0 2px var(--bg); }
  .node.n .ci { width: 14px; height: 14px; }

  /* 행 공통(IntelliJ 목록): 시각 열 → 이름 → 요약 → 오른쪽 끝 메타·버튼 */
  details.scene > summary, .sg-head, .nz > summary {
    list-style:none; position:relative; display:flex; align-items:center; gap:8px;
    min-height: var(--row); padding: 2px 8px; border-radius: 3px; cursor:pointer; user-select:none; }
  details > summary::-webkit-details-marker { display:none; }
  details.scene > summary:hover, .sg-head:hover, .nz > summary:hover { background: var(--hover); }
  details.scene[open] > summary, .sgroup.open > .sg-head { background: var(--sel); }
  .time, .sg-time, .ntime { flex:none; width: var(--tcol); color: var(--dim); font-size: var(--fs-s);
    font-variant-numeric: tabular-nums; text-align:left; }
  summary button.time { min-height: var(--hit); padding: 0; border:none; background:none; cursor:pointer; border-radius: 3px; }
  summary button.time:hover { color: var(--vscode-textLink-foreground); text-decoration: underline; text-underline-offset: 3px; }
  .file { flex:none; color: var(--vscode-foreground); white-space: nowrap; }
  .sig { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-family: var(--mono); font-size: var(--fs-s); color: var(--dim); }
  .rwb { flex:none; font-size: var(--fs-s); border-radius: 8px; padding: 0 8px;
    color: var(--p); background: color-mix(in srgb, var(--p) 16%, transparent); }
  .meta { flex:none; width: 136px; display:flex; align-items:center; justify-content:flex-end; gap:8px; }
  .stat { font-family: var(--mono); font-size: var(--fs-s); color: var(--dim); font-variant-numeric: tabular-nums; }
  .stat i { font-style: normal; }
  .stat .sa + .sd { margin-left: 4px; }
  .bar { flex:none; display:inline-flex; height: 4px; border-radius: 2px; overflow:hidden; }
  .bar i { display:block; height: 100%; }
  .bar .ba { background: var(--g); } .bar .bd { background: var(--r); }
  .acts { flex:none; width: 72px; display:flex; justify-content:flex-end; }
  .act { display:inline-flex; align-items:center; justify-content:center; width: var(--hit); height: var(--hit);
    padding: 0; border:none; border-radius: 3px; background:none; color: var(--dim); cursor:pointer; opacity: 0; }
  .act:hover { background: var(--vscode-toolbar-hoverBackground, var(--hover)); color: var(--vscode-foreground); }
  summary:hover .act, summary:focus-within .act, .sg-head:hover .act, .note-item:hover .act,
  .note-item:focus-within .act, .act:focus-visible { opacity: 1; }
  .mk.on, .sg-mk { opacity: 1; color: var(--mk); }
  .op.off.on { opacity: 1; color: var(--vscode-textLink-foreground); }
  .ndel:hover { color: var(--r); }
  .chev { color: var(--dim); }
  details[open] > summary .chev, .sgroup.open > .sg-head .chev { transform: rotate(90deg); }

  /* diff = IntelliJ식: 도구 줄 + 줄 번호 두 칸 + 줄 배경색 */
  .diffbox { margin: 2px 8px 8px 8px; border: 1px solid var(--vscode-editorWidget-border, var(--line));
    border-radius: 4px; overflow: hidden; background: var(--bg); }
  .diff-tools { display:flex; align-items:center; gap:4px; padding: 4px 8px; border-bottom: 1px solid var(--line);
    background: var(--vscode-editorGroupHeader-tabsBackground, var(--card)); }
  .diff-tools .sp { flex:1; }
  .rwnote { font-size: var(--fs-s); color: var(--p); padding: 0 4px; }
  .dbtn { display:inline-flex; align-items:center; gap:4px; height: var(--hit); padding: 0 8px; border:none;
    border-radius: 3px; background:none; color: var(--vscode-foreground); font-size: var(--fs-s); cursor:pointer; }
  .dbtn .ci { width: 14px; height: 14px; }
  .dbtn:hover { background: var(--vscode-toolbar-hoverBackground, var(--hover)); }
  .diff { max-height: 380px; min-height: 48px; overflow: auto; resize: vertical;
    font-family: var(--mono); font-size: var(--vscode-editor-font-size, var(--fs)); line-height: 1.5; }
  .dline { display:grid; grid-template-columns: 48px 48px max-content; min-width: 100%; }
  .dline .ln { padding-right: 8px; text-align:right; color: var(--vscode-editorLineNumber-foreground, var(--dim));
    user-select:none; font-variant-numeric: tabular-nums; }
  .dline .tx { padding: 0 16px 0 8px; white-space: pre; }
  .dline.add { background: var(--vscode-diffEditor-insertedLineBackground, rgba(155,185,85,.2)); }
  .dline.del { background: var(--vscode-diffEditor-removedLineBackground, rgba(255,0,0,.2)); }
  .dline.hunk { display:block; padding: 2px 8px; color: var(--dim); font-size: var(--fs-s);
    background: var(--vscode-textCodeBlock-background, var(--card)); }
  .diff .empty { padding: 8px 12px; color: var(--dim); font-family: var(--vscode-font-family); font-size: var(--fs-s); }
  /* 불러오는 동안 = 스켈레톤 줄 */
  .skel { padding: 8px 12px; display:grid; gap: 8px; }
  .skel i { display:block; height: 8px; border-radius: 2px; background: color-mix(in srgb, var(--vscode-foreground) 8%, transparent); }
  .skel i:nth-child(1) { width: 56%; } .skel i:nth-child(2) { width: 72%; }
  .skel i:nth-child(3) { width: 40%; } .skel i:nth-child(4) { width: 64%; }

  /* 같은 파일 연속 씬 묶음: 머리 한 줄 → 누르면 구간별 행. 묶음 안에서는 파일 이름을 반복하지 않는다 */
  .sg-head { width:100%; border:none; background:none; color: inherit; font: inherit; text-align:left; }
  .sg-n { flex:none; font-size: var(--fs-s); color: var(--dim); }
  .sg-body { display: none; }
  .sgroup.open > .sg-body, body.filtering .sg-body { display: block; }
  .sg-body details.scene .file { display:none; }
  body.filtering .sg-head { display:none; }
  body.filtering .sg-body details.scene .file { display:revert; }

  /* 일괄 작업 */
  .nz > summary { color: var(--dim); font-size: var(--fs-s); }
  .nz .chev { margin-left: auto; }
  .nlist { max-height: 200px; overflow-y: auto; padding: 4px 8px 4px calc(var(--tcol) + 16px); }
  .nfile { font-size: var(--fs-s); font-family: var(--mono); color: var(--dim); }
  .st { display: inline-block; width: 16px; font-weight: 600; }
  .st-D { color: var(--r); } .st-A { color: var(--g); } .st-M { color: var(--y); }

  /* 필기 = 배지 + 시각 + 본문(상자 없음). 코드 행보다 위아래 여백을 넉넉히 */
  .note-item { display:flex; align-items:flex-start; gap:8px; padding: 6px 8px; min-height: 36px; border-radius: 3px; }
  .note-item:hover { background: var(--hover); }
  .note-item .node { top: 4px; transform: none; }
  .note-item .ntime { padding-top: 2px; }
  .ntext { flex:1; min-width: 0; max-width: 100ch; white-space: pre-wrap; word-break: break-word; cursor: text; }
  .note-item .acts { margin-top: -2px; }
  .handle { cursor: grab; }
  .note-item.dragging { opacity:.4; }
  .note-edit { flex:1; resize:none; overflow:hidden; font-family:inherit; font-size: var(--fs);
    line-height:1.5; padding: 0 4px; color: var(--vscode-input-foreground);
    background: var(--vscode-input-background); border:1px solid var(--vscode-focusBorder); border-radius:2px; }

  /* 필기 추가 존 (호버·드롭 대상) */
  .addzone { position:relative; height: 4px; cursor: pointer; }
  .addzone::before { content:'＋ 필기'; position:absolute; left:8px; right:0; top:50%;
    transform:translateY(-50%); font-size: var(--fs-s); color: var(--vscode-textLink-foreground);
    line-height: 0; opacity: 0; border-top: 1px dashed color-mix(in srgb, var(--vscode-textLink-foreground) 55%, transparent); }
  .addzone:hover, .addzone.drop { height: var(--hit); }
  .addzone:hover::before { opacity: 1; line-height: 2; }
  .addzone.drop::before { content:''; opacity:1; border-top: 2px solid var(--vscode-focusBorder); }

  .end-card { display:grid; justify-items:center; gap: 8px; margin: 48px 0 24px; color: var(--dim); }
  .end-card p { margin: 0; }
  .end-card button { font-size: var(--fs); cursor:pointer; min-height: var(--hit); padding: 4px 12px;
    border-radius: 2px; border: none; color: var(--vscode-button-foreground); background: var(--vscode-button-background); }
  .end-card button:hover { background: var(--vscode-button-hoverBackground); }
  .empty-day { text-align:center; margin-top: 64px; color: var(--dim); }
  .empty-day b { color: var(--vscode-foreground); }

  /* 움직임: IDE 목록처럼 높이 애니메이션 없이 즉시 펼치고, 화살표 회전·내용 페이드·호버 버튼 페이드·스켈레톤만.
     동작 줄이기 설정이면 전부 끈다 */
  @media (prefers-reduced-motion: no-preference) {
    details.scene[open] > .diffbox, details.nz[open] > .nlist, .sgroup.open > .sg-body { animation: fadein .12s ease-out; }
    @keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
    .chev { transition: transform .15s ease; }
    .act, .saved, .addzone::before { transition: opacity .15s; }
    details.scene > summary, .sg-head, .note-item, .chip, .toolbar button, .dbtn, .mm-part {
      transition: background-color .1s, border-color .15s, color .15s; }
    .skel i { background: linear-gradient(90deg, color-mix(in srgb, var(--vscode-foreground) 6%, transparent) 0%,
        color-mix(in srgb, var(--vscode-foreground) 14%, transparent) 50%, color-mix(in srgb, var(--vscode-foreground) 6%, transparent) 100%);
      background-size: 200% 100%; animation: shimmer 1.2s linear infinite; }
    @keyframes shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
  }
  @media (max-width: 560px) {
    body { padding: 0 16px 96px; }
    :root { --indent: 32px; --rail: 12px; --tcol: 72px; }
    .sig, .bar { display: none; }
    .meta { width: auto; }
    .chips { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 4px; }
  }
`;
