// repoWatch.js — 저장소 루트를 직접 감시한다 (VS Code가 연 폴더와 무관)
// 왜: 스냅샷은 git add -A로 저장소 전체를 찍지만, 커밋을 "깨우는" 신호는 VS Code가 연 폴더 안에서만
// 왔다. IntelliJ 등 외부 에디터로 고친 파일은 VS Code가 그 폴더를 열고 있어야만 잡혔고, 그러려면
// Java 프로젝트를 VS Code로 열어 언어서버 폭주(09-15~16)를 부르는 조건이 된다. 루트 자체를 Node가
// 직접 감시하면 VS Code는 필기 폴더만 열어도 된다.
const fs = require('fs');
const path = require('path');
const { isIgnoredWatchPath } = require('./recorder');

// root: 저장소 루트, onChange(fullPath): 무시 대상이 아닌 변경마다 호출, log(msg): 선택
function watchRepoTree(root, onChange, log) {
  let w = null;
  try {
    // Windows·macOS는 recursive 감시를 OS가 지원한다 (Linux는 Node 20+)
    w = fs.watch(root, { recursive: true }, (_ev, rel) => {
      if (!rel) return;
      // 상대경로로만 판정 — 저장소 경로의 조상 폴더 이름(build·out 등)이 무시 패턴과 같아도 영향 없게
      if (isIgnoredWatchPath(String(rel))) return;
      const full = path.join(root, String(rel));
      // Windows는 자식 파일이 바뀔 때 부모 폴더 항목도 따로 알린다. 무시 폴더(target 등) 안에서 빌드가
      // 돌 때 부모 폴더 이벤트가 새어 나오면 커밋 타이머가 계속 밀리므로 폴더 이벤트는 버린다.
      try { if (fs.statSync(full).isDirectory()) return; } catch { /* 이미 삭제됨 — 파일 삭제로 보고 통과 */ }
      onChange(full);
    });
    // 감시 중인 폴더가 지워지면 EPERM이 올 수 있다 — 확장 전체가 죽지 않게 삼킨다
    w.on('error', (e) => { if (log) log(`저장소 감시 오류: ${e.message}`); });
  } catch (e) {
    if (log) log(`저장소 감시 시작 실패 (${root}): ${e.message}`);
    return { close() {} };
  }
  return { close() { try { w.close(); } catch { /* 이미 닫힘 */ } } };
}

module.exports = { watchRepoTree };
