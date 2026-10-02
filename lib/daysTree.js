// daysTree.js: 사이드바 날짜 트리. 빈 상태는 viewsWelcome(package.json)이 안내를 담당
// 아이콘은 VS Code 기본 아이콘(codicon). 장식 이모지를 쓰지 않는다(v1.5.0)
// env: { vscode, repoState() -> {repoTop, repoIsGit}, cfg(), buildModelFor(date), recentDays(repo, n), loadMarks(date) }
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
      const noteItem = new vscode.TreeItem('오늘 필기', vscode.TreeItemCollapsibleState.None);
      noteItem.iconPath = new vscode.ThemeIcon('edit');
      noteItem.tooltip = '오늘 필기 열기 (없으면 새로 만듦)';
      noteItem.command = { command: 'lessonReplay.openNotes', title: '오늘 필기 열기' };
      const archiveItem = new vscode.TreeItem('아카이브 폴더', vscode.TreeItemCollapsibleState.None);
      archiveItem.iconPath = new vscode.ThemeIcon('archive');
      archiveItem.description = env.cfg().archiveDir || '미지정 (실습 폴더에 저장)';
      archiveItem.command = { command: 'lessonReplay.setArchiveDir', title: '아카이브 폴더 지정' };
      archiveItem.tooltip = '필기·한 줄 정리를 모아 둘 폴더 고르기';
      return [noteItem, archiveItem, ...days.map(d => {
        const dow = new Date(`${d}T12:00:00`).getDay();
        const weekend = dow === 0 || dow === 6;
        const item = new vscode.TreeItem(d, vscode.TreeItemCollapsibleState.Collapsed);
        item.iconPath = new vscode.ThemeIcon('calendar');
        if (weekend) item.description = '주말';
        item.day = d;
        item.command = { command: 'lessonReplay.openStory', title: '복기 열기', arguments: [d] };
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
        item.tooltip = `다시 볼 것: ${p} (${start}). 클릭하면 복기 열기`;
        item.command = { command: 'lessonReplay.openStory', title: '복기 열기', arguments: [el.day] };
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
        item.command = { command: 'lessonReplay.openStory', title: '복기 열기', arguments: [day] };
        return item;
      });
    }
  }
  return new DaysProvider();
}

module.exports = { createDaysProvider };
