// 복권 용지 QR 해석과 당첨금 조회
// QR 안의 주소 예: https://dhlottery.co.kr/qr.do?method=winQr&v=1248q243032353738m010203040506...
//   v = 회차 4자리 + (게임마다) 문자 1개 + 번호 6개 × 2자리
//   문자: q 자동, m 수동, s 반자동 (그 밖의 문자는 종류 표시 없이 보여줌)
//   맨 뒤에 붙는 일련번호 숫자는 쓰지 않는다.

export type GameType = '자동' | '수동' | '반자동' | '';

export interface TicketGame {
  label: string;
  type: GameType;
  nums: number[];
}

export interface Ticket {
  round: number;
  games: TicketGame[];
  source: 'qr' | 'manual';
}

const TYPE: Record<string, GameType> = { q: '자동', m: '수동', s: '반자동' };
const LABELS = ['A', 'B', 'C', 'D', 'E'];

function validNums(nums: number[]): boolean {
  return nums.length === 6 && new Set(nums).size === 6 && nums.every((n) => n >= 1 && n <= 45);
}

/** 로또 QR 글자에서 회차와 게임을 꺼낸다. 로또 QR이 아니면 null */
export function parseLottoQr(text: string): Ticket | null {
  const raw = text.trim();
  const v = raw.match(/[?&]v=([0-9a-zA-Z]+)/)?.[1] ?? (/^\d{4}[a-zA-Z]\d{12}/.test(raw) ? raw : null);
  if (!v) return null;
  const round = Number(v.slice(0, 4));
  if (!round) return null;
  const games: TicketGame[] = [];
  for (const m of v.slice(4).matchAll(/([a-zA-Z])(\d{12})/g)) {
    const nums = (m[2].match(/\d\d/g) ?? []).map(Number);
    if (!validNums(nums)) continue; // 빈 칸(00…)이나 잘못된 게임은 건너뜀
    games.push({ label: LABELS[games.length] ?? String(games.length + 1), type: TYPE[m[1].toLowerCase()] ?? '', nums: nums.sort((a, b) => a - b) });
    if (games.length === 5) break;
  }
  return games.length ? { round, games, source: 'qr' } : null;
}

export function manualTicket(round: number, nums: number[]): Ticket {
  return { round, games: [{ label: 'A', type: '', nums: [...nums].sort((a, b) => a - b) }], source: 'manual' };
}

// ── 당첨금 (회차별 1게임 기준, 세전) ──
const PRIZE_SOURCE = 'https://smok95.github.io/lotto/results';
const prizeCache = new Map<number, number[] | null>();

/** [1등, 2등, 3등, 4등, 5등] 1게임 당첨금. 못 받으면 null */
export async function fetchPrizes(round: number): Promise<number[] | null> {
  if (prizeCache.has(round)) return prizeCache.get(round)!;
  try {
    const res = await fetch(`${PRIZE_SOURCE}/${round}.json`);
    if (!res.ok) throw new Error(String(res.status));
    const d: { divisions?: { prize?: number }[] } = await res.json();
    const prizes = (d.divisions ?? []).map((x) => x.prize ?? 0);
    const out = prizes.length >= 5 ? prizes.slice(0, 5) : null;
    prizeCache.set(round, out);
    return out;
  } catch {
    return null;
  }
}

export function formatWon(n: number): string {
  if (n >= 100_000_000) {
    const eok = Math.floor(n / 100_000_000);
    const man = Math.floor((n % 100_000_000) / 10_000);
    return `${eok.toLocaleString()}억${man ? ` ${man.toLocaleString()}만` : ''}원`;
  }
  if (n >= 10_000) return `${Math.floor(n / 10_000).toLocaleString()}만${n % 10_000 ? ` ${(n % 10_000).toLocaleString()}` : ''}원`;
  return `${n.toLocaleString()}원`;
}

/** 등수별로 당첨금을 받는 곳 */
export const CLAIM_PLACE: Record<number, string> = {
  1: '농협은행 본점',
  2: '농협은행 지점',
  3: '농협은행 지점',
  4: '로또 판매점이나 농협은행 지점',
  5: '로또 판매점이나 농협은행 지점',
};
