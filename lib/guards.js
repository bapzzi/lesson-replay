// guards.js — 초보자 사고 방어 2종
// ① 남의 저장소 게이트: remote가 연결된 폴더는 URL을 보여주고 1회 확인(강사 배포·팀 repo 오염 방지)
// ② 중첩 repo 감지: 저장 파일이 안쪽 별도 git 저장소에 속하면 기록이 갈라진다 — 즉시 경고
//    (CRA·Vite 등이 프로젝트 생성 시 자체 git init을 하는 경우가 캠프 기본 시나리오)
const path = require('path');
const { git } = require('./git');

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
      `이 폴더는 원격 저장소에 연결돼 있습니다:\n${url}\n\n강사가 배포한 저장소나 팀·제출용 저장소라면 자동 커밋이 남의 이력을 오염시킵니다. 본인 소유의 개인 연습 저장소가 맞나요?`,
      { modal: true }, '내 저장소가 맞음, 켜기');
    if (pick !== '내 저장소가 맞음, 켜기') return false;
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
      `⚠ 안쪽에 별도 git 저장소가 생겼습니다: ${rel}\n이대로면 스냅샷이 안쪽 저장소로 들어가 하루 기록이 두 동강 납니다. (프로젝트 생성 도구가 자동으로 git init을 했을 가능성이 큽니다)`,
      '해결 방법 보기').then(x => {
        if (x !== '해결 방법 보기') return;
        out.appendLine('');
        out.appendLine(`[중첩 저장소 해결] ${rel}`);
        out.appendLine(`1. 탐색기에서 ${top} 폴더를 엽니다 (숨김 항목 표시 켜기)`);
        out.appendLine('2. 그 안의 ".git" 폴더 하나만 휴지통으로 보냅니다 (코드는 그대로 남습니다)');
        out.appendLine('3. 그 뒤부터는 바깥 저장소가 이어서 기록합니다. 지운 시점 이전 안쪽 기록은 복구되지 않습니다');
        out.show();
      });
  }

  return { confirmRemoteOk, warnIfNestedRepo };
}

module.exports = { createGuards, normPath, isUnder };
