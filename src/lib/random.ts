// 번호 뽑기에 쓰는 무작위 함수. 브라우저의 암호용 난수(crypto)를 쓴다.

export function randFloat(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

/** 0 이상 max 미만의 정수 */
export function randInt(max: number): number {
  return Math.floor(randFloat() * max);
}

/** 가중치에 비례해서 하나를 고른다. 반환값은 인덱스. */
export function weightedIndex(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return randInt(weights.length);
  let r = randFloat() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

/** 1~45 중에서 겹치지 않게 count개. exclude에 있는 번호는 빼고 고른다. */
export function randomNumbers(count: number, exclude: Iterable<number> = []): number[] {
  const pool: number[] = [];
  const skip = new Set(exclude);
  for (let n = 1; n <= 45; n++) if (!skip.has(n)) pool.push(n);
  const out: number[] = [];
  while (out.length < count && pool.length > 0) {
    out.push(pool.splice(randInt(pool.length), 1)[0]);
  }
  return out;
}
