import { useState } from 'react';
import { pushResult, ResultList } from '../components/ResultCard';
import { extractPicks, PERSONAL_KINDS, personalNumbers, type PersonalInput, type PersonalKind } from '../lib/personal';
import type { GenResult } from '../lib/types';
import { BackLink } from './MakePage';

const MAX_INPUTS = 3;

export function PersonalPage() {
  const [inputs, setInputs] = useState<PersonalInput[]>([{ kind: 'birthday', value: '' }]);
  const [results, setResults] = useState<GenResult[]>([]);

  const update = (i: number, patch: Partial<PersonalInput>) => setInputs((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const usable = inputs.filter((i) => extractPicks(i).length > 0);
  const nextKind = PERSONAL_KINDS.find((k) => !inputs.some((i) => i.kind === k.id))?.id ?? 'custom';

  return (
    <div className="stack">
      <BackLink />
      <div className="page-head">
        <h1>🎂 나만의 숫자 번호</h1>
        <p>나에게 의미 있는 숫자를 넣으면 1~45 사이 숫자로 바꿔 드려요. 입력한 숫자는 이 기기 밖으로 보내지 않아요.</p>
      </div>

      <section className="card">
        {inputs.map((inp, i) => {
          const kind = PERSONAL_KINDS.find((k) => k.id === inp.kind)!;
          const isDate = inp.kind === 'birthday' || inp.kind === 'anniversary';
          const preview = extractPicks(inp).slice(0, 4);
          return (
            <div key={i} className="input-block">
              <div className="chips">
                {PERSONAL_KINDS.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    className={`chip${inp.kind === k.id ? ' chip-on' : ''}`}
                    onClick={() => update(i, { kind: k.id as PersonalKind, value: '' })}
                  >
                    {k.emoji} {k.label}
                  </button>
                ))}
              </div>
              <div className="input-row">
                <input
                  className="input"
                  type={isDate ? 'date' : 'text'}
                  inputMode={isDate ? undefined : 'numeric'}
                  placeholder={kind.placeholder}
                  value={inp.value}
                  max={isDate ? '2100-12-31' : undefined}
                  onChange={(e) => update(i, { value: e.target.value })}
                  aria-label={kind.label}
                />
                {inputs.length > 1 && (
                  <button type="button" className="icon-btn" onClick={() => setInputs((l) => l.filter((_, j) => j !== i))} aria-label="이 입력 빼기">
                    ✕
                  </button>
                )}
              </div>
              {preview.length > 0 && (
                <p className="preview">
                  나올 숫자: {preview.map((p, j) => <b key={j}>{p.n}</b>)}
                </p>
              )}
            </div>
          );
        })}

        {inputs.length < MAX_INPUTS && (
          <button type="button" className="link-btn" onClick={() => setInputs((l) => [...l, { kind: nextKind, value: '' }])}>
            + 숫자 하나 더 넣기 (최대 {MAX_INPUTS}개)
          </button>
        )}

        <button
          type="button"
          className="btn btn-primary btn-big"
          disabled={usable.length === 0}
          onClick={() => setResults((l) => pushResult(l, personalNumbers(usable)))}
        >
          {usable.length === 0 ? '숫자를 넣어 주세요' : results.length ? '한 게임 더 만들기' : '내 번호 만들기'}
        </button>
      </section>

      <ResultList results={results} onClear={() => setResults([])} />
    </div>
  );
}
