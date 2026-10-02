// exportMd.test.js: 2.0 ① 내보내기 구조 검증 (node --test)
// 맨 위 한 화면(사실 줄 · 한눈에 · 흐름 · 다시 볼 곳)만 읽어도 하루가 파악되고, diff는 부록으로 내려간다
const { test } = require('node:test');
const assert = require('node:assert');
const { buildDay } = require('../lib/model');
const { buildExportMd, diffPlan } = require('../lib/exportMd');

const CONFIG = { blocks: ['09:10-10:15', '10:30-11:30', '13:00-13:45'], noiseThreshold: 10, excludePrefixes: [] };
const c = (sha, time, files) => ({ sha, time, epoch: 0, msg: '', files });
const f = (path, status, add, del) => ({ path, status, oldPath: null, add, del });

function sampleDay() {
  return buildDay({
    date: '2026-09-15', config: CONFIG,
    notes: [{ id: 'n1', time: '10:34', text: 'prompt(openai -role)\njson(text)', seq: 634 }],
    commits: [
      c('a1', '09:20', [f('be/src/conf/application.yml', 'M', 7, 0)]),
      c('b1', '10:40', [f('be/src/openai/OpenAiService.java', 'A', 53, 7)]),
      c('b2', '10:55', [f('be/src/openai/OpenAiService.java', 'M', 18, 2)]),
      c('b3', '11:02', [f('be/src/openai/OpenAiService.java', 'M', 42, 26)]),
      c('b4', '11:10', [f('be/src/openai/OpenAiService.java', 'M', 19, 1)]),
      c('b5', '11:21', [f('be/src/openai/OpenAiController.java', 'A', 30, 2)])
    ]
  });
}

test('내보내기: 섹션 순서 = 제목 → 사실 줄 → 한눈에 → 흐름 → 다시 볼 곳 → 부록 A → 부록 B', () => {
  const md = buildExportMd(sampleDay(), {}, {});
  const order = ['# 2026-09-15 (화) 학습 기록', '## 한눈에', '## 흐름', '## 다시 볼 곳',
    '## 부록 A: 파일별 하루 변화', '## 부록 B: 시행착오 후보의 구간별 변화'].map(h => md.indexOf(h));
  assert.ok(order.every(i => i >= 0), JSON.stringify(order));
  assert.deepStrictEqual([...order].sort((a, b) => a - b), order);
});

test('내보내기: 사실 줄과 가장 많이 바뀐 곳', () => {
  const md = buildExportMd(sampleDay(), {}, {});
  assert.ok(md.includes('기록 09:20~11:21 · 파트 2 · 파일 3(새로 2 · 수정 1) · 필기 1'));
  assert.ok(md.includes('가장 많이 바뀐 곳: src/openai (파일 2 · +162 −38)'));
});

test('내보내기: 한눈에 표는 기록 있는 구간만, 기록 없는 파트는 한 줄로', () => {
  const md = buildExportMd(sampleDay(), {}, {});
  assert.ok(md.includes('| 파트2 | 10:30~11:30 | 1 | OpenAiService.java(새로, 4구간), OpenAiController.java(새로) |'));
  assert.ok(md.includes('기록 없음: 파트3'));
});

test('내보내기: 흐름에서 같은 파일 연속 구간은 한 줄, 필기는 한 줄로 이어 붙인다', () => {
  const md = buildExportMd(sampleDay(), { '파트2': '프롬프트 역할\nObjectMapper' }, {});
  assert.ok(md.includes('- 배운 것: 프롬프트 역할 / ObjectMapper'));
  assert.ok(md.includes('- 10:34 필기 · prompt(openai -role) / json(text)'));
  assert.ok(md.includes('- 10:40~11:10 OpenAiService.java 새로 만듦 4구간 +132 −36'));
});

test('내보내기: 4구간 이상 고친 파일은 시행착오 후보, 부록 B에 구간별 diff', () => {
  const model = sampleDay();
  const plan = diffPlan(model);
  assert.deepStrictEqual(plan.perFile.map(p => p.file).length, 3);
  assert.deepStrictEqual([...new Set(plan.trialScenes.map(s => s.file))], ['be/src/openai/OpenAiService.java']);
  const sceneDiffs = new Map(plan.trialScenes.map(s => [`${s.file}|${s.start}`, `@@ -1 +1 @@\n+${s.start}`]));
  const md = buildExportMd(model, {}, { sceneDiffs });
  assert.ok(md.includes('- 시행착오 후보: OpenAiService.java (4구간 고침)'));
  assert.ok(md.includes('#### 10:55 수정 +18 −2'));
  assert.ok(md.includes('+10:55'));
});

test('내보내기: 부록 A 경로는 한 번, git 헤더는 걸러지고 diff 예산(3000줄)을 넘지 않는다', () => {
  const model = buildDay({
    date: '2026-08-07', config: CONFIG, notes: [],
    commits: Array.from({ length: 16 }, (_, i) => c(`s${i}`, `09:${String(11 + i).padStart(2, '0')}`, [f(`src/f${i}.js`, 'M', 250, 0)]))
  });
  const fileDiffs = new Map(diffPlan(model).perFile.map(p =>
    [p.file, 'diff --git a/x b/x\nnew file mode 100644\n' + Array.from({ length: 250 }, (_, j) => `+line${j}`).join('\n')]));
  const md = buildExportMd(model, {}, { fileDiffs });
  assert.ok(!md.includes('diff --git') && !md.includes('new file mode'));
  assert.ok(md.includes('`src/f0.js` · JavaScript · 수정 · 1구간 · +250'));
  const diffLines = md.split('\n').filter(l => /^\+line/.test(l)).length;
  assert.ok(diffLines <= 3000, `diff ${diffLines}줄, 예산 초과`);
  assert.ok(md.includes('diff 4개를 생략했습니다'));
});

test('내보내기: 프롬프트 옵션, 자동 세션 단위 표기, 기록 없는 날', () => {
  const withPrompt = buildExportMd(sampleDay(), {}, { prompt: 'TIL 초안을 작성해줘' });
  assert.ok(withPrompt.includes('## TIL 작성 프롬프트') && withPrompt.includes('> TIL 초안을 작성해줘'));
  const sessions = buildDay({ date: '2026-10-05', config: { ...CONFIG, blocks: [] }, notes: [],
    commits: [c('x', '20:10', [f('a.py', 'A', 3, 0)])] });
  assert.ok(buildExportMd(sessions, {}, {}).includes('· 세션 1 ·'));
  const empty = buildExportMd(buildDay({ date: '2026-10-05', config: CONFIG, notes: [], commits: [] }), {}, {});
  assert.ok(empty.includes('기록 없음 · 파트 0 · 파일 0 · 필기 0'));
  assert.ok(!empty.includes('## 부록 A'));
});

test('내보내기: 흐름의 연속 필기는 한 줄로 묶고(외 N개), 전문은 부록 C에 줄바꿈까지 남긴다', () => {
  const long = 'x'.repeat(200);
  const model = buildDay({
    date: '2026-09-11', config: CONFIG,
    notes: [
      { id: 'a', time: '09:20', text: 'redis 개요\n인메모리', seq: 560 },
      { id: 'b', time: '09:22', text: long, seq: 562 },
      { id: 'c', time: '09:29', text: 'docker', seq: 569 }
    ],
    commits: [c('s', '09:40', [f('a.java', 'M', 1, 0)])]
  });
  const md = buildExportMd(model, {}, {});
  assert.ok(md.includes('- 09:20~09:29 필기 · redis 개요 / 인메모리 외 2개'));
  assert.ok(!md.split('## 부록')[0].includes(long), '흐름에는 긴 필기 전문이 없다');
  assert.ok(md.includes('## 부록 C: 필기 전문\n\n- 09:20 redis 개요\n  인메모리\n- 09:22 ' + long));
});

test('내보내기: 같은 분에 3개 이상 한꺼번에 저장한 파일은 「동시 저장」 한 줄, 2개면 그대로', () => {
  const model = buildDay({
    date: '2026-09-09', config: CONFIG, notes: [],
    commits: [
      c('x', '09:50', [f('a/BlogController.java', 'A', 73, 0), f('a/BlogService.java', 'M', 73, 64), f('a/BlogDTO.java', 'M', 11, 8)]),
      c('y', '10:05', [f('b/One.java', 'M', 1, 0), f('b/Two.java', 'M', 2, 0)])
    ]
  });
  const md = buildExportMd(model, {}, {});
  assert.ok(md.includes('- 09:50 동시 저장 파일 3개 · BlogService.java(수정), BlogController.java(새로 만듦) 외 1 · +157 −72'));
  assert.ok(md.includes('- 10:05 Two.java 수정 +2') && md.includes('- 10:05 One.java 수정 +1'));
});

test('내보내기: 새 프로젝트의 자동 생성·설정 파일은 diff 없이 한 줄, 순위에서도 빠진다', () => {
  const model = buildDay({
    date: '2026-10-02', config: CONFIG, notes: [],
    commits: [c('p', '09:20', [f('hw/mvnw', 'A', 302, 0), f('hw/mvnw.cmd', 'A', 196, 0), f('hw/.gitignore', 'A', 33, 0),
      f('hw/.mvn/wrapper/maven-wrapper.properties', 'A', 3, 0), f('hw/src/HelloApplication.java', 'A', 13, 0), f('hw/pom.xml', 'A', 55, 0)])]
  });
  const plan = diffPlan(model);
  assert.deepStrictEqual(plan.perFile.map(p => p.file), ['hw/src/HelloApplication.java', 'hw/pom.xml']); // diff를 가져오지도 않는다
  const md = buildExportMd(model, {}, { fileDiffs: new Map([['hw/src/HelloApplication.java', '+class Hello {}'], ['hw/pom.xml', '+<project/>']]) });
  assert.ok(md.includes('자동 생성·설정 파일(diff 생략): `hw/mvnw`, `hw/mvnw.cmd`, `hw/.gitignore`, `hw/.mvn/wrapper/maven-wrapper.properties`'));
  assert.ok(!md.includes('### mvnw'));
  assert.ok(md.includes('동시 저장 파일 6개 · pom.xml(새로 만듦), HelloApplication.java(새로 만듦) 외 4'));
  assert.ok(md.includes('가장 많이 바뀐 곳: hw (파일 1 · +55)')); // mvnw(+302)가 아니라 직접 쓴 파일 기준
  assert.ok(md.includes('언어: Java 1 · XML 1'));
});

test('내보내기: 새로 만든 파일 diff는 앞 60줄만, 나머지는 복기 화면 안내', () => {
  const model = buildDay({ date: '2026-10-02', config: CONFIG, notes: [], commits: [c('n', '09:20', [f('src/Big.java', 'A', 200, 0)])] });
  const raw = Array.from({ length: 200 }, (_, i) => `+line${i}`).join('\n');
  const md = buildExportMd(model, {}, { fileDiffs: new Map([['src/Big.java', raw]]) });
  assert.strictEqual(md.split('\n').filter(l => /^\+line/.test(l)).length, 60);
  assert.ok(md.includes('… (새 파일 200줄 중 앞 60줄. 전체는 복기 화면에서)'));
  assert.ok(md.includes('`src/Big.java` · Java · 새로 만듦'));
});
