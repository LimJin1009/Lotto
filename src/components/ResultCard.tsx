import { useState } from 'react';
import { useApp } from '../app-context';
import { METHOD_LABEL, type GenResult } from '../lib/types';
import { isSameSet } from '../lib/saved';
import { Ball, BallRow } from './Ball';

export function shareText(r: GenResult): string {
  return `${r.emoji} ${r.title}\n${r.numbers.join('  ')}\n\n오늘의 번호에서 ${METHOD_LABEL[r.method]}(으)로 만든 번호예요 (재미로 보는 번호)\n${location.href.split('#')[0]}`;
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

/** 생성 화면 공통: 결과 목록 (최대 5게임) */
export function ResultList({ results, onClear }: { results: GenResult[]; onClear: () => void }) {
  const { save, saved, round } = useApp();
  if (results.length === 0) return null;
  const unsaved = results.filter((r) => !saved.some((s) => s.drawNo === round && isSameSet(s.numbers, r.numbers)));
  return (
    <section className="results">
      <div className="results-bar">
        <span>만든 번호 {results.length}게임</span>
        <div className="results-bar-actions">
          {results.length > 1 && unsaved.length > 0 && (
            <button type="button" className="link-btn" onClick={() => unsaved.forEach((r) => save(r))}>
              모두 저장
            </button>
          )}
          <button type="button" className="link-btn muted" onClick={onClear}>
            지우기
          </button>
        </div>
      </div>
      {results.map((r, i) => (
        <ResultCard key={r.numbers.join('-') + i} result={r} index={results.length > 1 ? results.length - 1 - i : undefined} expanded={i === 0} />
      ))}
    </section>
  );
}

/** 새 결과를 맨 위에 추가하고 5게임까지만 남긴다 */
export function pushResult(list: GenResult[], r: GenResult): GenResult[] {
  return [r, ...list].slice(0, 5);
}
