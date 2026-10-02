#!/usr/bin/env node
// cli.js — VS Code 없이 복기 md를 내보낸다. til 스킬 등 바깥 도구가 "내보내기 버튼"을 대신 누르는 용도
//   node cli.js export [YYYY-MM-DD] [--repo <실습 저장소>] [--settings <VS Code settings.json>]
// 설정값(시간표·필기 폴더·아카이브 폴더 등)은 VS Code 사용자 settings.json의 lessonReplay.* → 확장 기본값 순으로 읽는다
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exportDayToFile } = require('./lib/exportDay');
const { isRepo } = require('./lib/git');
const { dateStr } = require('./lib/notes');
const { t } = require('./lib/i18n');

// settings.json은 주석·끝 쉼표를 허용하는 JSONC다. 문자열 안의 //(URL 등)는 건드리지 않는다
function parseJsonc(text) {
  let out = '', i = 0, inStr = false;
  while (i < text.length) {
    const ch = text[i], nx = text[i + 1];
    if (inStr) {
      out += ch;
      if (ch === '\\') { out += nx || ''; i += 2; continue; }
      if (ch === '"') inStr = false;
      i++; continue;
    }
    if (ch === '"') { inStr = true; out += ch; i++; continue; }
    if (ch === '/' && nx === '/') { while (i < text.length && text[i] !== '\n') i++; continue; }
    if (ch === '/' && nx === '*') { i = text.indexOf('*/', i + 2); i = i < 0 ? text.length : i + 2; continue; }
    out += ch; i++;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

function defaultSettingsPath() {
  if (process.platform === 'win32') return path.join(process.env.APPDATA || '', 'Code', 'User', 'settings.json');
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'settings.json');
  return path.join(os.homedir(), '.config', 'Code', 'User', 'settings.json');
}

// 확장 기본값: package.json contributes.configuration(배열·객체 둘 다)에서 lessonReplay.* default
function extensionDefaults() {
  const conf = require('./package.json').contributes.configuration;
  const props = Object.assign({}, ...[].concat(conf).map(g => g.properties || {}));
  const d = {};
  for (const [k, v] of Object.entries(props)) d[k.replace(/^lessonReplay\./, '')] = v.default;
  return d;
}

function loadConfig(settingsPath) {
  const c = extensionDefaults();
  try {
    const user = parseJsonc(fs.readFileSync(settingsPath, 'utf8'));
    for (const [k, v] of Object.entries(user)) if (k.startsWith('lessonReplay.')) c[k.slice(13)] = v;
  } catch { /* 사용자 설정 없음 → 기본값 */ }
  c.archiveDir = String(c.archiveDir || '').trim();
  c.includeTilPrompt = c.includeTilPrompt === true;
  return c;
}

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[++i];
    else a._.push(argv[i]);
  }
  return a;
}

async function main(argv) {
  const usage = t('cli.usage');
  const a = parseArgs(argv);
  if (a._[0] !== 'export') { console.error(usage); return 2; }
  const date = a._[1] || dateStr();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { console.error(`${t('cli.badDate', { date })}\n${usage}`); return 2; }
  const c = loadConfig(a.settings || defaultSettingsPath());
  // 저장소: --repo > archiveDir(오너 기기는 실습 저장소와 같다) > 현재 폴더
  const repo = path.resolve(a.repo || c.archiveDir || process.cwd());
  if (!(await isRepo(repo))) { console.error(t('cli.notRepo', { repo })); return 1; }
  const root = c.archiveDir || repo;
  const p = await exportDayToFile(repo, root, c, date);
  console.log(p);
  return 0;
}

if (require.main === module) main(process.argv.slice(2)).then(code => process.exit(code));

module.exports = { parseJsonc, loadConfig, main };
