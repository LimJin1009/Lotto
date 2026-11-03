import { useState } from 'react';
import { useApp } from '../app-context';
import { METHOD_LABEL, type GenResult } from '../lib/types';
import { isSameSet } from '../lib/saved';
import { Ball, BallRow } from './Ball';

export function shareText(r: GenResult): string {
  return `${r.emoji} ${r.title}\n${r.numbers.join('  ')}\n\n로또 찐번호에서 ${METHOD_LABEL[r.method]}(으)로 만든 번호예요 (재미로 보는 번호)\n${location.href.split('#')[0]}`;
}

export async function share(r: GenResult, toast: (m: string) => void) {
  const text = shareText(r);
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return;
    }
    await navigator.clipboard.writeText(text);
    toast('번호를 복사했어요. 카톡에 붙여넣어 보세요');
  } catch {
    /* 사용자가 공유를 취소함 */
  }
}

interface Props {
  result: GenResult;
  index?: number;
  /** 가장 최근 결과면 이유를 펼쳐서 보여준다 */
  expanded?: boolean;
}

export function ResultCard({ result, index, expanded = true }: Props) {
  const { saved, save, round, toast } = useApp();
  const [open, setOpen] = useState(expanded);
  const isSaved = saved.some((s) => s.drawNo === round && isSameSet(s.numbers, result.numbers));

  return (
    <article className="card result-card">
      <header className="result-head">
        <span className="result-emoji" aria-hidden>
          {result.emoji}
        </span>
        <div className="result-title">
          {index !== undefined && <span className="result-game">{String.fromCharCode(65 + index)}게임</span>}
          <strong>{result.title}</strong>
        </div>
      </header>
      <BallRow nums={result.numbers} size="lg" pop />
      {result.note && <p className="result-note">{result.note}</p>}

      <button type="button" className="link-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? '번호가 나온 이유 접기 ▲' : '번호가 나온 이유 보기 ▼'}
      </button>
      {open && (
        <ul className="reason-list">
          {result.numbers.map((n) => (
            <li key={n}>
              <Ball n={n} size="sm" />
              <span>{result.reasons[n]}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="result-actions">
        <button type="button" className="btn btn-primary" disabled={isSaved} onClick={() => save(result)}>
          {isSaved ? '✓ 번호함에 있음' : `${round}회 번호함에 저장`}
        </button>
        <button type="button" className="btn" onClick={() => share(result, toast)}>
          공유
        </button>
      </div>
    </article>
  );
}

function slipText(list: GenResult[]): string {
  const rows = list.map((r, i) => `${String.fromCharCode(65 + i)}  ${r.numbers.map((n) => String(n).padStart(2, ' ')).join('  ')}  ${r.emoji}`);
  return `🎱 로또 찐번호 ${list.length}게임\n${rows.join('\n')}\n\n재미로 보는 번호예요\n${location.href.split('#')[0]}`;
}

/** 여러 게임: 복권 용지처럼 한 장에 한 줄씩. 줄을 누르면 번호가 나온 이유가 펼쳐진다. */
function ResultSlip({ list }: { list: GenResult[] }) {
  const { save, saved, round, toast } = useApp();
  const [open, setOpen] = useState<number | null>(null);
  const isSaved = (r: GenResult) => saved.some((s) => s.drawNo === round && isSameSet(s.numbers, r.numbers));
  const unsaved = list.filter((r) => !isSaved(r));

  const shareAll = async () => {
    const text = slipText(list);
    try {
      if (navigator.share) return void (await navigator.share({ text }));
      await navigator.clipboard.writeText(text);
      toast('번호를 복사했어요. 카톡에 붙여넣어 보세요');
    } catch {
      /* 사용자가 공유를 취소함 */
    }
  };

  return (
    <article className="card result-card slip">
      <ol className="slip-rows">
        {list.map((r, i) => {
          const done = isSaved(r);
          return (
            <li key={r.numbers.join('-') + i} className={`slip-row${open === i ? ' slip-open' : ''}`}>
              <button
                type="button"
                className="slip-main"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                aria-label={`${String.fromCharCode(65 + i)}게임 ${r.title}, 번호가 나온 이유 ${open === i ? '접기' : '보기'}`}
              >
                <span className="slip-letter">{String.fromCharCode(65 + i)}</span>
                <span className="slip-balls">
                  {r.numbers.map((n) => (
                    <Ball key={n} n={n} size="sm" />
                  ))}
                </span>
              </button>
              <button
                type="button"
                className={`slip-save${done ? ' slip-saved' : ''}`}
                disabled={done}
                onClick={() => save(r)}
                aria-label={done ? '번호함에 있음' : `${String.fromCharCode(65 + i)}게임 번호함에 저장`}
              >
                {done ? '✓' : '+'}
              </button>
              {open === i && (
                <div className="slip-detail">
                  <p className="slip-title">
                    {r.emoji} {r.title}
                  </p>
                  <ul className="reason-list">
                    {r.numbers.map((n) => (
                      <li key={n}>
                        <Ball n={n} size="sm" />
                        <span>{r.reasons[n]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="slip-hint">줄을 누르면 번호가 나온 이유를 볼 수 있어요. + 는 한 게임만 저장.</p>
      <div className="result-actions">
        <button type="button" className="btn btn-primary" disabled={unsaved.length === 0} onClick={() => unsaved.forEach((r) => save(r))}>
          {unsaved.length === 0 ? '✓ 모두 번호함에 있음' : `${round}회 번호함에 ${unsaved.length === list.length ? '모두' : `${unsaved.length}게임`} 저장`}
        </button>
        <button type="button" className="btn" onClick={shareAll}>
          공유
        </button>
      </div>
    </article>
  );
}

/** 생성 화면 공통: 결과 목록 (최대 5게임). 한 게임이면 큰 카드, 여러 게임이면 용지 한 장 */
export function ResultList({ results, onClear }: { results: GenResult[]; onClear: () => void }) {
  if (results.length === 0) return null;
  // results 는 최신이 앞이므로, 용지에는 먼저 뽑은 것부터 A, B, C… 순서로
  const list = [...results].reverse();
  return (
    <section className="results">
      <div className="results-bar">
        <span>만든 번호 {results.length}게임</span>
        <button type="button" className="link-btn muted" onClick={onClear}>
          지우기
        </button>
      </div>
      {list.length === 1 ? <ResultCard result={list[0]} /> : <ResultSlip list={list} />}
    </section>
  );
}

/** 새 결과를 맨 위에 추가하고 5게임까지만 남긴다 */
export function pushResult(list: GenResult[], r: GenResult): GenResult[] {
  return [r, ...list].slice(0, 5);
}
