/** 동행복권과 같은 번호대별 색: 1~10 노랑, 11~20 파랑, 21~30 빨강, 31~40 회색, 41~45 초록 */
export function ballColor(n: number): string {
  if (n <= 10) return '#f5b800';
  if (n <= 20) return '#3fa9e0';
  if (n <= 30) return '#f0605d';
  if (n <= 40) return '#9a9fa8';
  return '#8fc23a';
}

interface Props {
  n: number;
  size?: 'sm' | 'md' | 'lg';
  dim?: boolean;
  hit?: boolean;
  pop?: number;
}

export function Ball({ n, size = 'md', dim, hit, pop }: Props) {
  return (
    <span
      className={`ball ball-${size}${dim ? ' ball-dim' : ''}${hit ? ' ball-hit' : ''}${pop !== undefined ? ' ball-pop' : ''}`}
      style={{ background: ballColor(n), animationDelay: pop !== undefined ? `${pop * 90}ms` : undefined }}
      aria-label={`${n}번`}
    >
      {n}
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
