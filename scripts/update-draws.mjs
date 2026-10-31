// 역대 당첨번호를 받아 src/data/draws.json 으로 저장한다.
// 출처: https://github.com/smok95/lotto (동행복권 결과를 모아 둔 공개 데이터)
// 사용법: npm run update-draws
import { writeFile } from 'node:fs/promises';

const SOURCE = 'https://smok95.github.io/lotto/results/all.json';

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`당첨번호를 받지 못했습니다: ${res.status}`);
const all = await res.json();

// [회차, 날짜, 번호1~6, 보너스] 형태로 줄여서 저장
const draws = all
  .map((d) => [d.draw_no, d.date.slice(0, 10), ...[...d.numbers].sort((a, b) => a - b), d.bonus_no])
  .sort((a, b) => a[0] - b[0]);

for (const [i, d] of draws.entries()) {
  if (d[0] !== i + 1) throw new Error(`${i + 1}회가 빠져 있습니다`);
}

const body = '[\n' + draws.map((d) => JSON.stringify(d)).join(',\n') + '\n]\n';
await writeFile(new URL('../src/data/draws.json', import.meta.url), body);
console.log(`저장 완료: 1회 ~ ${draws.length}회 (${draws.at(-1)[1]})`);
