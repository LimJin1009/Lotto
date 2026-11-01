import { useState } from 'react';
import { DREAM_CATEGORIES, DREAMS, type Dream, type DreamCategory, type Situation } from '../../lib/dream';

export interface DreamChoice {
  dream: Dream | null;
  /** null이면 "잘 기억 안 나요" */
  sit: Situation | null;
}

export function DreamOptions({ value, onChange }: { value: DreamChoice; onChange: (v: DreamChoice) => void }) {
  const [cat, setCat] = useState<DreamCategory>(value.dream?.category ?? '동물');
  const { dream, sit } = value;

  return (
    <div className="opt">
      <p className="opt-q">어젯밤 어떤 꿈을 꾸셨나요?</p>
      <div className="chips" role="tablist">
        {DREAM_CATEGORIES.map((c) => (
          <button key={c} type="button" role="tab" aria-selected={cat === c} className={`chip chip-sm${cat === c ? ' chip-on' : ''}`} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="dream-grid">
        {DREAMS.filter((d) => d.category === cat).map((d) => (
          <button key={d.id} type="button" className={`dream${dream?.id === d.id ? ' dream-on' : ''}`} onClick={() => onChange({ dream: d, sit: null })}>
            <span className="dream-emoji">{d.emoji}</span>
            {d.name}
          </button>
        ))}
      </div>
      {dream && (
        <>
          <p className="opt-q">
            {dream.emoji} {dream.name}에서 어떤 일이 있었나요?
          </p>
          <div className="chips">
            {dream.situations.map((s) => (
              <button key={s.label} type="button" className={`chip chip-sm${sit === s ? ' chip-on' : ''}`} onClick={() => onChange({ dream, sit: s })}>
                {s.label}
              </button>
            ))}
            <button type="button" className={`chip chip-sm${sit === null ? ' chip-on' : ''}`} onClick={() => onChange({ dream, sit: null })}>
              잘 기억 안 나요
            </button>
          </div>
        </>
      )}
    </div>
  );
}
