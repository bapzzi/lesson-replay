// git.js — git 실행·로그 파싱 (의존성 없음, child_process만 사용)
// 파싱은 전부 순수 함수(parse*)로 분리 — fixture 문자열로 단위 테스트한다
const cp = require('child_process');

function git(repo, args) {
  return new Promise((resolve) => {
    cp.execFile('git', ['-C', repo, '-c', 'core.quotepath=false', ...args],
      { maxBuffer: 64 * 1024 * 1024 },
      (err, stdout, stderr) => resolve({
        out: stdout || '',
        err: (stderr || '').trim() || (err ? String(err.message || err) : ''),
        ok: !err
      }));
  });
}

async function isRepo(repo) {
  const r = await git(repo, ['rev-parse', '--is-inside-work-tree']);
  return r.ok && r.out.trim() === 'true';
}

function dayRange(dateStr) {
  return [`--since=${dateStr} 00:00:00`, `--until=${dateStr} 23:59:59`];
}

// ── 순수 파서들 ──

// git log --pretty=@@@%H|%ct|%s --name-status 출력 → 커밋 배열
function parseNameStatusLog(out) {
  const commits = [];
  let cur = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('@@@')) {
      const [sha, ct, ...rest] = line.slice(3).split('|');
      const d = new Date(parseInt(ct, 10) * 1000);
      cur = {
        sha, epoch: parseInt(ct, 10), msg: rest.join('|'),
        time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        files: []
      };
      commits.push(cur);
    } else if (cur && line.includes('\t')) {
      const parts = line.split('\t');
      const st = parts[0][0];
      cur.files.push({
        status: st,
        path: parts[parts.length - 1].replace(/\\/g, '/'),
        oldPath: st === 'R' ? parts[1].replace(/\\/g, '/') : null
      });
    }
  }
  return commits;
}

// numstat의 rename 표기("old => new"·"{a => b}/c")를 새 이름으로 정규화 — name-status 경로와 매칭되게
function normalizeNumstatPath(p) {
  p = p.replace(/\{([^}]*) => ([^}]*)\}/g, (_, a, b) => b).replace(/\/\//g, '/');
  const i = p.indexOf(' => ');
  if (i >= 0) p = p.slice(i + 4);
  return p.replace(/\\/g, '/');
}

// git log --numstat --pretty=@@@%H 출력 → Map(sha → Map(path → {add,del}))
function parseNumstat(out) {
  const bySha = new Map();
  let cur = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('@@@')) { cur = new Map(); bySha.set(line.slice(3), cur); }
    else if (cur && line.includes('\t')) {
      const [a, d, ...rest] = line.split('\t');
      cur.set(normalizeNumstatPath(rest.join('\t')),
        { add: parseInt(a, 10) || 0, del: parseInt(d, 10) || 0 });
    }
  }
  return bySha;
}

// git log -p -U0 --pretty=@@@%H 출력 → Map(`sha|path` → 첫 변경 시그니처)
// 요약으로 쓸모없는 줄: Java·JS의 package/import, 어노테이션, 닫는 괄호, 주석.
// Java는 hunk 문맥과 첫 추가 줄이 거의 package·import라 그대로 쓰면 요약 줄이 전부 같아진다(09-15 실측)
const SIG_NOISE = /^(package|import)\s|^(@|}|\/\/|\/\*|\*)/;

function parseSignatures(out) {
  const sig = new Map();
  const fallback = new Map(); // 쓸 만한 줄이 끝내 없으면 첫 후보라도 남긴다
  let key = null, sha = null;
  const offer = (s) => {
    s = s.trim().slice(0, 60);
    if (!s) return;
    if (!fallback.has(key)) fallback.set(key, s);
    if (!SIG_NOISE.test(s)) sig.set(key, s);
  };
  for (const line of out.split('\n')) {
    if (line.startsWith('@@@')) { sha = line.slice(3); key = null; }
    else if (line.startsWith('diff --git')) {
      const m = line.match(/ b\/(.+)$/);
      key = m ? `${sha}|${m[1].replace(/"/g, '').replace(/\\/g, '/')}` : null;
    } else if (key && !sig.has(key)) {
      const h = line.match(/^@@[^@]*@@ (.+)$/); // hunk 헤더의 함수 문맥
      if (h) offer(h[1]);
      else if (line.startsWith('+') && !line.startsWith('+++'))
        offer(line.slice(1)); // 새 파일 등 문맥 없음 → 추가 줄
    }
  }
  for (const [k, s] of fallback) if (!sig.has(k)) sig.set(k, s);
  return sig;
}

// unified diff의 첫 변경 위치(새 파일 기준 줄 번호, 1부터). 문맥 줄을 세며 첫 +/− 줄을 찾는다
// — hunk 헤더의 +시작은 문맥 3줄 앞이라 그대로 쓰면 수정 지점보다 위에 선다. 변경 없으면 0
function firstChangedLine(diffText) {
  let ln = 0, inHunk = false;
  for (const l of (diffText || '').split('\n')) {
    const h = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (h) { ln = parseInt(h[1], 10); inHunk = true; continue; }
    if (!inHunk) continue;
    if (l.startsWith('+') && !l.startsWith('+++')) return ln;
    if (l.startsWith('-') && !l.startsWith('---')) return ln; // 삭제만 있으면 그 자리의 현재 줄
    if (l.startsWith('\\')) continue; // "\ No newline"
    ln++;
  }
  return 0;
}

// git log --pretty=%cs 출력 → 중복 제거된 날짜 목록(최신순, limit개)
function parseDaysList(out, limit) {
  const seen = [];
  for (const d of out.split('\n')) {
    if (d && !seen.includes(d)) { seen.push(d); if (seen.length >= limit) break; }
  }
  return seen;
}

// ── git 실행 래퍼들 ──

// 하루치 커밋 수집(프로세스 2회: name-status + numstat 병합)
// 사이드바(recentDays)와 같은 author 필터 — 클론 저장소에서 upstream 커밋이 복기에 섞이지 않게
async function commitsForDate(repo, dateStr) {
  const af = await authorFilter(repo);
  const r = await git(repo, ['log', '--reverse', '--pretty=format:@@@%H|%ct|%s',
    '--name-status', ...af, ...dayRange(dateStr)]);
  if (!r.ok) return [];
  const commits = parseNameStatusLog(r.out);
  const ns = await git(repo, ['log', '--numstat', '--pretty=format:@@@%H', ...af, ...dayRange(dateStr)]);
  if (ns.ok) {
    const bySha = parseNumstat(ns.out);
    for (const c of commits) {
      const m = bySha.get(c.sha);
      if (!m) continue;
      for (const f of c.files) {
        const st = m.get(f.path);
        if (st) { f.add = st.add; f.del = st.del; }
      }
    }
  }
  return commits;
}

// 내 커밋 필터 — 클론한 저장소에서 upstream 이력의 날짜가 사이드바를 오염시키지 않게
const authorCache = new Map(); // repo -> ['--author=email'] | []
async function authorFilter(repo) {
  if (authorCache.has(repo)) return authorCache.get(repo);
  const r = await git(repo, ['config', 'user.email']);
  const f = r.ok && r.out.trim() ? [`--author=${r.out.trim()}`] : [];
  authorCache.set(repo, f);
  return f;
}

// 커밋이 있는 최근 날짜 목록 (YYYY-MM-DD, 최신순)
// 커밋 수 상한 없음 — 상한을 두면 학기 후반에 초반 날짜가 조용히 사라진다
async function recentDays(repo, limit) {
  const r = await git(repo, ['log', '--pretty=%cs', ...(await authorFilter(repo))]);
  if (!r.ok) return [];
  return parseDaysList(r.out, limit);
}

// 특정 시점의 파일 내용 (없으면 빈 문자열 — 생성/삭제 diff의 빈 쪽)
async function showFile(repo, sha, path) {
  const r = await git(repo, ['show', `${sha}:${path}`]);
  return r.ok ? r.out : '';
}

// 씬 구간(firstSha 직전 → lastSha)의 unified diff. 첫 커밋이라 부모가 없으면 전문을 +로 합성
// lesson-replay: 가상 문서 주소 → { sha, file }. 경로 = /<sha>/<탭 이름>, 실제 파일 경로 = query.
// 탭 이름(예: App@1048시점.jsx)으로 git show를 하면 빈 문서가 나온다. query가 없을 때만 경로 뒤쪽을 쓴다(구버전 주소 호환)
function snapshotTarget(uriPath, uriQuery) {
  const i = uriPath.indexOf('/', 1);
  return { sha: uriPath.slice(1, i), file: uriQuery || uriPath.slice(i + 1) };
}

async function sceneDiff(repo, firstSha, lastSha, path) {
  const r = await git(repo, ['diff', '--no-color', `${firstSha}^`, lastSha, '--', path]);
  if (r.ok && r.out.trim()) return r.out;
  const full = await showFile(repo, lastSha, path);
  if (!full) return '';
  return full.split('\n').map(l => `+${l}`).join('\n');
}

// 하루치 첫 변경 시그니처 일괄 — 프로세스 1회. 삭제 patch는 시그니처에 불필요해 제외(-p 부하 완화)
async function daySignatures(repo, dateStr) {
  const r = await git(repo, ['log', '-p', '-U0', '--no-color', '--diff-filter=AM',
    '--pretty=format:@@@%H', ...(await authorFilter(repo)), ...dayRange(dateStr)]);
  return r.ok ? parseSignatures(r.out) : new Map();
}

// 씬에 시그니처 부착 (+n/−n은 model이 numstat에서 이미 누적)
async function attachSceneSigs(repo, dateStr, chapters) {
  const sigs = await daySignatures(repo, dateStr);
  for (const ch of chapters) {
    for (const it of ch.items) {
      if (it.type !== 'scene') continue;
      it.stat = it.stat || { add: 0, del: 0 };
      it.stat.sig = sigs.get(`${it.firstSha}|${it.file}`) || '';
    }
  }
}

module.exports = { git, isRepo, commitsForDate, recentDays, showFile, sceneDiff, snapshotTarget,
                   daySignatures, attachSceneSigs, firstChangedLine,
                   parseNameStatusLog, parseNumstat, normalizeNumstatPath,
                   parseSignatures, parseDaysList };
