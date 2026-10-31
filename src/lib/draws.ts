import raw from '../data/draws.json';
import type { Draw } from './types';

const SOURCE = 'https://smok95.github.io/lotto/results';
const EXTRA_KEY = 'lotto.extraDraws.v1';
const WEEK = 7 * 24 * 60 * 60 * 1000;

type Row = [number, string, number, number, number, number, number, number, number];

function fromRow(r: Row): Draw {
  return { no: r[0], date: r[1], nums: r.slice(2, 8) as number[], bonus: r[8] };
}

export const BUNDLED: Draw[] = (raw as Row[]).map(fromRow);

interface RemoteDraw {
  draw_no: number;
  numbers: number[];
  bonus_no: number;
  date: string;
}

function fromRemote(d: RemoteDraw): Draw {
  return { no: d.draw_no, date: d.date.slice(0, 10), nums: [...d.numbers].sort((a, b) => a - b), bonus: d.bonus_no };
}

function readExtra(): Draw[] {
  try {
    const v = JSON.parse(localStorage.getItem(EXTRA_KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function writeExtra(draws: Draw[]) {
  try {
    localStorage.setItem(EXTRA_KEY, JSON.stringify(draws));
  } catch {
    /* 저장 못 해도 화면은 동작 */
  }
}

/** 앱 안 데이터 + 이전에 받아 둔 새 회차를 합친 목록 (회차 오름차순) */
export function localDraws(): Draw[] {
  const max = BUNDLED.at(-1)!.no;
  const extra = readExtra().filter((d) => d.no > max).sort((a, b) => a.no - b.no);
  const out = [...BUNDLED];
  for (const d of extra) if (d.no === out.at(-1)!.no + 1) out.push(d);
  return out;
}

/** 새 회차가 나왔는지 확인해서, 있으면 합친 목록을 돌려준다. 실패하면 null. */
export async function fetchNewDraws(current: Draw[]): Promise<Draw[] | null> {
  try {
    const latest = fromRemote(await (await fetch(`${SOURCE}/latest.json`, { cache: 'no-cache' })).json());
    const last = current.at(-1)!.no;
    if (latest.no <= last) return null;
    let fresh: Draw[];
    if (latest.no === last + 1) {
      fresh = [latest];
    } else {
      const all: RemoteDraw[] = await (await fetch(`${SOURCE}/all.json`)).json();
      fresh = all.map(fromRemote).filter((d) => d.no > last).sort((a, b) => a.no - b.no);
    }
    const merged = [...current];
    for (const d of fresh) if (d.no === merged.at(-1)!.no + 1) merged.push(d);
    writeExtra(merged.filter((d) => d.no > BUNDLED.at(-1)!.no));
    return merged;
  } catch {
    return null;
  }
}

// ── 회차·시간 계산 (한국 시간 기준) ──
// 추첨: 매주 토요일 20:35, 판매 마감: 토요일 20:00

/** 회차의 추첨 시각 (기준 회차에서 주 단위로 계산) */
export function drawTime(no: number, ref: Draw): Date {
  const base = new Date(`${ref.date}T20:35:00+09:00`).getTime();
  return new Date(base + (no - ref.no) * WEEK);
}

/** 지금 사면 응모되는 회차 (판매 마감 전인 가장 빠른 회차) */
export function currentRound(ref: Draw, now = new Date()): number {
  let no = ref.no + 1;
  const cutoff = (n: number) => drawTime(n, ref).getTime() - 35 * 60 * 1000;
  while (cutoff(no) <= now.getTime()) no++;
  return no;
}

/** 당첨 등수. 낙첨이면 0 */
export function rankOf(nums: number[], draw: Draw): number {
  const hit = nums.filter((n) => draw.nums.includes(n)).length;
  if (hit === 6) return 1;
  if (hit === 5) return nums.includes(draw.bonus) ? 2 : 3;
  if (hit === 4) return 4;
  if (hit === 3) return 5;
  return 0;
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${y}.${m}.${d}`;
}
