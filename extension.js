// 수업 리플레이 (Lesson Replay) — 라이브 코딩 수업 자동 기록 + 하루 복기 스토리 뷰
// 기록기(디바운스 커밋·실패 표면화)=lib/recorder.js, 사이드바=lib/daysTree.js, 복기 뷰=lib/storyHtml.js
// 기록 on/off는 기기별(globalState, repo 경로 키) — 설정 파일로 저장소에 전파되지 않는다
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { git, isRepo, recentDays, sceneDiff, showFile, snapshotTarget, attachSceneSigs, firstChangedLine } = require('./lib/git');
const { render } = require('./lib/storyHtml');
const exportLib = require('./lib/exportDay');
const { createRecorder, isIgnoredWatchPath } = require('./lib/recorder');
const { createDaysProvider } = require('./lib/daysTree');
const notes = require('./lib/notes');
const reviewData = require('./lib/reviewData');
const { createGuards } = require('./lib/guards');
const { watchRepoTree } = require('./lib/repoWatch');

let statusItem, panel, treeProvider, out, extCtx, recorder, guards;
let repoTop = null, repoIsGit = false;
let repoWatcher = null; // 저장소 루트 직접 감시 (VS Code가 연 폴더와 무관)

async function resolveRepo() {
  const f = vscode.workspace.workspaceFolders;
  if (!f || !f.length) { repoTop = null; repoIsGit = false; }
  else {
    const r = await git(f[0].uri.fsPath, ['rev-parse', '--show-toplevel']);
    if (r.ok && r.out.trim()) { repoTop = r.out.trim(); repoIsGit = true; }
    else { repoTop = f[0].uri.fsPath; repoIsGit = false; }
  }
  restartRepoWatch();
  updateStatusBar();
  if (treeProvider) treeProvider.refresh();
}
function repoRoot() { return repoTop; }

// 저장소 루트를 직접 감시해 IntelliJ 등 외부 에디터의 저장도 스냅샷을 깨운다 — VS Code는 필기 폴더만
// 열어도 되므로 Java 프로젝트를 열어 생기는 언어서버 폭주를 피한다. watchRepoRoot=false로 끈다.
function restartRepoWatch() {
  if (repoWatcher) { repoWatcher.close(); repoWatcher = null; }
  if (!repoIsGit || !repoTop || !cfg().watchRepoRoot || !cfg().watchFileChanges) return;
  repoWatcher = watchRepoTree(repoTop, () => { if (recorder) recorder.scheduleCommit(); },
    (m) => { if (out) out.appendLine(m); });
}

// 필기 폴더 감시: IntelliJ 등에서 저장한 필기도 [HH:mm] 시각이 남게 한다(onDidSaveTextDocument는
// VS Code 저장만 온다). 폴더는 틀이 생긴 뒤에야 있으므로 10분 tick마다 다시 시도한다
let notesWatcher = null;
function ensureNotesWatch() {
  const root = repoTop ? archiveRoot() : null;
  const dir = root ? path.join(root, cfg().notesDir) : null;
  if (notesWatcher && notesWatcher.dir === dir) return;
  if (notesWatcher) { notesWatcher.close(); notesWatcher = null; }
  if (!dir || !fs.existsSync(dir)) return;
  notesWatcher = notes.watchNotesDir(dir, (p) => {
    if (repoRoot() && isRecording()) notes.trackFile(archiveRoot(), cfg().notesDir, p);
  }, (m) => { if (out) out.appendLine(m); });
}

function cfg() {
  const c = vscode.workspace.getConfiguration('lessonReplay');
  return {
    commitDelaySeconds: c.get('commitDelaySeconds'), blocks: c.get('blocks'),
    notesDir: c.get('notesDir'),
    noiseThreshold: c.get('noiseThreshold'), excludePrefixes: c.get('excludePrefixes'),
    holidays: c.get('holidays') || [], archiveDir: (c.get('archiveDir') || '').trim(),
    tilPrompt: c.get('tilPrompt') || '', includeTilPrompt: c.get('includeTilPrompt') === true,
    paragraphGapMinutes: c.get('paragraphGapMinutes'),
    watchFileChanges: c.get('watchFileChanges') !== false,
    watchRepoRoot: c.get('watchRepoRoot') !== false
  };
}

// 기록 on/off — 기기별 globalState (설정 파일 커밋으로 남에게 전파되는 사고 방지)
function recKey() { return `record:${repoTop || ''}`; }
function isRecording() { return !!repoTop && extCtx.globalState.get(recKey()) === true; }
async function setRecording(on) { await extCtx.globalState.update(recKey(), on); updateStatusBar(); }

// 구버전/커밋된 설정 호환: .vscode/settings.json의 autoRecord는 확인 후에만 반영
async function migrateLegacySetting() {
  if (!repoTop) return;
  const raw = vscode.workspace.getConfiguration('lessonReplay').get('autoRecord');
  if (raw === true && extCtx.globalState.get(recKey()) === undefined) {
    const pick = await vscode.window.showWarningMessage(
      '이 저장소의 설정 파일에 자동 기록이 켜져 있습니다(저장소에 담겨 배포된 설정일 수 있음). 이 컴퓨터에서도 기록을 켤까요?',
      '켜기', '끄기');
    await setRecording(pick === '켜기');
  }
}

// 필기·한 줄 정리가 쌓이는 곳: archiveDir 설정이 있으면 그 폴더, 없으면 실습 repo 루트
let warnedArchiveDir = false; // 폴백을 조용히 넘기지 않는다. 세션당 1회 알림
function archiveRoot() {
  const a = cfg().archiveDir;
  if (a) {
    try { fs.mkdirSync(a, { recursive: true }); return a; }
    catch {
      if (!warnedArchiveDir) {
        warnedArchiveDir = true;
        vscode.window.showWarningMessage(
          `아카이브 폴더를 쓸 수 없어 필기를 실습 저장소에 저장합니다: ${a}. 설정(lessonReplay.archiveDir)을 확인해 주세요.`);
      }
    }
  }
  return repoRoot();
}

function prepareNotes() {
  if (!repoRoot() || !isRecording()) return;
  notes.ensureScaffold(archiveRoot(), cfg());
  notes.primeShadow(archiveRoot(), cfg().notesDir);
}

// 기록 켜는 걸 잊고 수업을 시작하는 사고 방지 — 하루 1회, 아래 4조건이 모두 맞을 때만.
// ① 이 폴더에서 기록을 켜고 끈 이력이 있다(= 수업 폴더). 다뤄 본 적 없는 폴더에선 영원히 안 뜬다
// ② 지금 꺼져 있다  ③ 영업일  ④ 수업 시간대(첫 파트~마지막 파트)
function nudgeKey() { return `nudged:${repoTop || ''}`; }
async function maybeNudgeRecording() {
  if (!repoTop || isRecording()) return;
  if (extCtx.globalState.get(recKey()) === undefined) return;
  if (!notes.isBusinessDay(new Date(), cfg().holidays)) return;
  if (!notes.isClassHours(cfg().blocks)) return;
  const today = notes.dateStr();
  if (extCtx.globalState.get(nudgeKey()) === today) return;
  await extCtx.globalState.update(nudgeKey(), today); // 먼저 찍어 하루 1회 보장
  const pick = await vscode.window.showWarningMessage(
    '수업 리플레이: 수업 시간인데 기록이 꺼져 있습니다. 지금 켜면 이후 저장부터 스냅샷이 남습니다.',
    '기록 켜기', '오늘은 그만');
  if (pick === '기록 켜기') toggleRecord();
}

function updateStatusBar() {
  if (!statusItem) return;
  if (!repoTop) { statusItem.hide(); return; }
  if (recorder && recorder.state.failed && isRecording()) { statusItem.show(); return; } // 실패 표시 유지
  if (isRecording() && !repoIsGit) {
    statusItem.text = '$(warning) 기록 불가: git 저장소 아님';
    statusItem.tooltip = '이 폴더는 git 저장소가 아니라 스냅샷을 남길 수 없습니다. 클릭해서 안내를 보세요.';
    statusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  } else if (isRecording()) {
    statusItem.text = '$(record) 수업 기록중';
    statusItem.tooltip = '저장할 때마다 스냅샷이 남습니다. 클릭하면 끕니다.';
    statusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  } else {
    statusItem.text = '$(circle-slash) 수업 기록 꺼짐';
    statusItem.tooltip = '클릭하면 이 폴더의 자동 기록을 켭니다 (개인 연습 저장소 전용).';
    statusItem.backgroundColor = undefined;
  }
  statusItem.show();
}

// ---------- 복기 스토리 뷰 ----------
function loadReviewNotes(date) { return exportLib.loadReviewNotes(archiveRoot(), cfg(), date); }

async function requireRepo() {
  const repo = repoRoot();
  if (repo && (await isRepo(repo))) return repo;
  vscode.window.showWarningMessage('열려 있는 폴더가 git 저장소가 아닙니다. 사이드바 "수업 리플레이"에서 저장소를 먼저 만들어 주세요.');
  return null;
}

async function buildModelFor(date, reviewNotes) {
  const repo = await requireRepo();
  return repo ? exportLib.buildModel(repo, archiveRoot(), cfg(), date, reviewNotes) : null;
}

async function openStory(date) {
  const reviewNotes = loadReviewNotes(date);
  const model = await buildModelFor(date, reviewNotes);
  if (!model) return;
  await attachSceneSigs(repoRoot(), date, model.chapters); // 시그니처 일괄(git log -p 1회). +n/−n은 numstat에서 이미 옴
  const days = await recentDays(repoRoot(), 365);
  const i = days.indexOf(date);
  const nav = { prev: i >= 0 ? days[i + 1] : days[0], next: i > 0 ? days[i - 1] : null };
  if (!panel) {
    panel = vscode.window.createWebviewPanel('lessonReplay.story', '수업 복기',
      vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
    panel.onDidDispose(() => { panel = null; });
    panel.webview.onDidReceiveMessage(onWebviewMessage);
  }
  panel.title = `수업 복기 ${date}`;
  panel.webview.html = render(model, notes.loadSummaries(archiveRoot(), cfg().notesDir, date), nav,
    { notes: reviewNotes,
      marks: reviewData.loadMarks(archiveRoot(), cfg().notesDir, date) });
  panel.reveal();
}

async function onWebviewMessage(msg) {
  const repo = repoRoot();
  if (!repo) return;
  if (msg.cmd === 'saveSummary') {
    notes.saveSummary(archiveRoot(), cfg().notesDir, msg.date, msg.part, msg.text);
    if (panel) panel.webview.postMessage({ cmd: 'summarySaved', part: msg.part });
  } else if (msg.cmd === 'saveNotes') {
    reviewData.saveNotes(archiveRoot(), cfg().notesDir, msg.date, msg.notes || []);
  } else if (msg.cmd === 'toggleMark' && msg.key) {
    reviewData.toggleMark(archiveRoot(), cfg().notesDir, msg.date, msg.key);
    treeProvider.refresh(); // 사이드바 "다시 볼 것" 큐 갱신
  } else if (msg.cmd === 'setSceneOp' && msg.key) {
    reviewData.setSceneOp(archiveRoot(), cfg().notesDir, msg.date, msg.key, msg.op);
    await openStory(msg.date); // 배치가 바뀌므로 다시 그린다
    treeProvider.refresh();
  } else if (msg.cmd === 'clearSceneOps') {
    reviewData.clearSceneOps(archiveRoot(), cfg().notesDir, msg.date, msg.op);
    await openStory(msg.date);
    treeProvider.refresh();
  } else if (msg.cmd === 'openFile') {
    const p = path.isAbsolute(msg.path) ? msg.path : path.join(repo, msg.path);
    try {
      const doc = await vscode.workspace.openTextDocument(p);
      // 씬에서 열면 그 씬의 첫 변경 줄로 커서 — 파일 맨 위가 아니라 복기하던 위치가 보이게
      let selection;
      if (msg.scene && msg.scene.lastSha) {
        const s = msg.scene;
        const line = firstChangedLine(await sceneDiff(repo, s.reworkSha || s.firstSha, s.lastSha, s.file));
        if (line > 0) {
          const l = Math.min(line, doc.lineCount) - 1; // 이후 편집으로 줄이 줄었어도 범위 안으로
          selection = new vscode.Range(l, 0, l, 0);
        }
      }
      vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: true, selection });
    } catch {
      vscode.window.showWarningMessage(`파일을 찾을 수 없습니다: ${msg.path} (삭제됐거나 이름이 바뀐 파일일 수 있습니다)`);
    }
  } else if (msg.cmd === 'openSnapshot' && msg.sha) {
    // 그 시점의 파일 — 읽기 전용 가상 문서. 탭 이름에 시각을 박아 "옛날 판"임이 보이게
    const ext = path.extname(msg.path);
    const base = path.basename(msg.path, ext);
    const label = `${base}@${(msg.time || '').replace(':', '')}시점${ext}`;
    const uri = vscode.Uri.from({ scheme: 'lesson-replay', path: `/${msg.sha}/${label}`, query: msg.path });
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: true });
    } catch { /* 스냅샷에 없음 */ }
  } else if (msg.cmd === 'openDiff' && msg.scene) {
    // VS Code 기본 diff 편집기: 이 구간 직전 판 ↔ 구간 마지막 판(복기 화면 diff와 같은 범위)
    const s = msg.scene;
    const ext = path.extname(s.file);
    const base = path.basename(s.file, ext);
    const doc = (sha, tag) => vscode.Uri.from({ scheme: 'lesson-replay', path: `/${sha}/${base}@${tag}${ext}`, query: s.file });
    await vscode.commands.executeCommand('vscode.diff',
      doc(`${s.reworkSha || s.firstSha}^`, '이전'), doc(s.lastSha, (s.end || '').replace(':', '')),
      `${base}${ext} ${s.start}~${s.end} 변경`, { viewColumn: vscode.ViewColumn.Beside, preview: true });
  } else if (msg.cmd === 'openDay') {
    openStory(msg.date);
  } else if (msg.cmd === 'export') {
    exportDay(msg.date);
  } else if (msg.cmd === 'getDiff' && msg.scene) {
    // ♻️ 씬의 기본 diff = 지우기 직전 판 → 새 판 비교 (제품의 1등 순간을 1클릭에)
    const s = msg.scene;
    const text = await sceneDiff(repo, s.reworkSha || s.firstSha, s.lastSha, s.file);
    if (panel) panel.webview.postMessage({ cmd: 'diff', idx: msg.idx, text });
  }
}

// TIL 원자재 내보내기: 배운 것+필기+코드 diff 한 파일 → 아카이브 '복기/날짜-복기.md'
// AI 프롬프트는 기본 미포함. 설정 includeTilPrompt를 켠 사람만 맨 위에 담긴다
async function exportDay(date) {
  date = date || notes.dateStr();
  const repo = await requireRepo();
  if (!repo) return;
  const p = await exportLib.exportDayToFile(repo, archiveRoot(), cfg(), date);
  const doc = await vscode.workspace.openTextDocument(p);
  vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });
}

// ---------- 명령 ----------
// 연타 방지(B1): 켜는 동안의 재진입이 recoverPending을 겹쳐 돌려 index.lock 충돌을 스스로 만들었다(09-09)
let toggling = false;
async function toggleRecord() {
  if (toggling) { vscode.window.setStatusBarMessage('수업 리플레이: 기록 상태를 바꾸는 중입니다', 3000); return; }
  toggling = true;
  try { await toggleRecordInner(); } finally { toggling = false; }
}

async function toggleRecordInner() {
  if (!repoTop) { vscode.window.showWarningMessage('수업 실습 폴더를 먼저 열어 주세요.'); return; }
  if (isRecording()) { await setRecording(false); return; }
  if (!repoIsGit) {
    const x = await vscode.window.showWarningMessage(
      '이 폴더는 아직 git 저장소가 아닙니다. 저장소를 만들면 바로 기록할 수 있습니다 (기록은 전부 이 폴더 안에만 남습니다).',
      'git 저장소 만들기', '취소');
    if (x !== 'git 저장소 만들기') return;
    await initRepo();
    if (!repoIsGit) return;
  }
  if (!(await guards.confirmRemoteOk(repoTop))) return;
  const ok = await vscode.window.showWarningMessage(
    '이 폴더에서 저장할 때마다 자동 git 커밋을 남깁니다. 개인 연습 저장소에서만 켜세요 (팀 과제·제출용 저장소 금지).',
    '켜기', '취소');
  if (ok !== '켜기') return;
  await setRecording(true);
  // 기록을 켜기 전에 쌓여 있던 변경을 먼저 회수한다. 안 그러면 어제 마지막 수정이
  // 오늘 첫 필기 저장에 휩쓸려 "오늘 짠 코드"로 둔갑한다 (복구 커밋은 라벨로 구분됨).
  // 수 초~수십 초 걸릴 수 있어 진행 표시를 띄운다(B2). 실패하면 꺼짐으로 되돌린다(B3)
  const r = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: '수업 리플레이: 기록 켜는 중' },
    () => recorder.recoverPending(true));
  if (!r.ok) {
    await setRecording(false);
    const pick = await vscode.window.showErrorMessage(
      `수업 리플레이: 기록을 켜지 못했습니다. ${r.why.label}`, '다시 시도', '로그 보기');
    if (pick === '로그 보기') out.show();
    if (pick === '다시 시도') setTimeout(toggleRecord, 0);
    return;
  }
  prepareNotes();
  ensureNotesWatch();
  treeProvider.refresh();
}

async function initRepo() {
  const f = vscode.workspace.workspaceFolders;
  if (!f || !f.length) return;
  const r = await git(f[0].uri.fsPath, ['init']);
  if (!r.ok) { vscode.window.showErrorMessage(`git init 실패: ${r.err}`); return; }
  await resolveRepo();
  vscode.window.showInformationMessage('git 저장소를 만들었습니다. 이제 기록을 켤 수 있습니다.');
}

function firstRunWelcome() {
  if (!repoTop || extCtx.globalState.get('welcomed')) return;
  extCtx.globalState.update('welcomed', true);
  vscode.window.showInformationMessage(
    '수업 리플레이: 저장(Ctrl+S)할 때마다 스냅샷을 남겨, 하루의 코드 흐름을 복기합니다. 개인 연습 저장소에서 기록을 켜 보세요.',
    '기록 켜기', '나중에').then(x => { if (x === '기록 켜기') toggleRecord(); });
}

// ---------- activate ----------
async function activate(context) {
  extCtx = context;
  out = vscode.window.createOutputChannel('수업 리플레이');
  context.subscriptions.push(out);

  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 90);
  statusItem.command = 'lessonReplay.toggleRecord';
  context.subscriptions.push(statusItem);

  recorder = createRecorder({ vscode, out, statusItem, repoRoot, isRecording, cfg, timeStr: notes.timeStr,
    onCommitted: () => { if (treeProvider) treeProvider.refresh(); } });
  guards = createGuards({ vscode, out, globalState: context.globalState });
  treeProvider = createDaysProvider({
    vscode, cfg, buildModelFor, recentDays,
    repoState: () => ({ repoTop, repoIsGit }),
    loadMarks: (date) => reviewData.loadMarks(archiveRoot(), cfg().notesDir, date)
  });
  context.subscriptions.push(vscode.window.registerTreeDataProvider('lessonReplay.days', treeProvider));

  // "그 시점의 파일" 가상 문서: lesson-replay:/<sha>/<path> → 해당 커밋의 파일 내용(읽기 전용)
  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('lesson-replay', {
    provideTextDocumentContent: (uri) => {
      const t = snapshotTarget(uri.path, uri.query);
      return showFile(repoRoot(), t.sha, t.file);
    }
  }));

  await resolveRepo();
  context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(resolveRepo));
  migrateLegacySetting();
  firstRunWelcome();

  // 조용한 중단(업데이트·크래시) 사이에 쌓인 변경 회수 — 켜지자마자 1회
  recorder.recoverPending();

  // 영업일 아침 필기 틀 + 기록 꺼짐 알림 — 시작 직후·10분마다 확인
  const tick = () => { prepareNotes(); ensureNotesWatch(); maybeNudgeRecording(); };
  tick();
  const scaffoldTimer = setInterval(tick, 10 * 60 * 1000);
  context.subscriptions.push({ dispose: () => clearInterval(scaffoldTimer) });

  // 편집기 밖에서 바뀐 파일도 스냅샷 대상 — DB 툴(Workbench 등)·외부 에디터·터미널로 고친 파일은
  // onDidSaveTextDocument가 오지 않아 통째로 누락됐다(SQL 실습에서 실제 발생). 커밋 자체는 기존과
  // 동일하게 add -A 한 번이고, 여기서는 디바운스 타이머만 깨운다.
  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
  const onFsEvent = (uri) => {
    if (!cfg().watchFileChanges) return;
    if (isIgnoredWatchPath(uri.fsPath)) return;
    recorder.scheduleCommit(); // 기록 꺼짐·repo 아님은 scheduleCommit 안에서 걸러진다
  };
  context.subscriptions.push(watcher,
    watcher.onDidCreate(onFsEvent), watcher.onDidChange(onFsEvent), watcher.onDidDelete(onFsEvent));

  context.subscriptions.push(
    vscode.commands.registerCommand('lessonReplay.openStory', (d) => openStory(d || notes.dateStr())),
    vscode.commands.registerCommand('lessonReplay.openStoryForDate', async () => {
      if (!repoTop) return;
      const days = await recentDays(repoTop, 365);
      const pick = await vscode.window.showQuickPick(days, { placeHolder: '복기할 날짜' });
      if (pick) openStory(pick);
    }),
    vscode.commands.registerCommand('lessonReplay.exportDay', (d) => exportDay(d)),
    vscode.commands.registerCommand('lessonReplay.openNotes', async () => {
      if (!repoTop) { vscode.window.showWarningMessage('수업 실습 폴더를 먼저 열어 주세요.'); return; }
      const p = notes.ensureScaffold(archiveRoot(), cfg(), true); // 직접 요청 = 주말에도 생성
      notes.primeShadow(archiveRoot(), cfg().notesDir);
      const doc = await vscode.workspace.openTextDocument(p);
      vscode.window.showTextDocument(doc);
    }),
    vscode.commands.registerCommand('lessonReplay.toggleRecord', toggleRecord),
    vscode.commands.registerCommand('lessonReplay.initRepo', initRepo),
    vscode.commands.registerCommand('lessonReplay.setArchiveDir', async () => {
      const pick = await vscode.window.showOpenDialog({
        canSelectFiles: false, canSelectFolders: true, canSelectMany: false,
        openLabel: '이 폴더에 아카이브', title: '필기·한 줄 정리를 모아둘 폴더 선택'
      });
      if (!pick || !pick.length) return;
      await vscode.workspace.getConfiguration('lessonReplay')
        .update('archiveDir', pick[0].fsPath, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`아카이브 폴더 지정: ${pick[0].fsPath}`);
      treeProvider.refresh();
    }),
    vscode.commands.registerCommand('lessonReplay.refreshDays', () => treeProvider.refresh()),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (repoRoot() && isRecording()) {
        notes.trackSave(archiveRoot(), cfg().notesDir, doc.uri.fsPath, doc.getText());
        if (repoIsGit) guards.warnIfNestedRepo(repoTop, doc.uri.fsPath); // 기록 갈라짐 방어
      }
      recorder.scheduleCommit();
    }),
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('lessonReplay')) updateStatusBar();
    })
  );
}

function deactivate() {
  if (repoWatcher) { repoWatcher.close(); repoWatcher = null; }
  if (notesWatcher) { notesWatcher.close(); notesWatcher = null; }
  if (recorder) recorder.flushSync();
}

module.exports = { activate, deactivate };
