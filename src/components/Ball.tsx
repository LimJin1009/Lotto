import type { CSSProperties } from 'react';

/** 공 한 개의 음영 3단: 빛 받는 쪽 / 기본 / 그림자 쪽 */
export interface BallPalette {
  light: string;
  base: string;
  dark: string;
}

/** 동행복권과 같은 번호대별 색: 1~10 노랑, 11~20 파랑, 21~30 빨강, 31~40 회색, 41~45 초록 */
export function ballPalette(n: number): BallPalette {
  if (n <= 10) return { light: '#ffe27a', base: '#f7b500', dark: '#a86f00' };
  if (n <= 20) return { light: '#9ad8ff', base: '#2b95e0', dark: '#0f4f8f' };
  if (n <= 30) return { light: '#ffa29a', base: '#ec4a45', dark: '#8f1c1f' };
  if (n <= 40) return { light: '#d9dde4', base: '#8d94a1', dark: '#454b57' };
  return { light: '#d4f28a', base: '#7cbc2c', dark: '#3c6b0d' };
}

export function ballColor(n: number): string {
  return ballPalette(n).base;
}

interface Props {
  n: number;
  size?: 'sm' | 'md' | 'lg';
  dim?: boolean;
  hit?: boolean;
  pop?: number;
}

export function Ball({ n, size = 'md', dim, hit, pop }: Props) {
  const p = ballPalette(n);
  const style = {
    '--b-light': p.light,
    '--b-base': p.base,
    '--b-dark': p.dark,
    animationDelay: pop !== undefined ? `${pop * 90}ms` : undefined,
  } as CSSProperties;
  return (
    <span
      className={`ball ball-${size}${dim ? ' ball-dim' : ''}${hit ? ' ball-hit' : ''}${pop !== undefined ? ' ball-pop' : ''}`}
      style={style}
      aria-label={`${n}번`}
    >
      <span className="ball-face">{n}</span>
    </span>
  );
}

export function BallRow({
  nums,
  bonus,
  size,
  hits,
  pop,
}: {
  nums: number[];
  bonus?: number;
  size?: Props['size'];
  hits?: number[];
  pop?: boolean;
}) {
  return (
    <div className="ball-row">
      {nums.map((n, i) => (
        <Ball key={n} n={n} size={size} hit={hits?.includes(n)} dim={hits && !hits.includes(n)} pop={pop ? i : undefined} />
      ))}
      {bonus !== undefined && (
        <>
          <span className="ball-plus">+</span>
          <Ball n={bonus} size={size} hit={hits?.includes(bonus)} dim={hits && !hits.includes(bonus)} pop={pop ? 6 : undefined} />
        </>
      )}
    </div>
  );
}
