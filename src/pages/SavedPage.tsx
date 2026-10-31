import { useApp } from '../app-context';
import { BallRow } from '../components/Ball';
import { share } from '../components/ResultCard';
import { drawTime, formatDate, rankOf } from '../lib/draws';
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

export function SavedPage() {
  const { saved, draws, latest } = useApp();
  const rounds = [...new Set(saved.map((s) => s.drawNo))].sort((a, b) => b - a);

  return (
    <div className="stack">
      <div className="page-head">
        <h1>🗂️ 내 번호함</h1>
        <p>저장한 번호는 추첨이 끝나면 자동으로 맞춰 봐요. 이 기기의 브라우저에만 저장돼요.</p>
      </div>

      {saved.length === 0 && (
        <div className="card empty">
          <p>아직 저장한 번호가 없어요.</p>
          <a href="#/make" className="btn btn-primary">
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
