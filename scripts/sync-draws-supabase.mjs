// 당첨번호(src/data/draws.json)를 후기 서버(Supabase draws 표)에 올린다.
// 후기 서버는 이 당첨번호로 등수를 직접 판정한다.
// GitHub 배포 작업이 매주 실행한다. 필요한 것:
//   - src/lib/config.ts 의 SUPABASE_URL
//   - 환경 변수 SUPABASE_SERVICE_KEY (GitHub 저장소 Settings → Secrets 에 넣은 service_role 키)
// 둘 중 하나라도 없으면 아무것도 하지 않고 넘어간다.
import { readFile } from 'node:fs/promises';

const config = await readFile(new URL('../src/lib/config.ts', import.meta.url), 'utf8');
const url = config.match(/SUPABASE_URL\s*=\s*'([^']*)'/)?.[1]?.replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.log('후기 서버 설정이 없어 당첨번호 올리기를 건너뜀');
  process.exit(0);
}

const draws = JSON.parse(await readFile(new URL('../src/data/draws.json', import.meta.url), 'utf8'));
const rows = draws.map(([no, date, n1, n2, n3, n4, n5, n6, bonus]) => ({ no, draw_date: date, nums: [n1, n2, n3, n4, n5, n6], bonus }));

for (let i = 0; i < rows.length; i += 500) {
  const res = await fetch(`${url}/rest/v1/draws?on_conflict=no`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows.slice(i, i + 500)),
  });
  if (!res.ok) throw new Error(`당첨번호를 올리지 못했어요: ${res.status} ${await res.text()}`);
}
console.log(`후기 서버에 당첨번호 ${rows.length}회차 올림 (최신 ${rows.at(-1).no}회)`);
