import { describe, expect, it } from 'vitest';
import { BUNDLED, currentRound, drawTime, rankOf } from './draws';
import { DREAMS, dreamNumbers } from './dream';
import { extractPicks, personalNumbers } from './personal';
import { gaps, isBalanced, statsNumbers } from './stats';
import type { GenResult } from './types';

function expectValidSet(r: GenResult) {
  expect(r.numbers).toHaveLength(6);
  expect(new Set(r.numbers).size).toBe(6);
  expect([...r.numbers].sort((a, b) => a - b)).toEqual(r.numbers);
  for (const n of r.numbers) {
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(45);
    expect(r.reasons[n]).toBeTruthy();
  }
  expect(Object.keys(r.reasons)).toHaveLength(6);
}

describe('당첨번호 데이터', () => {
  it('1회부터 빠짐없이 이어진다', () => {
    BUNDLED.forEach((d, i) => expect(d.no).toBe(i + 1));
    expect(BUNDLED[0].nums).toEqual([10, 23, 29, 33, 37, 40]);
  });

  it('등수 계산', () => {
    const d = { no: 1, date: '2002-12-07', nums: [1, 2, 3, 4, 5, 6], bonus: 7 };
    expect(rankOf([1, 2, 3, 4, 5, 6], d)).toBe(1);
    expect(rankOf([1, 2, 3, 4, 5, 7], d)).toBe(2);
    expect(rankOf([1, 2, 3, 4, 5, 9], d)).toBe(3);
    expect(rankOf([1, 2, 3, 4, 8, 9], d)).toBe(4);
    expect(rankOf([1, 2, 3, 7, 8, 9], d)).toBe(5);
    expect(rankOf([1, 2, 7, 8, 9, 10], d)).toBe(0);
  });

  it('회차 계산: 토요일 20시 판매 마감 기준', () => {
    const ref = { no: 1248, date: '2026-10-31', nums: [16, 18, 27, 36, 38, 42], bonus: 22 };
    expect(drawTime(1249, ref).toISOString()).toBe('2026-11-07T11:35:00.000Z');
    expect(currentRound(ref, new Date('2026-11-01T10:00:00+09:00'))).toBe(1249);
    expect(currentRound(ref, new Date('2026-11-07T19:59:00+09:00'))).toBe(1249);
    expect(currentRound(ref, new Date('2026-11-07T20:01:00+09:00'))).toBe(1250);
    // 데이터가 몇 주 늦어도 시간으로 계산
    expect(currentRound(ref, new Date('2026-11-20T12:00:00+09:00'))).toBe(1251);
  });
});

describe('꿈 해몽', () => {
  it('꿈 데이터가 올바르다', () => {
    expect(new Set(DREAMS.map((d) => d.id)).size).toBe(DREAMS.length);
    for (const d of DREAMS) {
      for (const n of [...d.nums, ...d.situations.map((s) => s.num)]) {
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(45);
      }
      for (const s of d.situations) expect(d.nums).not.toContain(s.num);
    }
  });

  it('상황 숫자와 상징 숫자가 꼭 들어간다', () => {
    const pig = DREAMS[0];
    const r = dreamNumbers(pig, pig.situations[0]);
    expectValidSet(r);
    for (const n of [...pig.nums, pig.situations[0].num]) expect(r.numbers).toContain(n);
  });
});

describe('나만의 숫자', () => {
  it('생일에서 날짜·달·연도를 뽑는다', () => {
    const p = extractPicks({ kind: 'birthday', value: '1990-05-17' }).map((x) => x.n);
    expect(p.slice(0, 4)).toEqual([17, 5, 45, 22]); // 90 → 45로 나눈 나머지 0 → 45
  });

  it('전화번호는 010을 빼고 두 자리씩', () => {
    const p = extractPicks({ kind: 'phone', value: '010-1234-5678' }).map((x) => x.n);
    expect(p).toEqual([12, 34, 11, 33, 36]); // 56→11, 78→33, 합 36
  });

  it('차량번호', () => {
    const p = extractPicks({ kind: 'car', value: '12가 3456' }).map((x) => x.n);
    expect(p).toEqual([34, 11, 12, 18]);
  });

  it('여러 입력을 섞어 6개를 만든다', () => {
    const r = personalNumbers([
      { kind: 'birthday', value: '1990-05-17' },
      { kind: 'car', value: '12가 3456' },
    ]);
    expectValidSet(r);
    for (const n of [17, 34, 5, 11]) expect(r.numbers).toContain(n);
  });
});

describe('통계 분석', () => {
  it('세 가지 전략 모두 올바른 세트를 만든다', () => {
    for (const s of ['hot', 'cold', 'balanced'] as const) {
      for (let i = 0; i < 30; i++) expectValidSet(statsNumbers(BUNDLED, s));
    }
  });

  it('균형 조합은 조건을 지킨다', () => {
    for (let i = 0; i < 50; i++) expect(isBalanced(statsNumbers(BUNDLED, 'balanced').numbers)).toBe(true);
  });

  it('미출현 기간: 지난 회차 번호는 0', () => {
    const g = gaps(BUNDLED);
    for (const n of BUNDLED.at(-1)!.nums) expect(g[n]).toBe(0);
  });
});
