import { useState } from 'react';
import { useApp } from '../app-context';
import { pushResult, ResultList } from '../components/ResultCard';
import { STRATEGIES, statsNumbers, type StatsStrategy } from '../lib/stats';
import type { GenResult } from '../lib/types';
import { BackLink } from './MakePage';

export function StatsGenPage() {
  const { draws, latest } = useApp();
  const [strategy, setStrategy] = useState<StatsStrategy>('hot');
  const [results, setResults] = useState<GenResult[]>([]);

  return (
    <div className="stack">
      <BackLink />
      <div className="page-head">
        <h1>📈 통계 분석 번호</h1>
        <p>
          1회부터 {latest.no}회까지 {draws.length.toLocaleString()}번의 추첨 기록으로 만들어요. 지난 기록이 다음 추첨에 영향을 주지는 않아요.
        </p>
      </div>

      <section className="card">
        <div className="options">
          {STRATEGIES.map((s) => (
            <button key={s.id} type="button" className={`option option-tall${strategy === s.id ? ' option-on' : ''}`} onClick={() => setStrategy(s.id)}>
              <span className="option-title">
                {s.emoji} {s.label}
              </span>
              <span className="option-desc">{s.desc}</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-primary btn-big" onClick={() => setResults((l) => pushResult(l, statsNumbers(draws, strategy)))}>
          {results.length ? '한 게임 더 만들기' : '통계 번호 만들기'}
        </button>
      </section>

      <ResultList results={results} onClear={() => setResults([])} />
    </div>
  );
}
