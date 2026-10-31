import { useState } from 'react';
import { pushResult, ResultList } from '../components/ResultCard';
import { DREAM_CATEGORIES, DREAMS, dreamNumbers, type Dream, type DreamCategory, type Situation } from '../lib/dream';
import type { GenResult } from '../lib/types';
import { BackLink } from './MakePage';

export function DreamPage() {
  const [cat, setCat] = useState<DreamCategory>('동물');
  const [dream, setDream] = useState<Dream | null>(null);
  const [sit, setSit] = useState<Situation | null>(null);
  const [results, setResults] = useState<GenResult[]>([]);

  const pickDream = (d: Dream) => {
    setDream(d);
    setSit(null);
  };

  return (
    <div className="stack">
      <BackLink />
      <div className="page-head">
        <h1>🌙 꿈 해몽 번호</h1>
        <p>어젯밤 꾼 꿈을 골라 주세요. 해몽 숫자는 이 앱이 정한 재미용 해석이에요.</p>
      </div>

      <section className="card">
        <h2 className="step">1. 어떤 꿈이었나요?</h2>
        <div className="chips" role="tablist">
          {DREAM_CATEGORIES.map((c) => (
            <button key={c} type="button" role="tab" aria-selected={cat === c} className={`chip${cat === c ? ' chip-on' : ''}`} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="dream-grid">
          {DREAMS.filter((d) => d.category === cat).map((d) => (
            <button key={d.id} type="button" className={`dream${dream?.id === d.id ? ' dream-on' : ''}`} onClick={() => pickDream(d)}>
              <span className="dream-emoji">{d.emoji}</span>
              {d.name}
            </button>
          ))}
        </div>
      </section>

      {dream && (
        <section className="card">
          <h2 className="step">2. 꿈에서 어떤 일이 있었나요?</h2>
          <p className="muted-text">
            {dream.emoji} <b>{dream.name}</b> — {dream.meaning}
          </p>
          <div className="options">
            {dream.situations.map((s) => (
              <button key={s.label} type="button" className={`option${sit === s ? ' option-on' : ''}`} onClick={() => setSit(s)}>
                {s.label}
              </button>
            ))}
            <button type="button" className={`option${sit === null ? ' option-on' : ''}`} onClick={() => setSit(null)}>
              잘 기억 안 나요
            </button>
          </div>
          <button type="button" className="btn btn-primary btn-big" onClick={() => setResults((l) => pushResult(l, dreamNumbers(dream, sit ?? undefined)))}>
            {results.length ? '한 게임 더 만들기' : '해몽 번호 만들기'}
          </button>
        </section>
      )}

      <ResultList results={results} onClear={() => setResults([])} />
    </div>
  );
}
