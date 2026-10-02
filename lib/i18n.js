// i18n.js: 사용자에게 보이는 문구를 한 곳에 모은다 (2.0 ① spec §5). 영어 사전은 ②에서 같은 키로 추가
// t(key, vars): {name} 자리를 vars로 채운다. vars에 없는 자리({날짜} 같은 틀 자리표시 포함)는 그대로 둔다
// dict(prefix): 키가 prefix로 시작하는 항목만 (웹뷰 페이지에 'web.' 문구를 실어 보낼 때)
// vscode를 require하지 않는다. cli.js·테스트에서도 쓴다
const ko = {
  // ── 공통 ──
  'app.name': '수업 리플레이',
  'date.weekdays': '일 월 화 수 목 금 토', // 공백으로 나눠 일요일부터 7개

  // ── 상태바 ──
  'status.notRepo': '기록 불가: git 저장소 아님',
  'status.notRepoTip': '이 폴더는 git 저장소가 아니라 스냅샷을 남길 수 없습니다. 클릭해서 안내를 보세요.',
  'status.recording': '기록중',
  'status.recordingTip': '저장할 때마다 스냅샷이 남습니다. 클릭하면 끕니다.',
  'status.off': '기록 꺼짐',
  'status.offTip': '클릭하면 이 폴더의 자동 기록을 켭니다 (개인 연습 저장소 전용).',
  'status.failed': '기록 실패 · {time}',
  'status.failedTip': '스냅샷 실패: {why}\n자세한 내용은 "수업 리플레이" 출력 로그. 클릭하면 기록을 끕니다.',
  'status.snapshot': '기록중 · {time} 스냅샷',
  'status.toggling': '수업 리플레이: 기록 상태를 바꾸는 중입니다',

  // ── 알림 버튼 ──
  'btn.on': '켜기',
  'btn.off': '끄기',
  'btn.cancel': '취소',
  'btn.recordOn': '기록 켜기',
  'btn.notToday': '오늘은 그만',
  'btn.initRepo': 'git 저장소 만들기',
  'btn.retry': '다시 시도',
  'btn.showLog': '로그 보기',
  'btn.later': '나중에',
  'btn.remoteOk': '내 저장소가 맞음, 켜기',
  'btn.howToFix': '해결 방법 보기',

  // ── 알림 ──
  'notify.legacyAutoRecord': '이 저장소의 설정 파일에 자동 기록이 켜져 있습니다(저장소에 담겨 배포된 설정일 수 있음). 이 컴퓨터에서도 기록을 켤까요?',
  'notify.archiveDirFallback': '아카이브 폴더를 쓸 수 없어 필기를 실습 저장소에 저장합니다: {dir}. 설정(lessonReplay.archiveDir)을 확인해 주세요.',
  'notify.nudge': '수업 리플레이: 수업 시간인데 기록이 꺼져 있습니다. 지금 켜면 이후 저장부터 스냅샷이 남습니다.',
  'notify.notRepoOpen': '열려 있는 폴더가 git 저장소가 아닙니다. 사이드바 "수업 리플레이"에서 저장소를 먼저 만들어 주세요.',
  'notify.fileNotFound': '파일을 찾을 수 없습니다: {path} (삭제됐거나 이름이 바뀐 파일일 수 있습니다)',
  'notify.openFolderFirst': '기록할 폴더를 먼저 열어 주세요.',
  'notify.openPracticeFolderFirst': '실습 폴더를 먼저 열어 주세요.',
  'notify.notRepoYet': '이 폴더는 아직 git 저장소가 아닙니다. 저장소를 만들면 바로 기록할 수 있습니다 (기록은 전부 이 폴더 안에만 남습니다).',
  'notify.confirmRecord': '이 폴더에서 저장할 때마다 자동 git 커밋을 남깁니다. 개인 연습 저장소에서만 켜세요 (팀 과제·제출용 저장소 금지).',
  'notify.recordStarting': '수업 리플레이: 기록 켜는 중',
  'notify.recordStartFailed': '수업 리플레이: 기록을 켜지 못했습니다. {why}',
  'notify.gitInitFailed': 'git init 실패: {err}',
  'notify.repoCreated': 'git 저장소를 만들었습니다. 이제 기록을 켤 수 있습니다.',
  'notify.welcome': '수업 리플레이: 저장(Ctrl+S)할 때마다 스냅샷을 남겨, 하루의 코드 흐름을 복기합니다. 개인 연습 저장소에서 기록을 켜 보세요.',
  'notify.pickDate': '복기할 날짜',
  'notify.templateHint': '필기 틀을 고치면 다음에 새로 만드는 필기부터 적용됩니다. 자리표시: {날짜} {요일} {파트}',
  'notify.useTimetable': '시간표(lessonReplay.blocks)를 내 수업 시간으로 바꿔 주세요. 복기 화면과 필기 틀이 파트로 나뉩니다.',
  'notify.useSessions': '시간표 없이 씁니다. {minutes}분 넘게 쉰 지점마다 세션이 나뉩니다(lessonReplay.sessionGapMinutes).',
  'notify.archivePickLabel': '이 폴더에 아카이브',
  'notify.archivePickTitle': '필기·한 줄 정리를 모아둘 폴더 선택',
  'notify.archiveDirSet': '아카이브 폴더 지정: {dir}',
  'notify.snapshotFailed': '수업 리플레이: 스냅샷을 저장하지 못했습니다. {why}',
  'notify.nodeModulesIgnored': '수업 리플레이: node_modules를 .gitignore에 추가했습니다. 스냅샷에서 빠집니다.',
  'notify.remoteConfirm': '이 폴더는 원격 저장소에 연결돼 있습니다:\n{url}\n\n강사가 배포한 저장소나 팀·제출용 저장소라면 자동 커밋이 남의 이력을 오염시킵니다. 본인 소유의 개인 연습 저장소가 맞나요?',
  'notify.nestedRepo': '⚠ 안쪽에 별도 git 저장소가 생겼습니다: {rel}\n이대로면 스냅샷이 안쪽 저장소로 들어가 하루 기록이 두 동강 납니다. (프로젝트 생성 도구가 자동으로 git init을 했을 가능성이 큽니다)',

  // ── 편집기 탭(복기 패널·그 시점 파일·diff 편집기) ──
  'panel.title': '복기',
  'panel.titleDate': '복기 {date}',
  'editor.snapshotLabel': '{base}@{time}시점{ext}',
  'editor.diffPrev': '이전',
  'editor.diffTitle': '{file} {start}~{end} 변경',

  // ── 출력 로그 ──
  'log.snapshotFailed': '[{time}] 스냅샷 실패 ({step}): {err}',
  'log.lockDetected': '[{time}] index.lock 감지 → {action}',
  'log.lockCleared': '묵은 잠금 정리 후 재시도',
  'log.lockKept': '정리 안 함({state})',
  'log.nodeModules': '[{time}] node_modules 감지 → .gitignore에 추가 (스냅샷에서 제외)',
  'log.nestedTitle': '[중첩 저장소 해결] {rel}',
  'log.nestedStep1': '1. 탐색기에서 {top} 폴더를 엽니다 (숨김 항목 표시 켜기)',
  'log.nestedStep2': '2. 그 안의 ".git" 폴더 하나만 휴지통으로 보냅니다 (코드는 그대로 남습니다)',
  'log.nestedStep3': '3. 그 뒤부터는 바깥 저장소가 이어서 기록합니다. 지운 시점 이전 안쪽 기록은 복구되지 않습니다',
  'log.notesWatchError': '필기 폴더 감시 오류: {msg}',
  'log.notesWatchFailed': '필기 폴더 감시 시작 실패 ({dir}): {msg}',

  // ── 기록기(git 실패 원인) ──
  'gitErr.lock': '다른 git 작업이 저장소를 잠그고 있음(index.lock)',
  'gitErr.noGit': 'git을 찾을 수 없음',
  'gitErr.perm': '파일 권한 문제',
  'gitErr.unknown': '알 수 없는 오류',
  'rec.stepCheck': '확인',
  'rec.notRepo': 'git 저장소가 아닙니다',

  // ── 사이드바 트리 ──
  'tree.todayNote': '오늘 필기',
  'tree.todayNoteTip': '오늘 필기 열기 (없으면 새로 만듦)',
  'tree.openTodayNote': '오늘 필기 열기',
  'tree.archive': '아카이브 폴더',
  'tree.archiveUnset': '미지정 (실습 폴더에 저장)',
  'tree.setArchive': '아카이브 폴더 지정',
  'tree.archiveTip': '필기·한 줄 정리를 모아 둘 폴더 고르기',
  'tree.weekend': '주말',
  'tree.openStory': '복기 열기',
  'tree.markedTip': '다시 볼 것: {path} ({start}). 클릭하면 복기 열기',

  // ── 복기 화면(웹뷰). 'web.' 전부가 페이지 스크립트에도 실려 간다 ──
  'web.statusNew': '새로 만듦',
  'web.statusMod': '수정',
  'web.statusDel': '삭제',
  'web.statusRework': '지웠다 다시 만듦',
  'web.rework': '갈아엎음',
  'web.together': '함께: {files}',
  'web.rwNote': '지우기 전 판 ↔ 새 판',
  'web.sceneTip': '클릭: 이 구간의 변경 이력',
  'web.openSnapshotTip': '이 시점({range} 마지막 저장)의 파일 열기',
  'web.markTip': '다시 볼 것 표시 (사이드바·★ 칩에 모임)',
  'web.backToPart': '파트로 되돌리기',
  'web.moveOff': '수업과 무관한 변경: 「시간 외」로 보내기',
  'web.hideTip': '복기·TIL 내보내기에서 숨기기 (커밋은 그대로)',
  'web.openDiffTip': 'VS Code diff 편집기에서 이 구간 비교',
  'web.openDiff': 'diff 편집기로 열기',
  'web.openCurTip': '디스크의 최신 파일을 이 씬의 수정 위치로 열기',
  'web.openCur': '현재 파일 열기',
  'web.moreCount': '외 {n}개',
  'web.noise': '일괄 작업 · 파일 {n}개',
  'web.minimap': '하루 타임라인',
  'web.learnAdd': '＋ 배운 것',
  'web.learnPlaceholder': '이 파트에서 배운 것',
  'web.saved': '저장됨',
  'web.note': '필기',
  'web.marked': '다시 볼 것',
  'web.emptyPart': '기록 없음 · ＋ 배운 것',
  'web.emptyDayTitle': '이 날짜의 스냅샷 없음',
  'web.emptyDayHint': '① 하단 상태바 「⏺ 기록중」 확인 → ② 코드 저장(Ctrl+S) → ③ 20초 뒤 스냅샷 기록',
  'web.dayEnd': '복기 끝',
  'web.export': 'TIL 원자재로 내보내기',
  'web.exportTip': '배운 것·필기·코드 diff를 md 한 파일로 저장 (설정 includeTilPrompt를 켜면 AI 요청 프롬프트 포함)',
  'web.statFiles': '파일 {files} · 씬 {scenes}',
  'web.rwJumpTip': '갈아엎은 씬으로 이동',
  'web.rwCount': '갈아엎음 {n}',
  'web.statNotes': '필기 {n}',
  'web.chipTip': '{path}: 이 파일의 씬만 보기',
  'web.moreChipsTip': '나머지 파일 칩 펼치기',
  'web.markChipTip': '★ 표시한 씬만 보기',
  'web.unhideTip': '숨긴 씬을 모두 복기에 되돌리기',
  'web.unhide': '숨김 {n}개 · 되돌리기',
  'web.all': '전체',
  'web.legend': '표기',
  'web.filterStat': '{name} · 씬 {n}',
  'web.noChange': '변경 없음',
  'web.dragTip': '드래그해서 위치 이동',
  'web.noteDelete': '필기 삭제',
  'web.noteAdd': '필기 추가',
  'web.notePlaceholder': '필기 (Enter 저장 · Shift+Enter 줄바꿈 · Esc 취소)',
  'web.groupTip': '클릭: 구간별로 펼치기',
  'web.segments': '{n}구간',
  'web.groupMarkTip': '다시 볼 것 표시된 구간 있음',

  // ── TIL 원자재 내보내기(md). 마크다운 기호(#, -, >, |)는 코드에 둔다 ──
  'export.statusNew': '새로 만듦',
  'export.statusMod': '수정',
  'export.statusDel': '삭제',
  'export.statusRework': '갈아엎음',
  'export.longDiff': '… (긴 변경, {n}줄 생략)',
  'export.newFileHead': '… (새 파일 {total}줄 중 앞 {shown}줄. 전체는 복기 화면에서)',
  'export.languages': '언어: {list}',
  'export.boilerplate': '자동 생성·설정 파일(diff 생략): {list}',
  'export.unitSession': '세션',
  'export.unitPart': '파트',
  'export.title': '{date} ({dow}) 학습 기록',
  'export.factRange': '기록 {from}~{to}',
  'export.factNone': '기록 없음',
  'export.factFiles': '파일 {n}',
  'export.factBreakdown': '(새로 {new} · 수정 {mod}{del})',
  'export.factDel': ' · 삭제 {n}',
  'export.factNotes': '필기 {n}',
  'export.factRework': '갈아엎음 {n}',
  'export.topLevel': '(최상위)',
  'export.mostChanged': '가장 많이 바뀐 곳: {dir} (파일 {n} · {pm})',
  'export.zeroChange': '변경 0',
  'export.hPrompt': 'TIL 작성 프롬프트',
  'export.hGlance': '한눈에',
  'export.colSegment': '구간',
  'export.colTime': '시간',
  'export.colNotes': '필기',
  'export.colFiles': '주로 만진 파일',
  'export.tagNew': '새로',
  'export.segments': '{n}구간',
  'export.more': '외 {n}',
  'export.notesOnly': '(필기만)',
  'export.emptyParts': '기록 없음: {list}',
  'export.hFlow': '흐름',
  'export.learned': '배운 것: {text}',
  'export.flowNote': '{when}필기 · {text}',
  'export.flowNotes': '{when}필기 · {text} 외 {n}개',
  'export.flowNoise': '{time} 일괄 작업 · 파일 {n}개',
  'export.flowBatch': '{time} 동시 저장 파일 {n}개 · {files}',
  'export.hReview': '다시 볼 곳',
  'export.none': '없음',
  'export.trial': '시행착오 후보: {file} ({why})',
  'export.segmentsFixed': '{n}구간 고침',
  'export.noDiff': '(변경 내용 없음)',
  'export.diffOmitted': '(diff 생략: 내보내기 크기 제한)',
  'export.hAppendixA': '부록 A: 파일별 하루 변화',
  'export.seeAppendixB': '구간별 변화는 부록 B',
  'export.hAppendixB': '부록 B: 시행착오 후보의 구간별 변화',
  'export.hAppendixC': '부록 C: 필기 전문',
  'export.omittedNote': '⚠ 내보내기 크기 제한(diff {max}줄)으로 diff {n}개를 생략했습니다. 해당 파일은 복기 화면에서 직접 보세요.',

  // ── 필기 틀(내장 기본). {날짜}{요일}{파트}는 틀 자리표시라 t()가 건드리지 않는다 ──
  // 문구를 바꾸면 notes.js isScaffoldLine의 판정 패턴도 함께 본다
  'notes.tplClassTitle': '{날짜} ({요일}) 수업 필기',
  'notes.tplHint1': '각 파트 제목 아래에 자유롭게 적으세요. 저장할 때마다 적은 시각이 함께 기록되어,',
  'notes.tplHint2': '수업 복기에서 코드 흐름과 자동으로 교차됩니다.',
  'notes.tplFreeTitle': '{날짜} ({요일}) 학습 필기',

  // ── 구간 이름(model). 한 줄 정리 JSON의 키로도 쓰인다 ──
  'model.part': '파트{n}',
  'model.session': '세션 {n}',
  'model.offHours': '시간 외',
  'model.break': '쉬는 시간',
  'model.movedOff': '시간 외 (직접 옮김)',

  // ── cli ──
  'cli.usage': '사용법: node cli.js export [YYYY-MM-DD] [--repo <실습 저장소>] [--settings <settings.json>]',
  'cli.badDate': '날짜 형식이 아님: {date}',
  'cli.notRepo': 'git 저장소가 아님: {repo}'
};

// 한 번에 치환한다(넣은 값 안의 {x}를 다시 치환하지 않음). \w는 ASCII만 잡으므로 {날짜} 같은 한글 자리표시는 남는다
function t(key, vars) {
  const s = Object.prototype.hasOwnProperty.call(ko, key) ? ko[key] : key;
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m));
}

function dict(prefix) {
  const out = {};
  for (const k of Object.keys(ko)) if (k.startsWith(prefix)) out[k] = ko[k];
  return out;
}

module.exports = { t, dict, ko };
