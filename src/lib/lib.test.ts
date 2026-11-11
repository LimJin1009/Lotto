import { describe, expect, it } from 'vitest';
import { BUNDLED, currentRound, drawTime, rankOf } from './draws';
import { DREAMS, dreamNumbers } from './dream';
import { extractPicks, personalNumbers } from './personal';
import { gaps, isBalanced, statsNumbers } from './stats';
import type { GenResult } from './types';
import { C, R, BR, extractBall, makeWorld, stepWorld, tiltGravity } from './machine';

describe('추첨기', () => {
  it('휴대폰 기울기로 화면 속 아래 방향을 구한다', () => {
    const near = (g: { x: number; y: number } | null, x: number, y: number) => {
      expect(g).not.toBeNull();
      expect(g!.x).toBeCloseTo(x, 2);
      expect(g!.y).toBeCloseTo(y, 2);
    };
    near(tiltGravity(90, 0), 0, 1); // 똑바로 세움 → 아래
    near(tiltGravity(0, 60), 1, 0); // 눕혀서 오른쪽을 내림 → 오른쪽
    near(tiltGravity(0, -60), -1, 0); // 왼쪽을 내림 → 왼쪽
    near(tiltGravity(-60, 0), 0, -1); // 위쪽을 내림 → 위
    near(tiltGravity(90, 0, 90), 1, 0); // 가로 화면으로 돌림
    expect(tiltGravity(1, 1)).toBeNull(); // 거의 평평하면 모름
  });

  it('오른쪽으로 기울이면 공이 오른쪽에 쌓인다', () => {
    const w = makeWorld();
    w.tx = 1;
    w.ty = 0;
    let t = 0;
    for (let s = 0; s < 240; s++) stepWorld(w, (t += 1000 / 60));
    const avgX = w.balls.reduce((a, b) => a + b.x, 0) / w.balls.length;
    expect(avgX).toBeGreaterThan(C + R * 0.3);
    for (const b of w.balls) expect(Math.hypot(b.x - C, b.y - C)).toBeLessThan(R - BR + 1);
  });

  it('바람을 켜면 공이 통 전체로 날아다니고 밖으로 안 나간다', () => {
    const w = makeWorld();
    w.mixing = true;
    let t = 0;
    let topSum = 0;
    let speedSum = 0;
    for (let s = 0; s < 600; s++) {
      stepWorld(w, (t += 1000 / 60));
      if (s >= 120) {
        topSum += w.balls.filter((b) => b.y < C - R * 0.3).length;
        speedSum += w.balls.reduce((a, b) => a + Math.hypot(b.vx, b.vy), 0) / w.balls.length;
      }
      for (const b of w.balls) expect(Math.hypot(b.x - C, b.y - C)).toBeLessThan(R - BR + 1);
    }
    expect(topSum / 480).toBeGreaterThan(8); // 위쪽에도 평균 8개 넘게 떠 있음
    expect(speedSum / 480).toBeGreaterThan(3);
  });

  it('정해진 번호의 공이 출구로 빠져나간다', async () => {
    const w = makeWorld();
    w.mixing = true;
    let t = 0;
    for (let s = 0; s < 120; s++) stepWorld(w, (t += 1000 / 60));
    let done = false;
    const p = extractBall(w, 7, t).then(() => (done = true));
    let steps = 0;
    while (!done && steps < 200) {
      stepWorld(w, (t += 1000 / 60));
      steps++;
      await Promise.resolve();
    }
    await p;
    expect(steps).toBeLessThan(100); // 1.7초 안에 나옴
    expect(w.balls.find((b) => b.n === 7)).toBeUndefined();
    expect(w.balls).toHaveLength(44);
  });
});

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

import { charNumber, wishNumbers } from './wish';

describe('이름·소원 번호', () => {
  it('같은 문장은 같은 번호, 띄어쓰기는 무시', () => {
    const a = wishNumbers('올해 집 사자');
    expectValidSet(a);
    expect(wishNumbers('올해집사자!').numbers).toEqual(a.numbers);
    expect(wishNumbers('올해 차 사자').numbers).not.toEqual(a.numbers);
  });

  it('글자마다 숫자가 들어가고 이유가 붙는다', () => {
    const r = wishNumbers('집');
    expectValidSet(r);
    expect(r.numbers).toContain(charNumber('집'));
    expect(r.reasons[charNumber('집')]).toBe("'집' 글자에서 나온 숫자");
  });

  it('여러 게임: 게임마다 번호가 다르고, 같은 순서면 같은 번호', () => {
    const text = '우리 가족 모두 건강하고 행복하게';
    const sets = [0, 1, 2, 3, 4].map((g) => wishNumbers(text, g));
    sets.forEach(expectValidSet);
    expect(new Set(sets.map((s) => s.numbers.join(','))).size).toBeGreaterThan(1);
    expect(wishNumbers(text, 2).numbers).toEqual(sets[2].numbers);
    expect(wishNumbers(text, 0).numbers).toEqual(wishNumbers(text).numbers);
  });

  it('긴 문장도 6개만', () => {
    expectValidSet(wishNumbers('우리 가족 모두 건강하고 행복하게 해 주세요'));
  });
});
