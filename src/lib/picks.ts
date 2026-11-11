// 고정수·제외수: 어떤 방식으로 뽑든, 꼭 넣을 번호는 넣고 뺄 번호는 뺀다.
import { randomNumbers } from './random';
import type { GenResult } from './types';

export interface PickFilter {
  /** 꼭 넣을 번호 */
  fixed: number[];
  /** 뺄 번호 */
  excluded: number[];
}

export const MAX_FIXED = 5;
/** 제외수를 너무 많이 고르면 남는 번호가 거의 없어지므로 30개까지만 */
export const MAX_EXCLUDED = 30;
export const FIXED_REASON = '고정수로 넣은 번호';
export const REFILL_REASON = '제외수를 빼고 무작위로 채움';

const KEY = 'lotto.filter';
const valid = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 45;

function clean(f: Partial<PickFilter> | null): PickFilter {
  const fixed = [...new Set((f?.fixed ?? []).filter(valid))].slice(0, MAX_FIXED).sort((a, b) => a - b);
  const excluded = [...new Set((f?.excluded ?? []).filter(valid))]
    .filter((n) => !fixed.includes(n))
    .slice(0, MAX_EXCLUDED)
    .sort((a, b) => a - b);
  return { fixed, excluded };
}

export function loadFilter(): PickFilter {
  try {
    return clean(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return { fixed: [], excluded: [] };
  }
}

export function saveFilter(f: PickFilter): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(f));
  } catch {
    /* 저장 못 해도 이번엔 그대로 씀 */
  }
}

/** 번호 하나를 고정수(또는 제외수)로 켜고 끈다. 한 번호가 둘 다일 수는 없다. 꽉 찼으면 그대로 돌려준다 */
export function toggleFilter(f: PickFilter, kind: keyof PickFilter, n: number): PickFilter {
  const other = kind === 'fixed' ? 'excluded' : 'fixed';
  const max = kind === 'fixed' ? MAX_FIXED : MAX_EXCLUDED;
  if (f[kind].includes(n)) return { ...f, [kind]: f[kind].filter((x) => x !== n) };
  if (f[kind].length >= max) return f;
  return clean({ ...f, [kind]: [...f[kind], n], [other]: f[other].filter((x) => x !== n) });
}

const isFiller = (reason: string) => reason.includes('무작위') || reason.includes('채움');

/**
 * 만든 번호에 고정수·제외수를 입힌다.
 * 고정수를 먼저 넣고, 원래 번호 중 제외수가 아닌 것을 남기고(이유가 있는 번호 먼저), 모자라면 무작위로 채운다.
 */
export function applyFilter(r: GenResult, filter: PickFilter, fill: (count: number, exclude: number[]) => number[] = randomNumbers): GenResult {
  const { fixed, excluded } = clean(filter);
  if (fixed.length === 0 && excluded.length === 0) return r;

  const reasons: Record<number, string> = {};
  for (const n of fixed) reasons[n] = FIXED_REASON;
  const keep = r.numbers.filter((n) => !excluded.includes(n) && !fixed.includes(n));
  // 자리가 모자라면 "무작위로 채운 번호"부터 뺀다
  const ordered = [...keep.filter((n) => !isFiller(r.reasons[n] ?? '')), ...keep.filter((n) => isFiller(r.reasons[n] ?? ''))];
  for (const n of ordered.slice(0, 6 - fixed.length)) reasons[n] = r.reasons[n];

  const have = Object.keys(reasons).map(Number);
  for (const n of fill(6 - have.length, [...have, ...excluded])) reasons[n] = REFILL_REASON;
  const numbers = Object.keys(reasons)
    .map(Number)
    .sort((a, b) => a - b);
  return { ...r, numbers, reasons };
}
