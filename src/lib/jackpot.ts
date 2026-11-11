// 대박번호: 역대 1등 번호 가운데 6개 중 5개가 똑같았던 회차 쌍("쌍둥이 회차")에 나온 번호만 섞어서 뽑는다.
// 재미로 보는 번호다. 당첨 확률은 다른 번호와 같다.
import { weightedIndex } from './random';
import type { Draw, GenResult } from './types';

/** 6개 중 5개가 같았던 회차 쌍 (앞 회차, 뒤 회차) */
export function twinDraws(draws: Draw[]): [Draw, Draw][] {
  // 번호 6개를 비트로 바꿔 두면 겹친 개수를 빨리 셀 수 있다 (회차가 1,200개면 78만 쌍)
  const bits = draws.map((d) => d.nums.reduce((b, n) => b + 2 ** (n - 1), 0));
  const lo = bits.map((b) => b >>> 0);
  const hi = bits.map((b) => Math.floor(b / 2 ** 32));
  const ones = (x: number) => {
    let c = 0;
    for (; x; x &= x - 1) c++;
    return c;
  };
  const twins: [Draw, Draw][] = [];
  for (let i = 0; i < draws.length; i++) {
    for (let j = i + 1; j < draws.length; j++) {
      if (ones(lo[i] & lo[j]) + ones(hi[i] & hi[j]) === 5) twins.push([draws[i], draws[j]]);
    }
  }
  return twins;
}

export interface JackpotPool {
  /** 쌍둥이 회차 쌍의 수 */
  pairs: number;
  /** 쌍둥이 회차에 나온 번호 → 그 번호가 나온 회차들 */
  rounds: Map<number, number[]>;
}

let cache: { draws: Draw[]; pool: JackpotPool } | null = null;

export function jackpotPool(draws: Draw[]): JackpotPool {
  if (cache?.draws === draws) return cache.pool;
  const twins = twinDraws(draws);
  const rounds = new Map<number, number[]>();
  for (const d of new Set(twins.flat())) {
    for (const n of d.nums) rounds.set(n, [...(rounds.get(n) ?? []), d.no]);
  }
  const pool = { pairs: twins.length, rounds };
  cache = { draws, pool };
  return pool;
}

/** 대박번호는 한 번에 늘 10게임을 뽑는다 */
export const JACKPOT_GAMES = 10;

/** 쌍둥이 회차에 많이 나온 번호일수록 잘 뽑힌다 */
export function jackpotNumbers(draws: Draw[]): GenResult {
  const { pairs, rounds } = jackpotPool(draws);
  const left = [...rounds.entries()];
  const reasons: Record<number, string> = {};
  while (Object.keys(reasons).length < 6 && left.length > 0) {
    const [[n, at]] = left.splice(weightedIndex(left.map(([, r]) => r.length)), 1);
    reasons[n] = `5개가 겹쳤던 ${at.slice(0, 3).join('·')}회${at.length > 3 ? ` 등 ${at.length}번` : ''}에 나온 번호`;
  }
  const numbers = Object.keys(reasons)
    .map(Number)
    .sort((a, b) => a - b);
  return {
    method: 'jackpot',
    emoji: '💰',
    title: '대박번호',
    numbers,
    reasons,
    note: `역대 1등 번호 중 5개가 똑같았던 회차 ${pairs}쌍의 번호만 섞었어요. 재미로 보는 번호예요.`,
  };
}

const KEY = 'lotto.jackpot.open';
const EVENT = 'lotto:jackpot';

/** 응원하기를 눌러 대박번호를 열었는지 (이 기기에만 기억) */
export function isJackpotOpen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** 응원하기(카카오페이)를 누르면 부른다. 실제로 보냈는지는 확인하지 않는다 */
export function openJackpot(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* 저장 못 하면 이번에만 열림 */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function onJackpotOpen(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
