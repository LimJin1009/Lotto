import { useMemo, useState } from 'react';
import { useApp } from '../app-context';
import { Ball, BallRow, ballColor } from '../components/Ball';
import { formatDate } from '../lib/draws';
import { frequency, gaps } from '../lib/stats';

type Range = 'all' | 'recent';

export function StatsPage() {
  const { draws } = useApp();
  const [range, setRange] = useState<Range>('all');

  const scope = range === 'all' ? draws : draws.slice(-100);
  const freq = useMemo(() => frequency(scope), [scope]);
  const gap = useMemo(() => gaps(draws), [draws]);
  const nums = Array.from({ length: 45 }, (_, i) => i + 1);
  const max = Math.max(...nums.map((n) => freq[n]));
  const top = [...nums].sort((a, b) => freq[b] - freq[a]).slice(0, 6);
  const cold = [...nums].sort((a, b) => gap[b] - gap[a]).slice(0, 10);

  return (
    <div className="stack">
      <div className="page-head">
        <h1>📊 당첨번호 통계</h1>
        <p>
          1회({formatDate(draws[0].date)})부터 {draws.at(-1)!.no}회({formatDate(draws.at(-1)!.date)})까지의 기록이에요.
        </p>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>번호별 당첨 횟수</h2>
          <div className="seg" role="tablist">
            <button type="button" role="tab" aria-selected={range === 'all'} className={range === 'all' ? 'seg-on' : ''} onClick={() => setRange('all')}>
              전체
            </button>
            <button type="button" role="tab" aria-selected={range === 'recent'} className={range === 'recent' ? 'seg-on' : ''} onClick={() => setRange('recent')}>
              최근 100회
            </button>
          </div>
        </div>
        <div className="freq-chart" role="img" aria-label="번호별 당첨 횟수 막대그래프">
          {nums.map((n) => (
            <div key={n} className="freq-col" title={`${n}번: ${freq[n]}회`}>
              <span className="freq-val">{freq[n]}</span>
              <span className="freq-bar" style={{ height: `${(freq[n] / max) * 100}%`, background: ballColor(n) }} />
              <span className="freq-n">{n}</span>
            </div>
          ))}
        </div>
        <p className="muted-text">
          가장 많은 번호({freq[top[0]]}회)와 가장 적은 번호({Math.min(...nums.map((n) => freq[n]))}회)의 차이가 크지 않아요. 오래 보면 모든 번호가 비슷하게 나온다는 뜻이에요.
        </p>
        <div className="top-row">
          <span className="muted-text">가장 많이 나온 번호</span>
          <BallRow nums={top} size="sm" />
        </div>
      </section>

      <section className="card">
        <h2>오래 안 나온 번호</h2>
        <ul className="cold-list">
          {cold.map((n) => (
            <li key={n}>
              <Ball n={n} size="sm" />
              <span>{gap[n]}회째</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>최근 10회 당첨번호</h2>
        <ul className="recent-list">
          {draws
            .slice(-10)
            .reverse()
            .map((d) => (
              <li key={d.no}>
                <span className="recent-no">
                  {d.no}회<small>{formatDate(d.date)}</small>
                </span>
                <BallRow nums={d.nums} bonus={d.bonus} size="sm" />
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
