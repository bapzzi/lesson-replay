// recorder.js — 자동 스냅샷 기록기: 디바운스 커밋·실패 표면화·node_modules 가드·종료 flush
// env: { vscode, out, statusItem, repoRoot(), isRecording(), cfg(), timeStr() }
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { git, isRepo } = require('./git');

function createRecorder(env) {
  const { vscode, out } = env;
  let commitTimer = null;
  let committing = false;
  let failNotified = false;
  const state = { failed: false };

  function commitFail(step, err) {
    state.failed = true;
    const t = env.timeStr();
    out.appendLine(`[${t}] 스냅샷 실패 (${step}): ${err}`);
    env.statusItem.text = `$(warning) 기록 실패 · ${t}`;
    env.statusItem.tooltip = `스냅샷이 실패했습니다: ${err}\n"수업 리플레이" 출력 로그를 확인하세요. 클릭하면 기록을 끕니다.`;
    env.statusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    if (!failNotified) {
      failNotified = true;
      vscode.window.showErrorMessage(`수업 리플레이: 스냅샷 저장에 실패했습니다 — ${err}`, '로그 보기')
        .then(x => { if (x === '로그 보기') out.show(); });
    }
  }

  // node_modules가 커밋되기 직전이면 .gitignore에 자동 추가 (초보자 저장소 폭발 방지)
  function guardNodeModules(repo, statusLines) {
    const hit = statusLines.some(l => /(^|\/)node_modules\//.test(l.slice(3)));
    if (!hit) return false;
    const gi = path.join(repo, '.gitignore');
    let cur = '';
    try { cur = fs.readFileSync(gi, 'utf8'); } catch { /* 없음 */ }
    if (!/^node_modules\/?$/m.test(cur)) {
      fs.writeFileSync(gi, cur + (cur && !cur.endsWith('\n') ? '\n' : '') + 'node_modules/\n', 'utf8');
      out.appendLine(`[${env.timeStr()}] node_modules 감지 → .gitignore에 추가 (스냅샷에서 제외)`);
      vscode.window.showInformationMessage(
        '수업 리플레이: node_modules를 .gitignore에 추가했습니다 — 스냅샷이 가볍게 유지됩니다.');
      return true;
    }
    return false;
  }

  async function doCommit(repo) {
    if (committing) { commitTimer = setTimeout(() => { commitTimer = null; doCommit(repo); }, 2000); return; }
    committing = true;
    try {
      if (!(await isRepo(repo))) { commitFail('확인', 'git 저장소가 아닙니다'); return; }
      let st = await git(repo, ['status', '--porcelain']);
      let lines = st.out.split('\n').filter(l => l.trim());
      if (lines.length === 0) return;
      if (guardNodeModules(repo, lines)) {
        st = await git(repo, ['status', '--porcelain']);
        lines = st.out.split('\n').filter(l => l.trim());
        if (lines.length === 0) return;
      }
      const t = env.timeStr();
      const add = await git(repo, ['add', '-A']);
      if (!add.ok) { commitFail('add', add.err); return; }
      const cm = await git(repo, ['commit', '-m', `auto: ${t} (${lines.length} files)`]);
      if (!cm.ok) { commitFail('commit', cm.err); return; }
      state.failed = false; failNotified = false;
      env.statusItem.text = `$(record) 기록중 · ${t} 스냅샷`;
      env.statusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } finally {
      committing = false;
    }
  }

  function scheduleCommit() {
    const repo = env.repoRoot();
    if (!repo || !env.isRecording()) return;
    if (commitTimer) clearTimeout(commitTimer);
    commitTimer = setTimeout(() => { commitTimer = null; doCommit(repo); },
      env.cfg().commitDelaySeconds * 1000);
  }

  // 종료 시 대기 중 스냅샷 flush — "수업 끝나자마자 노트북 덮기"에도 마지막 저장이 남게 시도
  // deactivate에 주어지는 시간은 보장이 없다 → 프로세스 2회로 최소화, 짧은 타임아웃.
  // add 후 commit 전에 죽어도 스테이징은 다음 자동 커밋에 흡수된다(기록 유실은 아님)
  function flushSync() {
    if (!commitTimer) return;
    clearTimeout(commitTimer);
    commitTimer = null;
    const repo = env.repoRoot();
    try {
      if (repo && env.isRecording()) {
        cp.execFileSync('git', ['-C', repo, 'add', '-A'], { cwd: repo, timeout: 2500 });
        cp.execFileSync('git', ['-C', repo, 'commit', '-m', `auto: ${env.timeStr()} (종료 직전)`],
          { cwd: repo, timeout: 4000 }); // 변경 없으면 commit이 그냥 실패 → catch
      }
    } catch { /* 종료 중 실패는 조용히 — 다음 시작 때 이어서 커밋됨 */ }
  }

  return { scheduleCommit, flushSync, state };
}

module.exports = { createRecorder };
