// repoWatch.test.js — 저장소 루트 직접 감시 검증 (node --test)
// 핵심: VS Code가 연 폴더와 무관하게(IntelliJ 등 외부 에디터의 저장도) 변경을 잡아야 한다.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { watchRepoTree } = require('../lib/repoWatch');

function mkRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'repowatch-'));
  fs.mkdirSync(path.join(root, 'msa', 'user-service', 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'msa', 'user-service', 'target'), { recursive: true });
  fs.mkdirSync(path.join(root, '.idea'), { recursive: true });
  return root;
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));

test('깊은 하위 폴더의 새 파일·수정이 감지된다 (외부 에디터 저장 모사)', async () => {
  const root = mkRepo();
  const seen = [];
  const w = watchRepoTree(root, (p) => seen.push(p));
  await wait(300);
  const f = path.join(root, 'msa', 'user-service', 'src', 'UserController.java');
  fs.writeFileSync(f, 'class A {}');
  await wait(300);
  fs.appendFileSync(f, '\n// edit');
  await wait(500);
  w.close();
  fs.rmSync(root, { recursive: true, force: true });
  assert.ok(seen.some(p => p.endsWith('UserController.java')), `감지 못함: ${JSON.stringify(seen)}`);
});

test('무시 경로(.idea·target·*.log)는 깨우지 않는다', async () => {
  const root = mkRepo();
  const seen = [];
  const w = watchRepoTree(root, (p) => seen.push(p));
  await wait(300);
  fs.writeFileSync(path.join(root, '.idea', 'workspace.xml'), 'x');
  fs.writeFileSync(path.join(root, 'msa', 'user-service', 'target', 'A.class'), 'x');
  fs.writeFileSync(path.join(root, 'msa', 'user-service', 'app.log'), 'x');
  await wait(600);
  w.close();
  fs.rmSync(root, { recursive: true, force: true });
  assert.deepStrictEqual(seen, []);
});

test('저장소 경로의 조상에 build·out 같은 이름이 있어도 상대경로만 본다', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rw-'));
  const root = path.join(base, 'build', 'repo'); // 조상 이름이 무시 패턴과 같다
  fs.mkdirSync(path.join(root, 'msa'), { recursive: true });
  const seen = [];
  const w = watchRepoTree(root, (p) => seen.push(p));
  await wait(300);
  fs.writeFileSync(path.join(root, 'msa', 'A.java'), 'x');
  await wait(500);
  w.close();
  fs.rmSync(base, { recursive: true, force: true });
  assert.ok(seen.some(p => p.endsWith('A.java')), `조상 경로 때문에 놓침: ${JSON.stringify(seen)}`);
});

test('없는 경로여도 던지지 않고 close()가 안전하다', () => {
  const logs = [];
  const w = watchRepoTree(path.join(os.tmpdir(), 'no-such-dir-' + Date.now()), () => {}, (m) => logs.push(m));
  assert.doesNotThrow(() => w.close());
  assert.ok(logs.length >= 1);
});
