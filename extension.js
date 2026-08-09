// 수업 리플레이 (Lesson Replay) — 라이브 코딩 수업 자동 기록 + 하루 복기 스토리 뷰
// 기록기(디바운스 커밋·실패 표면화)=lib/recorder.js, 사이드바=lib/daysTree.js, 복기 뷰=lib/storyHtml.js
// 기록 on/off는 기기별(globalState, repo 경로 키) — 설정 파일로 저장소에 전파되지 않는다
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { git, isRepo, commitsForDate, recentDays, sceneDiff, showFile, attachSceneSigs } = require('./lib/git');
const { buildDay } = require('./lib/model');
const { render } = require('./lib/storyHtml');
const { buildExportMd } = require('./lib/exportMd');
const { createRecorder } = require('./lib/recorder');
const { createDaysProvider } = require('./lib/daysTree');
const notes = require('./lib/notes');
const reviewData = require('./lib/reviewData');
const { createGuards } = require('./lib/guards');

let statusItem, panel, treeProvider, out, extCtx, recorder, guards;
let repoTop = null, repoIsGit = false;

async function resolveRepo() {
  const f = vscode.workspace.workspaceFolders;
  if (!f || !f.length) { repoTop = null; repoIsGit = false; }
  else {
    const r = await git(f[0].uri.fsPath, ['rev-parse', '--show-toplevel']);
    if (r.ok && r.out.trim()) { repoTop = r.out.trim(); repoIsGit = true; }
    else { repoTop = f[0].uri.fsPath; repoIsGit = false; }
  }
  updateStatusBar();
  if (treeProvider) treeProvider.refresh();
}
function repoRoot() { return repoTop; }

function cfg() {
  const c = vscode.workspace.getConfiguration('lessonReplay');
  return {
    commitDelaySeconds: c.get('commitDelaySeconds'), blocks: c.get('blocks'),
    notesDir: c.get('notesDir'),
    noiseThreshold: c.get('noiseThreshold'), excludePrefixes: c.get('excludePrefixes'),
    holidays: c.get('holidays') || [], archiveDir: (c.get('archiveDir') || '').trim(),
    tilPrompt: c.get('tilPrompt') || '', paragraphGapMinutes: c.get('paragraphGapMinutes')
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
function archiveRoot() {
  const a = cfg().archiveDir;
  if (a) {
    try { fs.mkdirSync(a, { recursive: true }); return a; } catch { /* 잘못된 경로 → repo로 폴백 */ }
  }
  return repoRoot();
}

function prepareNotes() {
  if (!repoRoot() || !isRecording()) return;
  notes.ensureScaffold(archiveRoot(), cfg());
  notes.primeShadow(archiveRoot(), cfg().notesDir);
}

function updateStatusBar() {
  if (!statusItem) return;
  if (!repoTop) { statusItem.hide(); return; }
  if (recorder && recorder.state.failed && isRecording()) { statusItem.show(); return; } // 실패 표시 유지
  if (isRecording() && !repoIsGit) {
    statusItem.text = '$(warning) 기록 불가 — git 저장소 아님';
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
// 복기노트: 첫 열람 때 타임라인 md에서 시드 → 이후 날짜별 JSON이 단일원천
function loadReviewNotes(date) {
  const c = cfg();
  let timelineText = '';
  try { timelineText = fs.readFileSync(notes.timelinePath(archiveRoot(), c.notesDir, date), 'utf8'); }
  catch { /* 필기 없음 — 선택 사항 */ }
  return reviewData.loadNotes(archiveRoot(), c.notesDir, date, timelineText, c.paragraphGapMinutes);
}

async function buildModelFor(date, reviewNotes) {
  const repo = repoRoot();
  if (!repo || !(await isRepo(repo))) {
    vscode.window.showWarningMessage('열려 있는 폴더가 git 저장소가 아닙니다. 사이드바 "수업 리플레이"에서 저장소를 먼저 만들어 주세요.');
    return null;
  }
  const commits = await commitsForDate(repo, date);
  return buildDay({ date, commits, notes: reviewNotes || [], config: cfg() });
}

async function openStory(date) {
  const reviewNotes = loadReviewNotes(date);
  const model = await buildModelFor(date, reviewNotes);
  if (!model) return;
  await attachSceneSigs(repoRoot(), date, model.chapters); // 시그니처 일괄(git log -p 1회) — +n/−n은 numstat에서 이미 옴
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
    { notes: reviewNotes, accent: extCtx.globalState.get('accent') || '',
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
  } else if (msg.cmd === 'setAccent') {
    extCtx.globalState.update('accent', msg.accent || '');
  } else if (msg.cmd === 'toggleMark' && msg.key) {
    reviewData.toggleMark(archiveRoot(), cfg().notesDir, msg.date, msg.key);
    treeProvider.refresh(); // 사이드바 "다시 볼 것" 큐 갱신
  } else if (msg.cmd === 'openFile') {
    const p = path.isAbsolute(msg.path) ? msg.path : path.join(repo, msg.path);
    try {
      const doc = await vscode.workspace.openTextDocument(p);
      vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: true });
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

// TIL 원자재 내보내기: 프롬프트+배운 것+필기+코드 diff 한 파일 → 아카이브 '복기/날짜-복기.md'
async function exportDay(date) {
  date = date || notes.dateStr();
  const model = await buildModelFor(date, loadReviewNotes(date));
  if (!model) return;
  const repo = repoRoot();
  for (const ch of model.chapters) {
    for (const it of ch.items) {
      if (it.type === 'scene') it.diffText = await sceneDiff(repo, it.firstSha, it.lastSha, it.file);
    }
  }
  const md = buildExportMd(model, notes.loadSummaries(archiveRoot(), cfg().notesDir, date),
    { prompt: cfg().tilPrompt });
  const dir = path.join(archiveRoot(), '복기');
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, `${date}-복기.md`);
  fs.writeFileSync(p, md, 'utf8');
  const doc = await vscode.workspace.openTextDocument(p);
  vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });
}

// ---------- 명령 ----------
async function toggleRecord() {
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
  prepareNotes();
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
    '🎬 수업 리플레이: 저장(Ctrl+S)할 때마다 스냅샷을 남겨, 하루의 코드 흐름을 복기합니다. 개인 연습 저장소에서 기록을 켜 보세요.',
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

  recorder = createRecorder({ vscode, out, statusItem, repoRoot, isRecording, cfg, timeStr: notes.timeStr });
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
      const i = uri.path.indexOf('/', 1);
      return showFile(repoRoot(), uri.path.slice(1, i), uri.path.slice(i + 1));
    }
  }));

  await resolveRepo();
  context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(resolveRepo));
  migrateLegacySetting();
  firstRunWelcome();

  // 영업일 아침 필기 틀 — 기록이 켜진 폴더에서만, 시작 직후·10분마다 확인
  prepareNotes();
  const scaffoldTimer = setInterval(prepareNotes, 10 * 60 * 1000);
  context.subscriptions.push({ dispose: () => clearInterval(scaffoldTimer) });

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
  if (recorder) recorder.flushSync();
}

module.exports = { activate, deactivate };
