// cli.test.js — VS Code 없이 내보내기 (v1.5.0 F2)
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const { parseJsonc, loadConfig, main } = require('../cli');
const { dateStr } = require('../lib/notes');

test('parseJsonc: 주석·끝 쉼표를 걷어내되 문자열 속 //는 보존한다', () => {
  const j = parseJsonc(`{
    // 줄 주석
    "a": "http://x.y/z", /* 블록 주석 */
    "b": ["09:10-10:20", "10:30-11:30",],
  }`);
  assert.strictEqual(j.a, 'http://x.y/z');
  assert.deepStrictEqual(j.b, ['09:10-10:20', '10:30-11:30']);
});

test('loadConfig: 사용자 settings의 lessonReplay.*가 확장 기본값을 덮는다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lr-cfg-'));
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, '{ "lessonReplay.blocks": ["09:00-10:00",], // 내 시간표\n "editor.x": 1 }');
  const c = loadConfig(p);
  assert.deepStrictEqual(c.blocks, ['09:00-10:00']);
  assert.strictEqual(c.notesDir, '필기'); // 기본값 유지
  assert.strictEqual(c.archiveDir, '');
  assert.strictEqual(loadConfig(path.join(dir, '없음.json')).notesDir, '필기'); // 파일 없으면 기본값
  fs.rmSync(dir, { recursive: true, force: true });
});

test('main export: 오늘 커밋이 있는 저장소에서 복기 md를 만든다', async () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'lr-cli-'));
  const g = (...a) => cp.execFileSync('git', ['-C', repo, ...a], { stdio: 'pipe' });
  g('init', '-q');
  g('config', 'user.email', 'cli@test.local');
  g('config', 'user.name', 'cli');
  fs.writeFileSync(path.join(repo, 'App.java'), 'public class App {}\n');
  g('add', '-A');
  g('commit', '-q', '-m', 'auto: test');
  const settings = path.join(repo, 'no-settings.json'); // 없는 파일 → 기본값

  const logs = [];
  const orig = console.log;
  console.log = (s) => logs.push(s);
  try {
    assert.strictEqual(await main(['export', dateStr(), '--repo', repo, '--settings', settings]), 0);
  } finally { console.log = orig; }
  const out = path.join(repo, '복기', `${dateStr()}-복기.md`);
  assert.strictEqual(logs[0], out);
  const md = fs.readFileSync(out, 'utf8');
  assert.match(md, /App\.java/);
  fs.rmSync(repo, { recursive: true, force: true });
});

test('main: 잘못된 명령·날짜·저장소는 0이 아닌 코드', async () => {
  const err = console.error;
  console.error = () => {};
  try {
    assert.strictEqual(await main([]), 2);
    assert.strictEqual(await main(['export', '10-02']), 2);
    assert.strictEqual(await main(['export', '2026-10-02', '--repo', os.tmpdir(), '--settings', 'x']), 1);
  } finally { console.error = err; }
});
