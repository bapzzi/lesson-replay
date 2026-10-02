// highlight.js: 복기 화면 diff 문법 색칠 (2.0 ① spec §4)
// 라이브러리 = media/vendor/highlight.min.js (highlight.js 11.12.0 공통 언어 빌드, BSD-3, 라이선스 = 같은 폴더)
// 웹뷰는 현재 VS Code 테마의 문법 색을 읽을 수 없다. 그래서 기본 테마(Dark Modern / Light Modern) 토큰 색을
// CSS로 직접 넣는다. 다른 테마에서는 편집기 색과 조금 다를 수 있다. 줄 단위 색칠(여러 줄 주석 중간 줄은 오차 허용)
const fs = require('fs');
const path = require('path');

let lib = null;
function libSource() {
  if (lib === null) {
    try { lib = fs.readFileSync(path.join(__dirname, '..', 'media', 'vendor', 'highlight.min.js'), 'utf8'); }
    catch { lib = ''; } // 없으면 색 없이(diff는 그대로 보인다)
  }
  return lib;
}

// 확장자 → highlight.js 언어 이름. 목록에 없으면 null = 색 없음
const EXT_LANG = {
  java: 'java', kt: 'kotlin', kts: 'kotlin', js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript', py: 'python', sql: 'sql', html: 'xml', htm: 'xml', vue: 'xml', xml: 'xml',
  svg: 'xml', css: 'css', scss: 'scss', less: 'less', json: 'json', yml: 'yaml', yaml: 'yaml', md: 'markdown',
  go: 'go', rs: 'rust', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp', cs: 'csharp', php: 'php', rb: 'ruby',
  sh: 'bash', bash: 'bash', swift: 'swift', properties: 'ini', ini: 'ini', lua: 'lua', r: 'r', graphql: 'graphql'
};
function langForFile(file) {
  const m = String(file || '').match(/\.([A-Za-z0-9]+)$/);
  return (m && EXT_LANG[m[1].toLowerCase()]) || null;
}

// Dark Modern(Dark+) / Light Modern(Light+) 토큰 색. 고대비 다크는 다크 값, 고대비 라이트는 라이트 값
const CSS = `
  .hljs-keyword, .hljs-literal, .hljs-tag, .hljs-name, .hljs-section { color: #569cd6; }
  .hljs-type, .hljs-built_in, .hljs-title.class_, .hljs-title.class_.inherited__ { color: #4ec9b0; }
  .hljs-title, .hljs-title.function_, .hljs-meta { color: #dcdcaa; }
  .hljs-string, .hljs-template-tag, .hljs-template-variable, .hljs-addition { color: #ce9178; }
  .hljs-regexp { color: #d16969; }
  .hljs-number, .hljs-symbol, .hljs-bullet { color: #b5cea8; }
  .hljs-comment, .hljs-quote { color: #6a9955; }
  .hljs-variable, .hljs-params, .hljs-attr, .hljs-property, .hljs-attribute { color: #9cdcfe; }
  .hljs-selector-tag, .hljs-selector-class, .hljs-selector-id, .hljs-selector-attr, .hljs-selector-pseudo { color: #d7ba7d; }
  .hljs-emphasis { font-style: italic; } .hljs-strong { font-weight: 600; }
  body.vscode-light .hljs-keyword, body.vscode-light .hljs-literal, body.vscode-light .hljs-section,
  body.vscode-high-contrast-light .hljs-keyword, body.vscode-high-contrast-light .hljs-literal { color: #0000ff; }
  body.vscode-light .hljs-tag, body.vscode-light .hljs-name, body.vscode-light .hljs-selector-tag,
  body.vscode-light .hljs-selector-class, body.vscode-light .hljs-selector-id { color: #800000; }
  body.vscode-light .hljs-type, body.vscode-light .hljs-built_in, body.vscode-light .hljs-title.class_,
  body.vscode-high-contrast-light .hljs-type, body.vscode-high-contrast-light .hljs-title.class_ { color: #267f99; }
  body.vscode-light .hljs-title, body.vscode-light .hljs-title.function_, body.vscode-light .hljs-meta,
  body.vscode-high-contrast-light .hljs-title.function_ { color: #795e26; }
  body.vscode-light .hljs-string, body.vscode-light .hljs-template-tag, body.vscode-light .hljs-addition,
  body.vscode-high-contrast-light .hljs-string { color: #a31515; }
  body.vscode-light .hljs-regexp { color: #811f3f; }
  body.vscode-light .hljs-number, body.vscode-light .hljs-symbol, body.vscode-light .hljs-bullet,
  body.vscode-high-contrast-light .hljs-number { color: #098658; }
  body.vscode-light .hljs-comment, body.vscode-light .hljs-quote,
  body.vscode-high-contrast-light .hljs-comment { color: #008000; }
  body.vscode-light .hljs-variable, body.vscode-light .hljs-params, body.vscode-light .hljs-property,
  body.vscode-light .hljs-attribute, body.vscode-high-contrast-light .hljs-variable { color: #001080; }
  body.vscode-light .hljs-attr { color: #e50000; }
`;

module.exports = { libSource, langForFile, HIGHLIGHT_CSS: CSS };
