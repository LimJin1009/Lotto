import { useEffect, useState } from 'react';
import { useApp } from '../app-context';
import { Ball } from '../components/Ball';
import { listReviews, PAGE_SIZE, reviewsEnabled, reviewStats, timeAgo, type RankFilter, type Review } from '../lib/reviews';

const FILTERS: { id: RankFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'top', label: '1~3등' },
  { id: 4, label: '4등' },
  { id: 5, label: '5등' },
];

function ReviewCard({ r }: { r: Review }) {
  const { draws } = useApp();
  const draw = draws.find((d) => d.no === r.round);
  const hits = draw ? [...draw.nums, ...(r.rank === 2 ? [draw.bonus] : [])] : undefined;
  return (
    <li className="review">
      <div className="review-top">
        <span className={`badge badge-rank badge-rank-${Math.min(r.rank, 4)}`}>🏆 {r.rank}등</span>
        <span className="review-meta">
          {r.round}회 · {r.game_label}게임{r.game_type ? `(${r.game_type})` : ''}
        </span>
        <span className="review-when">{timeAgo(r.created_at)}</span>
      </div>
      <div className="review-balls">
        {r.numbers.map((n) => (
          <Ball key={n} n={n} size="sm" hit={hits?.includes(n)} dim={hits && !hits.includes(n)} />
        ))}
      </div>
      {r.method && <p className="review-method">🎯 {r.method}</p>}
      <p className="review-body">{r.content}</p>
      <p className="review-nick">— {r.nickname} · QR 인증</p>
    </li>
  );
}

export function ReviewsPage() {
  const [filter, setFilter] = useState<RankFilter>('all');
  const [list, setList] = useState<Review[]>([]);
  const [stats, setStats] = useState<Record<number, number> | null>(null);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async (f: RankFilter, offset: number) => {
    setLoading(true);
    setError('');
    try {
      const rows = await listReviews(f, offset);
      setList((l) => (offset === 0 ? rows : [...l, ...rows]));
      setMore(rows.length === PAGE_SIZE);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!reviewsEnabled) return;
    load(filter, 0);
  }, [filter]);

  useEffect(() => {
    if (reviewsEnabled) reviewStats().then(setStats).catch(() => setStats(null));
  }, []);

  const total = stats ? Object.values(stats).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="stack">
      <div className="page-head">
        <h1>🏆 당첨 인증 후기</h1>
        <p>복권 QR로 당첨을 확인한 사람만 남길 수 있어요. 3개 이상 맞은 5등부터 올릴 수 있고, 등수는 서버가 당첨번호와 직접 맞춰 봐요.</p>
      </div>

      {!reviewsEnabled ? (
        <div className="card empty">
          <p>후기 게시판을 준비하고 있어요. 곧 열려요!</p>
        </div>
      ) : (
        <>
          {stats && total > 0 && (
            <section className="review-stats">
              <strong>지금까지 인증된 당첨 {total.toLocaleString()}건</strong>
              <span>
                {[1, 2, 3, 4, 5]
                  .filter((k) => stats[k])
                  .map((k) => `${k}등 ${stats[k].toLocaleString()}`)
                  .join(' · ')}
              </span>
            </section>
          )}

          <div className="seg seg-full seg-4" role="tablist">
            {FILTERS.map((f) => (
              <button key={String(f.id)} type="button" role="tab" aria-selected={filter === f.id} className={filter === f.id ? 'seg-on' : ''} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>

          {error && <p className="form-error">{error}</p>}

          {list.length === 0 && !loading && !error ? (
            <div className="card empty">
              <p>아직 후기가 없어요. 당첨되셨다면 첫 후기를 남겨 주세요!</p>
              <a href="#/check" className="btn btn-primary">
                🔍 QR로 당첨 확인하고 후기 쓰기
              </a>
            </div>
          ) : (
            <ul className="reviews">
              {list.map((r) => (
                <ReviewCard key={r.id} r={r} />
              ))}
            </ul>
          )}

          {more && (
            <button type="button" className="btn" disabled={loading} onClick={() => load(filter, list.length)}>
              {loading ? '불러오는 중…' : '후기 더 보기'}
            </button>
          )}
          {loading && list.length === 0 && <p className="muted-text">불러오는 중…</p>}

          <a href="#/check" className="btn btn-gold">
            🔍 내 복권 확인하고 후기 남기기
          </a>
        </>
      )}
    </div>
  );
}
