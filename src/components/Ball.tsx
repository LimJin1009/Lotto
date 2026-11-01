import type { CSSProperties } from 'react';

import { ballPalette } from '../lib/ball-colors';

export { ballPalette, type BallPalette } from '../lib/ball-colors';

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
