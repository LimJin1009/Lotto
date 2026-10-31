import { useApp } from '../app-context';
import { BallRow } from '../components/Ball';
import { MethodGrid } from '../components/MethodGrid';
import { drawTime, formatDate, rankOf } from '../lib/draws';

function countdown(ms: number) {
  if (ms <= 0) return '추첨 중';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${d > 0 ? `${d}일 ` : ''}${hh}:${mm}:${ss}`;
}

export function HomePage() {
  const { latest, round, now, saved } = useApp();
  const left = drawTime(round, latest).getTime() - now.getTime();
  const salesLeft = left - 35 * 60 * 1000;

  const mine = saved.filter((s) => s.drawNo === latest.no);
  const best = mine.map((s) => rankOf(s.numbers, latest)).filter((r) => r > 0).sort((a, b) => a - b)[0];
  const waiting = saved.filter((s) => s.drawNo === round).length;

  return (
    <div className="stack">
      <section className="hero">
        <div className="hero-row">
          <span className="hero-label">제 {round}회 추첨까지</span>
          <span className="hero-sub">토요일 20:35</span>
        </div>
        <div className="hero-count">{countdown(left)}</div>
        <div className="hero-foot">
          {salesLeft > 0 ? `판매 마감까지 ${countdown(salesLeft)}` : '이번 회차 판매가 마감됐어요'}
          {waiting > 0 && <a href="#/saved"> · 내 번호 {waiting}게임 대기 중</a>}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>
            {latest.no}회 당첨번호 <small>{formatDate(latest.date)}</small>
          </h2>
          <a href="#/stats" className="link-btn">
            통계 보기
          </a>
        </div>
        <BallRow nums={latest.nums} bonus={latest.bonus} />
        {mine.length > 0 && (
          <a href="#/saved" className={`my-result${best ? ' my-result-win' : ''}`}>
            {best ? `🎉 내 번호 중 ${best}등이 있어요!` : `내 번호 ${mine.length}게임은 아쉽게 낙첨이에요`}
            <span>확인 →</span>
          </a>
        )}
      </section>

      <section>
        <h2 className="section-title">어떤 방법으로 만들까요?</h2>
        <MethodGrid showSoon />
      </section>
    </div>
  );
}
