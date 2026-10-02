// guards.js — 초보자 사고 방어 2종
// ① 남의 저장소 게이트: remote가 연결된 폴더는 URL을 보여주고 1회 확인(강사 배포·팀 repo 오염 방지)
// ② 중첩 repo 감지: 저장 파일이 안쪽 별도 git 저장소에 속하면 기록이 갈라진다 — 즉시 경고
//    (CRA·Vite 등이 프로젝트 생성 시 자체 git init을 하는 경우가 캠프 기본 시나리오)
const path = require('path');
const { git } = require('./git');
const { t } = require('./i18n');

// 경로 비교는 반드시 정규화 후에 — git for Windows는 슬래시(C:/...)로,
// VS Code fsPath는 백슬래시(C:\...)로 온다. startsWith 직접 비교는 항상 false가 나는 사고.
function normPath(p) {
  return path.normalize(p || '').replace(/[\\/]+$/, '').toLowerCase();
}
function isUnder(parent, child) {
  const a = normPath(parent), c = normPath(child);
  return c === a || c.startsWith(a + path.sep);
}

function createGuards(env) {
  const { vscode, out, globalState } = env;

  async function confirmRemoteOk(repoTop) {
    const r = await git(repoTop, ['remote', 'get-url', 'origin']);
    const url = r.ok ? r.out.trim() : '';
    if (!url) return true;
    const key = `remoteOk:${repoTop}|${url}`;
    if (globalState.get(key) === true) return true;
    const pick = await vscode.window.showWarningMessage(
      t('notify.remoteConfirm', { url }),
      { modal: true }, t('btn.remoteOk'));
    if (pick !== t('btn.remoteOk')) return false;
    await globalState.update(key, true);
    return true;
  }

  const nestedChecked = new Map(); // dir -> toplevel(캐시)
  async function warnIfNestedRepo(repoTop, savedFsPath) {
    const dir = path.dirname(savedFsPath);
    if (!isUnder(repoTop, dir)) return;
    let top = nestedChecked.get(dir);
    if (top === undefined) {
      const r = await git(dir, ['rev-parse', '--show-toplevel']);
      top = r.ok ? r.out.trim() : '';
      nestedChecked.set(dir, top);
    }
    if (!top || normPath(top) === normPath(repoTop)) return;
    const key = `nestedWarned:${top}`;
    if (globalState.get(key)) return;
    await globalState.update(key, true);
    const rel = path.relative(repoTop, top);
    vscode.window.showWarningMessage(
      t('notify.nestedRepo', { rel }),
      t('btn.howToFix')).then(x => {
        if (x !== t('btn.howToFix')) return;
        out.appendLine('');
        out.appendLine(t('log.nestedTitle', { rel }));
        out.appendLine(t('log.nestedStep1', { top }));
        out.appendLine(t('log.nestedStep2'));
        out.appendLine(t('log.nestedStep3'));
        out.show();
      });
  }

  return { confirmRemoteOk, warnIfNestedRepo };
}

module.exports = { createGuards, normPath, isUnder };
