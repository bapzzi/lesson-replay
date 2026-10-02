// fileKinds.js: 파일 경로로 아는 두 가지
// ① 언어 이름(내보내기·복기 화면 표시용) ② 자동 생성·설정 파일 여부(내보내기에서 diff 생략, 순위 제외)
// 새 프로젝트를 만들면 mvnw(300줄)·mvnw.cmd·.gitignore·lock 파일이 그날 내보내기를 덮는다(10-02 실측: 707줄 중 약 550줄)

const LANG = {
  java: 'Java', kt: 'Kotlin', kts: 'Kotlin', js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', jsx: 'JSX',
  ts: 'TypeScript', tsx: 'TSX', py: 'Python', sql: 'SQL', html: 'HTML', htm: 'HTML', vue: 'Vue', css: 'CSS',
  scss: 'SCSS', less: 'Less', json: 'JSON', yml: 'YAML', yaml: 'YAML', xml: 'XML', md: 'Markdown',
  properties: 'Properties', gradle: 'Gradle', go: 'Go', rs: 'Rust', c: 'C', h: 'C', cpp: 'C++', cc: 'C++',
  hpp: 'C++', cs: 'C#', php: 'PHP', rb: 'Ruby', sh: 'Shell', bash: 'Shell', ps1: 'PowerShell', bat: 'Batch',
  cmd: 'Batch', swift: 'Swift', dart: 'Dart', r: 'R', lua: 'Lua', ipynb: 'Jupyter', txt: '텍스트',
  svg: 'SVG', png: '이미지', jpg: '이미지', jpeg: '이미지', gif: '이미지'
};

function langName(file) {
  const m = String(file || '').match(/\.([A-Za-z0-9]+)$/);
  return (m && LANG[m[1].toLowerCase()]) || '기타';
}

// 사람이 직접 쓰지 않는 파일: 빌드 도구 wrapper, 저장소 설정, 의존성 잠금, 압축본
const BOILER_NAMES = new Set(['mvnw', 'mvnw.cmd', 'gradlew', 'gradlew.bat', '.gitignore', '.gitattributes',
  '.editorconfig', '.npmrc', '.nvmrc', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb',
  'composer.lock', 'gemfile.lock', 'poetry.lock', 'pipfile.lock', 'cargo.lock', 'go.sum']);
const BOILER_PATHS = /(^|\/)\.mvn\/|(^|\/)gradle\/wrapper\/|-wrapper\.(properties|jar)$|\.min\.(js|css)$|(^|\/)(node_modules|dist|build|target|out)\//i;

function isBoilerplate(file) {
  const p = String(file || '').replace(/\\/g, '/');
  return BOILER_NAMES.has(p.split('/').pop().toLowerCase()) || BOILER_PATHS.test(p);
}

module.exports = { langName, isBoilerplate };
