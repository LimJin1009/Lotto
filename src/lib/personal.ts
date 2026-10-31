// 나만의 숫자 번호: 생일·전화번호·차량번호 같은 숫자를 1~45로 바꾼다.
import { randomNumbers } from './random';
import { finishSet, type GenResult } from './types';

export type PersonalKind = 'birthday' | 'anniversary' | 'phone' | 'car' | 'custom';

export const PERSONAL_KINDS: { id: PersonalKind; label: string; emoji: string; placeholder: string }[] = [
  { id: 'birthday', label: '생일', emoji: '🎂', placeholder: '예: 1990-05-17' },
  { id: 'phone', label: '전화번호', emoji: '📱', placeholder: '예: 010-1234-5678' },
  { id: 'car', label: '차량번호', emoji: '🚗', placeholder: '예: 12가 3456' },
  { id: 'anniversary', label: '기념일', emoji: '💝', placeholder: '예: 2019-10-03' },
  { id: 'custom', label: '아무 숫자', emoji: '🔢', placeholder: '예: 집 호수 1203, 사번 등' },
];

export interface PersonalInput {
  kind: PersonalKind;
  value: string;
}

interface Pick {
  n: number;
  reason: string;
}

const digitsOf = (s: string) => s.replace(/\D/g, '');
const digitSum = (s: string) => [...s].reduce((a, c) => a + Number(c), 0);

/** 숫자를 1~45 안으로. 45를 넘으면 45로 나눈 나머지(0이면 45). 0이면 버림. */
function fit(v: number, reason: string): Pick | null {
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v <= 45) return { n: v, reason };
  return { n: v % 45 || 45, reason: `${reason} (${v} → 45로 나눈 나머지)` };
}

function pairs(d: string, label: string): Pick[] {
  const out: Pick[] = [];
  for (let i = 0; i + 1 < d.length; i += 2) {
    const p = fit(Number(d.slice(i, i + 2)), `${label} ${d.slice(i, i + 2)}`);
    if (p) out.push(p);
  }
  return out;
}

/** 입력 하나에서 후보 숫자를 이유와 함께 뽑는다 (앞쪽일수록 우선). */
export function extractPicks(input: PersonalInput): Pick[] {
  const { kind, value } = input;
  const label = PERSONAL_KINDS.find((k) => k.id === kind)!.label;
  const d = digitsOf(value);
  if (!d) return [];
  const out: (Pick | null)[] = [];

  if (kind === 'birthday' || kind === 'anniversary') {
    const m = value.match(/(\d{2,4})\D*(\d{1,2})\D*(\d{1,2})/);
    const [y, mo, da] = m ? [m[1], Number(m[2]), Number(m[3])] : [d.slice(0, 4), Number(d.slice(4, 6)), Number(d.slice(6, 8))];
    out.push(fit(da, `${label}의 날짜 ${da}일`));
    out.push(fit(mo, `${label}의 달 ${mo}월`));
    out.push(fit(Number(y.slice(-2)), `${label} 연도 끝 두 자리 ${y.slice(-2)}`));
    out.push(fit(mo + da, `${label}의 달+날 ${mo}+${da}`));
    out.push(fit(digitSum(d), `${label} 숫자를 모두 더한 값`));
  } else if (kind === 'phone') {
    const body = d.startsWith('010') ? d.slice(3) : d;
    const tail = body.slice(-8);
    out.push(...pairs(tail, `${label} 뒷부분`));
    out.push(fit(digitSum(tail), `${label} 뒷자리를 모두 더한 값`));
  } else if (kind === 'car') {
    const m = value.match(/(\d{2,3})\s*[가-힣]?\s*(\d{4})/);
    const front = m ? m[1] : d.slice(0, d.length - 4);
    const back = m ? m[2] : d.slice(-4);
    out.push(...pairs(back, `${label} 뒤 네 자리 중`));
    if (front) out.push(fit(Number(front), `${label} 앞 숫자 ${front}`));
    out.push(fit(digitSum(back), `${label} 뒤 네 자리를 모두 더한 값`));
  } else {
    out.push(...pairs(d, `${label}`));
    if (d.length % 2 === 1) out.push(fit(Number(d.at(-1)), `${label} 마지막 자리 ${d.at(-1)}`));
    out.push(fit(digitSum(d), `${label}를 모두 더한 값`));
  }
  return out.filter((p): p is Pick => p !== null);
}

/** 여러 입력에서 골고루 후보를 모아(최대 4개) 6개 세트를 만든다. */
export function personalNumbers(inputs: PersonalInput[]): GenResult {
  const lists = inputs.map(extractPicks).filter((l) => l.length > 0);
  const picks: Pick[] = [];
  const seen = new Set<number>();
  for (let round = 0; picks.length < 4 && lists.some((l) => l.length > round); round++) {
    for (const l of lists) {
      const p = l[round];
      if (p && !seen.has(p.n) && picks.length < 4) {
        picks.push(p);
        seen.add(p.n);
      }
    }
  }
  const used = inputs.filter((i) => digitsOf(i.value)).map((i) => PERSONAL_KINDS.find((k) => k.id === i.kind)!);
  return {
    method: 'personal',
    emoji: used[0]?.emoji ?? '🔢',
    title: `${used.map((k) => k.label).join(' + ')} 번호`,
    note: '내 숫자에서 나온 번호 최대 4개 + 나머지는 무작위',
    ...finishSet(picks, randomNumbers),
  };
}
