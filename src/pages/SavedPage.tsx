import { useApp } from '../app-context';
import { BallRow } from '../components/Ball';
import { PushCard } from '../components/PushCard';
import { share } from '../components/ResultCard';
import { drawTime, formatDate, rankOf } from '../lib/draws';
import { scoreboard } from '../lib/saved';
import { METHOD_LABEL, type SavedSet } from '../lib/types';

function SavedItem({ s }: { s: SavedSet }) {
  const { draws, remove, toast } = useApp();
  const draw = draws.find((d) => d.no === s.drawNo);
  const rank = draw ? rankOf(s.numbers, draw) : null;
  const hits = draw ? [...draw.nums, ...(rank === 2 ? [draw.bonus] : [])] : undefined;

  return (
    <li className="saved-item">
      <div className="saved-top">
        <span className="saved-title">
          {s.emoji} {s.title}
        </span>
        {rank === null ? (
          <span className="badge">추첨 전</span>
        ) : rank > 0 ? (
          <span className="badge badge-win">🎉 {rank}등</span>
        ) : (
          <span className="badge badge-lose">낙첨</span>
        )}
      </div>
      <BallRow nums={s.numbers} size="sm" hits={hits} />
      {rank !== null && rank > 0 && (
        <a href="#/check" className="saved-review">
          이 번호로 복권을 샀다면, QR로 확인하고 당첨 후기 남기기 →
        </a>
      )}
      <div className="saved-foot">
        <span>
          {METHOD_LABEL[s.method]} · {new Date(s.createdAt).toLocaleDateString('ko-KR')} 저장
          {draw && ` · ${s.numbers.filter((n) => draw.nums.includes(n)).length}개 맞음`}
        </span>
        <span className="saved-actions">
          <button type="button" className="link-btn" onClick={() => share(s, toast)}>
            공유
          </button>
          <button
            type="button"
            className="link-btn muted"
            onClick={() => {
              if (confirm('이 번호를 번호함에서 지울까요?')) remove(s.id);
            }}
          >
            삭제
          </button>
        </span>
      </div>
    </li>
  );
}

/** 내 번호 성적표: 지금까지 저장한 번호를 맞춰 본 기록 */
function ScoreCard() {
  const { saved, draws } = useApp();
  const sc = scoreboard(saved, draws);
  const ranks = [1, 2, 3, 4, 5].filter((r) => sc.wins[r]);
  return (
    <section className="card score-card">
      <h2>📊 내 번호 성적표</h2>
      <dl className="score-grid">
        <div>
          <dt>저장한 번호</dt>
          <dd>
            {sc.total}
            <small>게임</small>
          </dd>
        </div>
        <div>
          <dt>추첨 끝남</dt>
          <dd>
            {sc.checked}
            <small>게임</small>
          </dd>
        </div>
        <div className={sc.winCount ? 'score-win' : undefined}>
          <dt>5등 이상</dt>
          <dd>
            {sc.winCount}
            <small>번</small>
          </dd>
        </div>
        <div>
          <dt>최고 기록</dt>
          <dd>
            {sc.checked ? sc.bestHits : '-'}
            <small>{sc.checked ? '개 맞음' : ''}</small>
          </dd>
        </div>
      </dl>
      {ranks.length > 0 && <p className="score-ranks">🎉 {ranks.map((r) => `${r}등 ${sc.wins[r]}번`).join(' · ')}</p>}
      <p className="score-note">
        {sc.checked === 0 ? '아직 추첨이 끝난 번호가 없어요. 토요일 추첨이 끝나면 채워져요.' : '번호함에 있는 번호를 맞춰 본 기록이에요. 실제로 산 복권과는 다를 수 있어요.'}
      </p>
    </section>
  );
}

export function SavedPage() {
  const { saved, draws, latest } = useApp();
  const rounds = [...new Set(saved.map((s) => s.drawNo))].sort((a, b) => b - a);

  return (
    <div className="stack">
      <div className="page-head">
        <h1>🗂️ 내 번호함</h1>
        <p>저장한 번호는 추첨이 끝나면 자동으로 맞춰 봐요. 이 기기의 브라우저에만 저장돼요.</p>
      </div>

      <PushCard />

      {saved.length > 0 && <ScoreCard />}

      {saved.length === 0 && (
        <div className="card empty">
          <p>아직 저장한 번호가 없어요.</p>
          <a href="#/" className="btn btn-primary">
            번호 만들러 가기
          </a>
        </div>
      )}

      {rounds.map((no) => {
        const draw = draws.find((d) => d.no === no);
        const list = saved.filter((s) => s.drawNo === no);
        const when = draw ? formatDate(draw.date) : formatDate(drawTime(no, latest).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }));
        return (
          <section key={no} className="card">
            <div className="card-head">
              <h2>
                {no}회 <small>{when} {draw ? '추첨' : '추첨 예정'}</small>
              </h2>
              <span className="muted-text">{list.length}게임</span>
            </div>
            {draw && (
              <div className="winning">
                <span className="winning-label">당첨번호</span>
                <BallRow nums={draw.nums} bonus={draw.bonus} size="sm" />
              </div>
            )}
            <ul className="saved-list">
              {list.map((s) => (
                <SavedItem key={s.id} s={s} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
