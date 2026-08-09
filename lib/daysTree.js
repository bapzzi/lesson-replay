// daysTree.js — 사이드바 날짜 트리. 빈 상태는 viewsWelcome(package.json)이 안내를 담당
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
      const noteItem = new vscode.TreeItem('✍️ 오늘 필기 (없으면 새로 만듦)', vscode.TreeItemCollapsibleState.None);
      noteItem.command = { command: 'lessonReplay.openNotes', title: '오늘 필기 열기' };
      const archiveItem = new vscode.TreeItem('📦 아카이브 폴더', vscode.TreeItemCollapsibleState.None);
      archiveItem.description = env.cfg().archiveDir || '미지정 (실습 폴더에 저장)';
      archiveItem.command = { command: 'lessonReplay.setArchiveDir', title: '아카이브 폴더 지정' };
      archiveItem.tooltip = '클릭해서 필기·한 줄 정리를 모아둘 폴더를 고릅니다.';
      return [noteItem, archiveItem, ...days.map(d => {
        const dow = new Date(`${d}T12:00:00`).getDay();
        const weekend = dow === 0 || dow === 6;
        const item = new vscode.TreeItem(`📅 ${d}${weekend ? ' (주말)' : ''}`, vscode.TreeItemCollapsibleState.Collapsed);
        item.day = d;
        item.command = { command: 'lessonReplay.openStory', title: '복기 열기', arguments: [d] };
        return item;
      })];
    }
    async dayChildren(el) {
      const model = await env.buildModelFor(el.day);
      if (!model) return [];
      // "다시 볼 것"으로 표시한 씬이 맨 위 — 복기 재방문 큐
      const marked = (env.loadMarks ? env.loadMarks(el.day) : []).map(k => {
        const [p, start] = k.split('|');
        const item = new vscode.TreeItem(`★ ${p.split('/').pop()} · ${start}`, vscode.TreeItemCollapsibleState.None);
        item.tooltip = `다시 볼 것: ${p} (${start}) — 클릭하면 복기를 엽니다`;
        item.command = { command: 'lessonReplay.openStory', title: '복기 열기', arguments: [el.day] };
        return item;
      });
      return marked.concat(await this.fileChildren(model, el.day));
    }
    async fileChildren(model, day) {
      return model.fileList.map(p => { // 전체 표시 — 조용한 상한 금지(트리는 스크롤로 감당)
        const item = new vscode.TreeItem(`● ${p.name}`, vscode.TreeItemCollapsibleState.None);
        item.tooltip = p.path;
        item.command = { command: 'lessonReplay.openStory', title: '복기 열기', arguments: [day] };
        return item;
      });
    }
  }
  return new DaysProvider();
}

module.exports = { createDaysProvider };
