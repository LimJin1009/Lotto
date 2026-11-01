export type MethodId = 'dream' | 'personal' | 'stats' | 'machine';

export const METHOD_LABEL: Record<MethodId, string> = {
  dream: '꿈 해몽',
  personal: '나만의 숫자',
  stats: '통계 분석',
  machine: '무작위 추첨',
};

/** 번호 생성 결과 한 세트 */
export interface GenResult {
  method: MethodId;
  /** 화면에 보일 제목. 예: "돼지꿈 · 돼지가 집에 들어옴" */
  title: string;
  emoji: string;
  /** 오름차순 6개 */
  numbers: number[];
  /** 번호마다 "왜 나왔는지" 설명 */
  reasons: Record<number, string>;
  /** 세트 전체에 대한 한 줄 설명 (해몽 풀이 등) */
  note?: string;
}

export interface Draw {
  no: number;
  /** YYYY-MM-DD (추첨일, 토요일) */
  date: string;
  /** 오름차순 6개 */
  nums: number[];
  bonus: number;
}

/** 내 번호함에 저장한 세트 */
export interface SavedSet extends GenResult {
  id: string;
  /** 이 번호로 응모할 회차 */
  drawNo: number;
  createdAt: string;
}

/** 여러 후보 숫자를 이유와 함께 모은 뒤, 모자란 만큼 무작위로 채워 6개를 만든다. */
export function finishSet(
  picks: { n: number; reason: string }[],
  fill: (count: number, exclude: number[]) => number[],
  fillReason = '무작위로 채움',
): Pick<GenResult, 'numbers' | 'reasons'> {
  const reasons: Record<number, string> = {};
  for (const p of picks) {
    if (Object.keys(reasons).length >= 6) break;
    if (p.n >= 1 && p.n <= 45 && !(p.n in reasons)) reasons[p.n] = p.reason;
  }
  const have = Object.keys(reasons).map(Number);
  for (const n of fill(6 - have.length, have)) reasons[n] = fillReason;
  const numbers = Object.keys(reasons).map(Number).sort((a, b) => a - b);
  return { numbers, reasons };
}
