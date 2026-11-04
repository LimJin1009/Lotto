import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app-context';
import { Ball, BallRow } from '../components/Ball';
import { QrScanner } from '../components/QrScanner';
import { drawTime, formatDate, rankOf } from '../lib/draws';
import { decodeFile } from '../lib/qr-decode';
import { isSameSet } from '../lib/saved';
import { CLAIM_PLACE, fetchPrizes, formatWon, manualTicket, parseLottoQr, type Ticket } from '../lib/ticket';
import { rememberNickname, reviewsEnabled, savedNickname, submitReview } from '../lib/reviews';
import { METHOD_LABEL } from '../lib/types';
import { go } from '../router';

type Tab = 'camera' | 'photo' | 'manual';

const TABS: { id: Tab; label: string }[] = [
  { id: 'camera', label: '📷 QR 찍기' },
  { id: 'photo', label: '📸 사진으로' },
  { id: 'manual', label: '✍️ 직접 입력' },
];

function TicketResult({ ticket, onReset }: { ticket: Ticket; onReset: () => void }) {
  const { draws, latest, saved, save } = useApp();
  const draw = draws.find((d) => d.no === ticket.round);
  const [prizes, setPrizes] = useState<number[] | null>(null);

  const ranks = draw ? ticket.games.map((g) => rankOf(g.nums, draw)) : [];
  const best = ranks.filter((r) => r > 0).sort((a, b) => a - b)[0];

  useEffect(() => {
    if (best) fetchPrizes(ticket.round).then(setPrizes);
  }, [best, ticket.round]);

  const prizeOf = (rank: number) => prizes?.[rank - 1] ?? (rank === 4 ? 50_000 : rank === 5 ? 5_000 : null);
  const total = ranks.reduce((sum, r) => sum + (r ? (prizeOf(r) ?? 0) : 0), 0);
  const isSaved = (nums: number[]) => saved.some((s) => s.drawNo === ticket.round && isSameSet(s.numbers, nums));
  const unsaved = ticket.games.filter((g) => !isSaved(g.nums));

  const saveAll = () => {
    // 새로 저장한 것이 위에 쌓이므로, 거꾸로 저장해야 A게임이 맨 위에 옴
    for (const g of [...unsaved].reverse()) {
      const reasons: Record<number, string> = {};
      for (const n of g.nums) reasons[n] = '산 복권 번호';
      save(
        {
          method: 'ticket',
          emoji: '🎟️',
          title: `${ticket.round}회 복권 ${g.label}게임${g.type ? ` (${g.type})` : ''}`,
          numbers: g.nums,
          reasons,
        },
        ticket.round,
      );
    }
  };

  const when = draw ? formatDate(draw.date) : drawTime(ticket.round, latest).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <section className="card ticket">
      <div className="card-head">
        <h2>
          제 {ticket.round}회 <small>{draw ? `${when} 추첨` : `${when} 추첨 예정`}</small>
        </h2>
        <button type="button" className="link-btn muted" onClick={onReset}>
          다른 복권 확인
        </button>
      </div>

      {!draw ? (
        <div className="verdict verdict-wait">
          <strong>아직 추첨 전이에요</strong>
          <span>번호함에 저장해 두면 추첨이 끝난 뒤 자동으로 맞춰 드려요.</span>
        </div>
      ) : best ? (
        <div className="verdict verdict-win">
          <strong>🎉 {best}등 당첨!</strong>
          {total > 0 && <span>당첨금 합계 약 {formatWon(total)} (세금 떼기 전)</span>}
        </div>
      ) : (
        <div className="verdict">
          <strong>아쉽게 모두 낙첨이에요</strong>
          <span>다음 회차를 노려 봐요.</span>
        </div>
      )}

      {draw && (
        <div className="winning">
          <span className="winning-label">당첨번호</span>
          <BallRow nums={draw.nums} bonus={draw.bonus} size="sm" />
        </div>
      )}

      <ul className="games">
        {ticket.games.map((g, i) => {
          const rank = ranks[i];
          const hits = draw ? [...draw.nums, ...(rank === 2 ? [draw.bonus] : [])] : undefined;
          const prize = rank ? prizeOf(rank) : null;
          return (
            <li key={g.label} className={rank ? 'game game-win' : 'game'}>
              <span className="game-label">
                {g.label}
                {g.type && <small>{g.type}</small>}
              </span>
              <div className="game-balls">
                {g.nums.map((n) => (
                  <Ball key={n} n={n} size="sm" hit={hits?.includes(n)} dim={hits && !hits.includes(n)} />
                ))}
              </div>
              <span className="game-rank">{!draw ? '추첨 전' : rank ? `${rank}등` : '낙첨'}</span>
              {prize ? <span className="game-prize">당첨금 {formatWon(prize)}</span> : null}
            </li>
          );
        })}
      </ul>

      {best && (
        <p className="muted-text">
          {best}등 당첨금은 {CLAIM_PLACE[best]}에서 받을 수 있어요. 지급 기한은 지급 시작일부터 1년이에요. 정확한 금액과 결과는 동행복권에서 꼭 다시 확인해 주세요.
        </p>
      )}

      <button type="button" className="btn btn-primary" disabled={unsaved.length === 0} onClick={saveAll}>
        {unsaved.length === 0 ? '✓ 번호함에 있음' : `${ticket.games.length}게임 번호함에 저장`}
      </button>

      {best && reviewsEnabled &&
        (ticket.source === 'qr' && ticket.raw ? (
          <ReviewForm ticket={ticket} ranks={ranks} />
        ) : (
          <p className="muted-text">🏆 당첨 후기는 복권 QR로 확인한 경우에만 남길 수 있어요. 직접 입력은 누구나 당첨번호를 넣을 수 있어서요.</p>
        ))}
    </section>
  );
}

/** 당첨 후기 쓰기: 등수 판정과 중복 확인은 서버가 다시 한다 */
function ReviewForm({ ticket, ranks }: { ticket: Ticket; ranks: number[] }) {
  const { saved, toast } = useApp();
  const winners = ticket.games
    .map((g, i) => ({ g, rank: ranks[i] }))
    .filter((x) => x.rank > 0)
    .sort((a, b) => a.rank - b.rank);
  const [game, setGame] = useState(winners[0]?.g.label ?? 'A');
  const [nickname, setNickname] = useState(savedNickname);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const chosen = ticket.games.find((g) => g.label === game)!;
  // 로또 찐 번호에서 뽑아 번호함에 저장해 둔 번호면 어떤 방식으로 뽑았는지 같이 올림
  const fromApp = saved.find((s) => s.method !== 'ticket' && isSameSet(s.numbers, chosen.nums));
  const method = fromApp ? `${METHOD_LABEL[fromApp.method]}(으)로 뽑은 번호 · ${fromApp.title}`.slice(0, 60) : null;

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await submitReview({ qr: ticket.raw!, game, nickname: nickname.trim(), content: content.trim(), method });
      rememberNickname(nickname.trim());
      toast('후기를 올렸어요. 축하해요! 🎉');
      go('/reviews');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const ok = nickname.trim().length >= 1 && content.trim().length >= 5;
  return (
    <div className="review-form">
      <h3>🏆 당첨 후기 남기기</h3>
      <p className="muted-text">QR로 확인한 당첨이라 "QR 인증" 표시가 붙어요. 같은 복권은 한 번만 올릴 수 있어요.</p>
      {winners.length > 1 && (
        <div className="chips">
          {winners.map(({ g, rank }) => (
            <button key={g.label} type="button" className={`chip chip-sm${game === g.label ? ' chip-on' : ''}`} onClick={() => setGame(g.label)}>
              {g.label}게임 · {rank}등
            </button>
          ))}
        </div>
      )}
      {method && <p className="review-method">🎯 {method}</p>}
      <input className="input" maxLength={12} placeholder="닉네임 (12자까지)" value={nickname} onChange={(e) => setNickname(e.target.value)} aria-label="닉네임" />
      <textarea
        className="input textarea"
        maxLength={300}
        rows={4}
        placeholder="어떻게 뽑은 번호인지, 당첨됐을 때 기분을 남겨 주세요 (5~300자)"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        aria-label="후기 내용"
      />
      <div className="form-row">
        <span className="muted-text">{content.trim().length}/300</span>
        <button type="button" className="btn btn-gold" disabled={!ok || busy} onClick={submit}>
          {busy ? '올리는 중…' : '후기 올리기'}
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}


function PhotoPicker({ onText }: { onText: (t: string) => boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const text = await decodeFile(file);
      if (!text) setError('사진에서 QR 코드를 찾지 못했어요. QR이 크고 선명하게 나오게 다시 찍어 주세요.');
      else if (!onText(text)) setError(`로또 복권 QR이 아니에요. 복권 오른쪽 위의 QR을 찍어 주세요. (읽은 내용: ${text.slice(0, 120)})`);
    } catch {
      setError('사진을 열지 못했어요. 다른 사진으로 해 주세요.');
    } finally {
      setBusy(false);
      document.querySelectorAll<HTMLInputElement>('.photo-actions input').forEach((el) => (el.value = ''));
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="photo-pick">
      <span className="scanner-icon" aria-hidden>
        🖼️
      </span>
      <p>휴대폰 카메라로 복권을 찍거나 앨범에 있는 사진을 고르면 QR 코드를 찾아요. 사진은 이 기기 밖으로 보내지 않아요.</p>
      {busy ? (
        <span className="btn btn-gold btn-busy">QR 찾는 중…</span>
      ) : (
        <div className="photo-actions">
          {/* capture: 사이트 카메라 권한 없이 휴대폰 기본 카메라 앱으로 바로 찍음 */}
          <label className="btn btn-gold">
            📸 카메라로 찍기
            <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          <label className="btn">
            🖼️ 앨범에서 고르기
            <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
          </label>
        </div>
      )}
      <p className="photo-tip">QR이 사진 가운데에 크고 선명하게 나오게 찍어 주세요.</p>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

function ManualInput({ onCheck }: { onCheck: (t: Ticket) => void }) {
  const { latest } = useApp();
  const [round, setRound] = useState(String(latest.no));
  const [nums, setNums] = useState<number[]>([]);
  const no = Number(round);
  const roundOk = Number.isInteger(no) && no >= 1 && no <= latest.no + 1;

  const toggle = (n: number) => setNums((l) => (l.includes(n) ? l.filter((x) => x !== n) : l.length < 6 ? [...l, n] : l));

  return (
    <div className="manual">
      <label className="manual-round">
        <span>회차</span>
        <input className="input" type="number" inputMode="numeric" min={1} max={latest.no + 1} value={round} onChange={(e) => setRound(e.target.value)} />
        <span>회</span>
      </label>
      {!roundOk && <p className="form-error">1회부터 {latest.no + 1}회 사이로 넣어 주세요.</p>}
      <p className="opt-q">번호 6개를 눌러 주세요 ({nums.length}/6)</p>
      <div className="num-grid">
        {Array.from({ length: 45 }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" className={`num${nums.includes(n) ? ' num-on' : ''}`} onClick={() => toggle(n)} aria-pressed={nums.includes(n)}>
            {nums.includes(n) ? <Ball n={n} size="sm" /> : n}
          </button>
        ))}
      </div>
      <div className="manual-actions">
        <button type="button" className="link-btn muted" onClick={() => setNums([])} disabled={nums.length === 0}>
          다시 고르기
        </button>
        <button type="button" className="btn btn-primary" disabled={nums.length !== 6 || !roundOk} onClick={() => onCheck(manualTicket(no, nums))}>
          당첨 확인
        </button>
      </div>
    </div>
  );
}

export function CheckPage() {
  const [tab, setTab] = useState<Tab>('camera');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [notLotto, setNotLotto] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const onQr = (text: string): boolean => {
    const t = parseLottoQr(text);
    if (!t) {
      setNotLotto(text);
      return false;
    }
    setNotLotto(null);
    setTicket(t);
    navigator.vibrate?.(60);
    return true;
  };

  useEffect(() => {
    if (ticket) top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [ticket]);

  return (
    <div className="stack" ref={top}>
      <div className="page-head">
        <h1>🔍 당첨 확인</h1>
        <p>복권 용지의 QR을 찍거나 번호를 직접 넣으면 바로 맞춰 봐요.</p>
      </div>

      {ticket ? (
        <TicketResult ticket={ticket} onReset={() => setTicket(null)} />
      ) : (
        <section className="card">
          <div className="seg seg-full" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'seg-on' : ''} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          {tab === 'camera' && <QrScanner onText={onQr} onFallback={() => setTab('photo')} />}
          {tab === 'camera' && notLotto && (
            <p className="form-error">
              로또 복권 QR이 아니에요. 복권 오른쪽 위의 QR을 비춰 주세요.
              <span className="qr-raw">읽은 내용: {notLotto.slice(0, 120)}</span>
            </p>
          )}
          {tab === 'photo' && <PhotoPicker onText={onQr} />}
          {tab === 'manual' && <ManualInput onCheck={setTicket} />}
        </section>
      )}
    </div>
  );
}
