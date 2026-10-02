// recorder.js — 자동 스냅샷 기록기: 디바운스 커밋·실패 표면화·node_modules 가드·종료 flush
// env: { vscode, out, statusItem, repoRoot(), isRecording(), cfg(), timeStr() }
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { git, isRepo } = require('./git');
const { t } = require('./i18n');

// 파일 감시가 "깨우지 않을" 경로 — 커밋 대상을 줄이는 게 아니라 디바운스를 굶기지 않기 위한 것이다.
// 서버·빌드가 돌면 산출물 폴더가 20초보다 빠르게 계속 바뀌어 커밋 타이머가 영원히 밀린다(= 수업 내내
// 스냅샷 0개). 여기서 걸러도 그 파일이 git 추적 대상이면 다음 스냅샷의 add -A에 그대로 들어간다.
const WATCH_IGNORE_DIRS = /(^|\/)(\.git|node_modules|dist|build|out|target|\.gradle|\.idea|\.vscode|\.settings)(\/|$)/;
const WATCH_IGNORE_FILES = /\.(log|class|jar|war)$/i;

function isIgnoredWatchPath(p) {
  const s = String(p || '').replace(/\\/g, '/');
  return WATCH_IGNORE_DIRS.test(s) || WATCH_IGNORE_FILES.test(s);
}

// git 실패 원인을 사용자가 할 일 기준으로 나눈다 (상태바·알림 문구용)
function classifyGitError(err) {
  const s = String(err || '');
  if (/index\.lock/i.test(s)) return { kind: 'lock', label: t('gitErr.lock') };
  if (/ENOENT|not recognized|command not found/i.test(s)) return { kind: 'nogit', label: t('gitErr.noGit') };
  if (/EPERM|EACCES|permission denied/i.test(s)) return { kind: 'perm', label: t('gitErr.perm') };
  return { kind: 'other', label: s.split('\n')[0].slice(0, 120) || t('gitErr.unknown') };
}

// 지금 git 프로세스가 돌고 있는가. 확인 자체가 실패하면 "돌고 있다"로 본다(잠금을 함부로 지우지 않게)
function gitProcessRunning() {
  return new Promise((resolve) => {
    const [cmd, args] = process.platform === 'win32'
      ? ['tasklist', ['/FI', 'IMAGENAME eq git.exe', '/NH']]
      : ['pgrep', ['-x', 'git']];
    cp.execFile(cmd, args, { timeout: 3000, windowsHide: true }, (e, stdout) => {
      if (process.platform === 'win32') resolve(e ? true : /git\.exe/i.test(stdout));
      else resolve(e ? e.code !== 1 : true); // pgrep: 1 = 없음
    });
  });
}

// 남은 index.lock 정리: git 프로세스가 없고 잠금이 3초 이상 묵었을 때만 지운다(09-09 실측 대응, B4)
async function clearStaleLock(repo, isGitRunning) {
  const lock = path.join(repo, '.git', 'index.lock');
  let st;
  try { st = fs.statSync(lock); } catch { return 'none'; }
  if (Date.now() - st.mtimeMs < 3000) return 'fresh';
  if (await (isGitRunning || gitProcessRunning)()) return 'busy';
  try { fs.unlinkSync(lock); return 'cleared'; } catch { return 'busy'; }
}

function createRecorder(env) {
  const { vscode, out } = env;
  let commitTimer = null;
  let committing = false;
  let failNotified = false;
  const state = { failed: false };

  // quiet = 호출한 쪽(기록 켜기)이 직접 알린다 — 상태바·로그만 남기고 알림은 띄우지 않는다
  function commitFail(step, err, quiet) {
    state.failed = true;
    const now = env.timeStr();
    const why = classifyGitError(err);
    out.appendLine(t('log.snapshotFailed', { time: now, step, err }));
    env.statusItem.text = `$(warning) ${t('status.failed', { time: now })}`;
    env.statusItem.tooltip = t('status.failedTip', { why: why.label });
    env.statusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    if (!failNotified && !quiet) {
      failNotified = true;
      vscode.window.showErrorMessage(t('notify.snapshotFailed', { why: why.label }), t('btn.showLog'))
        .then(x => { if (x === t('btn.showLog')) out.show(); });
    }
    return { ok: false, step, err, why };
  }

  // add·commit 한 단계 실행. index.lock 때문이면 묵은 잠금을 정리하고 한 번만 다시 시도한다(B4)
  async function gitStep(repo, args) {
    let r = await git(repo, args);
    if (!r.ok && classifyGitError(r.err).kind === 'lock') {
      const s = await clearStaleLock(repo, env.isGitRunning);
      out.appendLine(t('log.lockDetected', { time: env.timeStr(),
        action: s === 'cleared' ? t('log.lockCleared') : t('log.lockKept', { state: s }) }));
      if (s === 'cleared') r = await git(repo, args);
    }
    return r;
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
      out.appendLine(t('log.nodeModules', { time: env.timeStr() }));
      vscode.window.showInformationMessage(t('notify.nodeModulesIgnored'));
      return true;
    }
    return false;
  }

  // 결과: { ok:true } · { ok:true, busy:true }(다른 커밋 진행 중, 2초 뒤 재시도 예약) · { ok:false, why }
  async function doCommit(repo, note, quiet) {
    if (committing) {
      commitTimer = setTimeout(() => { commitTimer = null; doCommit(repo, note); }, 2000);
      return { ok: true, busy: true };
    }
    committing = true;
    try {
      if (!(await isRepo(repo))) return commitFail(t('rec.stepCheck'), t('rec.notRepo'), quiet);
      let st = await git(repo, ['status', '--porcelain']);
      if (!st.ok) return commitFail('status', st.err, quiet);
      let lines = st.out.split('\n').filter(l => l.trim());
      if (lines.length === 0) return { ok: true };
      if (guardNodeModules(repo, lines)) {
        st = await git(repo, ['status', '--porcelain']);
        lines = st.out.split('\n').filter(l => l.trim());
        if (lines.length === 0) return { ok: true };
      }
      const now = env.timeStr();
      const add = await gitStep(repo, ['add', '-A']);
      if (!add.ok) return commitFail('add', add.err, quiet);
      const cm = await gitStep(repo, ['commit', '-m',
        `auto: ${now} (${note ? note + ', ' : ''}${lines.length} files)`]);
      if (!cm.ok) return commitFail('commit', cm.err, quiet);
      state.failed = false; failNotified = false;
      env.statusItem.text = `$(record) ${t('status.snapshot', { time: now })}`;
      env.statusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      // 오늘 첫 스냅샷이면 사이드바에 오늘 날짜가 없다. 커밋마다 트리를 갱신해 둔다
      if (env.onCommitted) env.onCommitted();
      return { ok: true };
    } finally {
      committing = false;
    }
  }

  // 조용한 중단(확장 업데이트·크래시·창 강제 종료) 뒤 이어받기. 기록이 켜진 채로 쌓여 있던
  // 변경을 켜지자마자 스냅샷 1개로 회수한다. 중간 시점은 못 살리지만 커밋 밖 방치는 막는다.
  // quiet = 기록 켜기에서 부를 때. 실패 안내는 켜기 쪽이 롤백과 함께 한 번만 띄운다(B3)
  async function recoverPending(quiet) {
    const repo = env.repoRoot();
    if (!repo || !env.isRecording()) return { ok: true };
    return doCommit(repo, '재시작 복구', quiet);
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

  return { scheduleCommit, flushSync, recoverPending, state };
}

module.exports = { createRecorder, isIgnoredWatchPath, classifyGitError, clearStaleLock };
