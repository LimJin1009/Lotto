// 내 번호함: 기기(브라우저)에 저장한다. 회원 기능은 2차에서 붙인다.
import { rankOf } from './draws';
import type { Draw, GenResult, SavedSet } from './types';

const KEY = 'lotto.saved.v1';
const LIMIT = 200;

export function loadSaved(): SavedSet[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function store(list: SavedSet[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, LIMIT)));
    return true;
  } catch {
    return false;
  }
}

export function addSaved(result: GenResult, drawNo: number): SavedSet[] {
  const item: SavedSet = {
    ...result,
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    drawNo,
    createdAt: new Date().toISOString(),
  };
  const list = [item, ...loadSaved()];
  store(list);
  return list;
}

export function removeSaved(id: string): SavedSet[] {
  const list = loadSaved().filter((s) => s.id !== id);
  store(list);
  return list;
}

export function isSameSet(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((n, i) => n === b[i]);
}

/** 내 번호 성적표: 저장한 번호를 당첨번호와 맞춰 본 기록 */
export interface Scoreboard {
  /** 저장한 게임 수 */
  total: number;
  /** 그중 추첨이 끝난 게임 수 */
  checked: number;
  /** 등수별 당첨 횟수 (1~5등) */
  wins: Record<number, number>;
  winCount: number;
  /** 가장 높은 등수 (없으면 0) */
  bestRank: number;
  /** 한 게임에서 가장 많이 맞은 개수 (보너스 번호 제외) */
  bestHits: number;
}

export function scoreboard(saved: SavedSet[], draws: Draw[]): Scoreboard {
  const byNo = new Map(draws.map((d) => [d.no, d]));
  const out: Scoreboard = { total: saved.length, checked: 0, wins: {}, winCount: 0, bestRank: 0, bestHits: 0 };
  for (const s of saved) {
    const draw = byNo.get(s.drawNo);
    if (!draw) continue;
    out.checked++;
    out.bestHits = Math.max(out.bestHits, s.numbers.filter((n) => draw.nums.includes(n)).length);
    const rank = rankOf(s.numbers, draw);
    if (rank > 0) {
      out.wins[rank] = (out.wins[rank] ?? 0) + 1;
      out.winCount++;
      if (!out.bestRank || rank < out.bestRank) out.bestRank = rank;
    }
  }
  return out;
}
