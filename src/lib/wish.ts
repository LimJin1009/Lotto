// 이름·소원 문장 번호: 글자마다 숫자로 바꾼다. 같은 문장은 언제나 같은 번호가 나온다.
import { finishSet, type GenResult } from './types';

/** 띄어쓰기·문장부호를 빼고 비교 (같은 뜻이면 같은 번호) */
export function normalizeWish(text: string): string {
  return text.replace(/[\s.,!?~·'"“”‘’()[\]-]/g, '');
}

/** 글자 하나 → 1~45 (유니코드 번호를 45로 나눈 나머지 + 1) */
export function charNumber(ch: string): number {
  return (ch.codePointAt(0)! % 45) + 1;
}

/** 문장으로 정해지는 난수 (같은 문장 → 같은 순서) */
function seeded(text: string): () => number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * game: 몇 번째 게임인지 (0부터). 0번째는 글자 순서대로, 그 뒤 게임은
 * 문장+게임 순서로 글자를 섞어 3개만 쓰고 나머지를 채운다. 같은 문장·같은 순서면 언제나 같은 번호.
 */
export function wishNumbers(text: string, game = 0): GenResult {
  const clean = normalizeWish(text);
  let picks: { n: number; reason: string }[] = [];
  for (const ch of clean) picks.push({ n: charNumber(ch), reason: `'${ch}' 글자에서 나온 숫자` });

  // 글자가 모자라거나 겹치면, 문장으로 정해지는 난수로 채움 (그래도 같은 문장이면 같은 번호)
  const rand = seeded(game > 0 ? `${clean}#${game}` : clean);
  if (game > 0) {
    const uniq = picks.filter((p, i) => picks.findIndex((q) => q.n === p.n) === i);
    for (let i = uniq.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [uniq[i], uniq[j]] = [uniq[j], uniq[i]];
    }
    picks = uniq.slice(0, 3);
  }
  const fill = (count: number, exclude: number[]) => {
    const pool = Array.from({ length: 45 }, (_, i) => i + 1).filter((n) => !exclude.includes(n));
    const out: number[] = [];
    while (out.length < count) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    return out;
  };

  const shown = text.trim().length > 18 ? `${text.trim().slice(0, 18)}…` : text.trim();
  return {
    method: 'wish',
    emoji: '✍️',
    title: `"${shown}"`,
    note: '글자마다 숫자로 바꿨어요. 같은 문장은 언제나 같은 번호가 나와요.',
    ...finishSet(picks, fill, '문장 전체에서 나온 숫자'),
  };
}
