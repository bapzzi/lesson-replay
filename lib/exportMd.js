// exportMd.js — 복기 하루치를 "AI에게 통째로 붙여넣는 TIL 원자재" md로 변환
// 구성: 파트별(배운 것 → 필기·씬 흐름 → 코드 diff). opts.prompt가 있을 때만(설정
// includeTilPrompt 켠 경우) 맨 위에 TIL 작성 프롬프트(lessonReplay.tilPrompt)를 얹는다
const ICON_LABEL = { '🟢': '새로 만듦', '🟡': '수정', '🔴': '삭제', '♻️': '지웠다 다시 만듦' };
const DIFF_MAX_LINES = 300;   // 씬 하나당 diff 상한
const TOTAL_DIFF_BUDGET = 3000; // 하루 전체 diff 상한 — AI 입력 한도를 넘는 원자재 방지

function cleanDiff(raw) {
  const lines = raw.split('\n')
    .filter(l => !/^(diff --git|index |--- |\+\+\+ |\\ No newline|new file mode|deleted file mode|old mode|new mode|similarity index|rename (from|to))/.test(l));
  if (lines.length > DIFF_MAX_LINES) {
    return [...lines.slice(0, DIFF_MAX_LINES), `… (긴 변경 — ${lines.length - DIFF_MAX_LINES}줄 생략)`];
  }
  return lines;
}

function buildExportMd(model, summaries, opts) {
  summaries = summaries || {};
  opts = opts || {};
  let diffSpent = 0, omitted = 0;
  const L = [];
  L.push(`# ${model.date} 수업 복기 — TIL 원자재`);
  L.push('');
  if (opts.prompt) {
    L.push('## 🤖 TIL 작성 프롬프트');
    L.push('');
    L.push('이 파일을 통째로 AI에게 붙여넣으세요. 아래가 요청 프롬프트입니다.');
    L.push('');
    for (const line of opts.prompt.split('\n')) L.push(`> ${line}`);
    L.push('');
  }

  for (const ch of model.chapters) {
    if (!ch.isPart && !ch.items.length) continue;
    L.push(`## ${ch.label} (${ch.range})`);
    L.push('');
    const sum = (summaries[ch.label] || '').trim();
    if (sum) {
      L.push('**배운 것**');
      L.push('');
      for (const line of sum.split('\n')) L.push(`> ${line}`);
      L.push('');
    }
    if (!ch.items.length) { L.push('- (기록 없음)'); L.push(''); continue; }
    for (const it of ch.items) {
      if (it.type === 'note') L.push(`- 📝 ${it.time ? it.time + ' ' : ''}${it.text.replace(/\n/g, '\n  ')}`);
      else if (it.type === 'noise') L.push(`- 🧹 ${it.time} 일괄 작업`);
      else {
        const range = it.start === it.end ? it.start : `${it.start}~${it.end}`;
        L.push(`- ${it.icon} ${range} \`${it.file}\` — ${ICON_LABEL[it.icon]}`);
        if (it.diffText && it.diffText.trim()) {
          const dls = cleanDiff(it.diffText);
          // 예산 검사는 "이 씬을 더하면 넘는가"로 — 마지막 씬이 상한을 초과 못 하게
          if (diffSpent + dls.length > TOTAL_DIFF_BUDGET) { omitted++; continue; }
          diffSpent += dls.length;
          L.push('');
          L.push('  ```diff');
          for (const dl of dls) L.push(`  ${dl}`);
          L.push('  ```');
          L.push('');
        }
      }
    }
    L.push('');
  }
  if (omitted) {
    L.push(`> ⚠ 원자재 크기 제한(diff ${TOTAL_DIFF_BUDGET}줄)으로 뒤쪽 씬 ${omitted}개의 diff는 생략했습니다 — 해당 파일은 복기 화면에서 직접 보세요.`);
    L.push('');
  }
  return L.join('\n');
}

module.exports = { buildExportMd };
