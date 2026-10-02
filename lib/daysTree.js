// daysTree.js: 사이드바 날짜 트리. 빈 상태는 viewsWelcome(package.json)이 안내를 담당
// 아이콘은 VS Code 기본 아이콘(codicon). 장식 이모지를 쓰지 않는다(v1.5.0)
// env: { vscode, repoState() -> {repoTop, repoIsGit}, cfg(), buildModelFor(date), recentDays(repo, n), loadMarks(date) }
const { t } = require('./i18n');

function createDaysProvider(env) {
  const { vscode } = env;
  const setViewState = (s) => vscode.commands.executeCommand('setContext', 'lessonReplay.state', s);

  class DaysProvider {
    constructor() {
      this._onDidChange = new vscode.EventEmitter();
      this.onDidChangeTreeData = this._onDidChange.event;
    }
    refresh() { this._onDidChange.fire(); }
    getTreeItem(el) { return el; }
    async getChildren(el) {
      if (el) return this.dayChildren(el);
      const { repoTop, repoIsGit } = env.repoState();
      if (!repoTop) { setViewState('noFolder'); return []; }
      if (!repoIsGit) { setViewState('notRepo'); return []; }
      const days = await env.recentDays(repoTop, 365);
      if (!days.length) { setViewState('noCommits'); return []; }
      setViewState('ok');
      const noteItem = new vscode.TreeItem(t('tree.todayNote'), vscode.TreeItemCollapsibleState.None);
      noteItem.iconPath = new vscode.ThemeIcon('edit');
      noteItem.tooltip = t('tree.todayNoteTip');
      noteItem.command = { command: 'lessonReplay.openNotes', title: t('tree.openTodayNote') };
      noteItem.contextValue = 'todayNote'; // 줄 오른쪽 「필기 틀 편집」 버튼(package.json menus)
      const archiveItem = new vscode.TreeItem(t('tree.archive'), vscode.TreeItemCollapsibleState.None);
      archiveItem.iconPath = new vscode.ThemeIcon('archive');
      archiveItem.description = env.cfg().archiveDir || t('tree.archiveUnset');
      archiveItem.command = { command: 'lessonReplay.setArchiveDir', title: t('tree.setArchive') };
      archiveItem.tooltip = t('tree.archiveTip');
      return [noteItem, archiveItem, ...days.map(d => {
        const dow = new Date(`${d}T12:00:00`).getDay();
        const weekend = dow === 0 || dow === 6;
        const item = new vscode.TreeItem(d, vscode.TreeItemCollapsibleState.Collapsed);
        item.iconPath = new vscode.ThemeIcon('calendar');
        if (weekend) item.description = t('tree.weekend');
        item.day = d;
        item.command = { command: 'lessonReplay.openStory', title: t('tree.openStory'), arguments: [d] };
        return item;
      })];
    }
    async dayChildren(el) {
      const model = await env.buildModelFor(el.day);
      if (!model) return [];
      // "다시 볼 것"으로 표시한 씬이 맨 위: 복기 재방문 큐
      const marked = (env.loadMarks ? env.loadMarks(el.day) : []).map(k => {
        const [p, start] = k.split('|');
        const item = new vscode.TreeItem(`${p.split('/').pop()} · ${start}`, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('star-full');
        item.tooltip = t('tree.markedTip', { path: p, start });
        item.command = { command: 'lessonReplay.openStory', title: t('tree.openStory'), arguments: [el.day] };
        return item;
      });
      return marked.concat(await this.fileChildren(model, el.day));
    }
    async fileChildren(model, day) {
      const { repoTop } = env.repoState();
      return model.fileList.map(p => { // 전체 표시. 조용한 상한 금지(트리는 스크롤로 감당)
        const item = new vscode.TreeItem(p.name, vscode.TreeItemCollapsibleState.None);
        // resourceUri = 사용자의 파일 아이콘 테마 아이콘이 그대로 붙는다
        if (repoTop) item.resourceUri = vscode.Uri.file(`${repoTop}/${p.path}`);
        item.tooltip = p.path;
        item.command = { command: 'lessonReplay.openStory', title: t('tree.openStory'), arguments: [day] };
        return item;
      });
    }
  }
  return new DaysProvider();
}

module.exports = { createDaysProvider };
