// 통계 분석 번호와 통계 화면 계산
import { randomNumbers, weightedIndex } from './random';
import type { Draw, GenResult } from './types';

/** 번호별 당첨 횟수 (보너스 제외). index 1~45 사용 */
export function frequency(draws: Draw[]): number[] {
  const f = new Array(46).fill(0);
  for (const d of draws) for (const n of d.nums) f[n]++;
  return f;
}

/** 번호별로 마지막으로 나온 뒤 몇 회째 안 나왔는지. index 1~45 사용 */
export function gaps(draws: Draw[]): number[] {
  const last = draws.at(-1)!.no;
  const g = new Array(46).fill(draws.length);
  for (let i = draws.length - 1; i >= 0; i--) {
    for (const n of draws[i].nums) if (g[n] === draws.length) g[n] = last - draws[i].no;
  }
  return g;
}

function weightedPick(weights: number[], count: number): number[] {
  const w = [...weights];
  w[0] = 0;
  const out: number[] = [];
  while (out.length < count) {
    const i = weightedIndex(w);
    out.push(i);
    w[i] = 0;
  }
  return out.sort((a, b) => a - b);
}

export interface BalanceInfo {
  odd: number;
  sum: number;
  low: number;
  maxRun: number;
}

export function balanceOf(nums: number[]): BalanceInfo {
  const s = [...nums].sort((a, b) => a - b);
  let run = 1;
  let maxRun = 1;
  for (let i = 1; i < s.length; i++) {
    run = s[i] === s[i - 1] + 1 ? run + 1 : 1;
    maxRun = Math.max(maxRun, run);
  }
  return {
    odd: s.filter((n) => n % 2 === 1).length,
    sum: s.reduce((a, b) => a + b, 0),
    low: s.filter((n) => n <= 22).length,
    maxRun,
  };
}

/** 균형 조합 조건: 홀수 2~4개, 합계 100~175, 1~22 번호 2~4개, 3연속 없음 */
export function isBalanced(nums: number[]): boolean {
  const b = balanceOf(nums);
  return b.odd >= 2 && b.odd <= 4 && b.sum >= 100 && b.sum <= 175 && b.low >= 2 && b.low <= 4 && b.maxRun <= 2;
}

export type StatsStrategy = 'hot' | 'cold' | 'balanced';

export const STRATEGIES: { id: StatsStrategy; label: string; emoji: string; desc: string }[] = [
  { id: 'hot', label: '많이 나온 번호', emoji: '🔥', desc: '최근 100회 동안 자주 나온 번호일수록 잘 뽑혀요' },
  { id: 'cold', label: '오래 안 나온 번호', emoji: '🧊', desc: '오랫동안 안 나온 번호일수록 잘 뽑혀요' },
  { id: 'balanced', label: '균형 조합', emoji: '⚖️', desc: '홀짝·크기·합계가 고르게 섞인 조합만 골라요' },
];

export function statsNumbers(draws: Draw[], strategy: StatsStrategy): GenResult {
  const reasons: Record<number, string> = {};
  let numbers: number[];
  let note: string;

  if (strategy === 'hot') {
    const recent = draws.slice(-100);
    const f = frequency(recent);
    numbers = weightedPick(f.map((c) => c * c), 6);
    for (const n of numbers) reasons[n] = `최근 100회 중 ${f[n]}번 나옴`;
    note = `${recent[0].no}회~${recent.at(-1)!.no}회 기록으로 계산했어요.`;
  } else if (strategy === 'cold') {
    const g = gaps(draws);
    numbers = weightedPick(g.map((v) => (v + 1) ** 1.5), 6);
    for (const n of numbers) reasons[n] = g[n] === 0 ? '지난 회차에 나옴' : `${g[n]}회째 안 나옴`;
    note = `${draws.at(-1)!.no}회까지의 기록으로 계산했어요.`;
  } else {
    const winners = new Set(draws.map((d) => d.nums.join(',')));
    do {
      numbers = randomNumbers(6).sort((a, b) => a - b);
    } while (!isBalanced(numbers) || winners.has(numbers.join(',')));
    const b = balanceOf(numbers);
    for (const n of numbers) reasons[n] = n % 2 ? '홀수' : '짝수';
    const share = Math.round((draws.filter((d) => isBalanced(d.nums)).length / draws.length) * 100);
    note = `홀 ${b.odd}·짝 ${6 - b.odd}, 합계 ${b.sum}. 역대 1등 번호의 ${share}%가 이 조건에 맞았어요.`;
  }

  const s = STRATEGIES.find((x) => x.id === strategy)!;
  return { method: 'stats', emoji: s.emoji, title: s.label, numbers, reasons, note };
}
