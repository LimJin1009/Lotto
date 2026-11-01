import { extractPicks, PERSONAL_KINDS, type PersonalInput } from '../../lib/personal';

const MAX_INPUTS = 3;

export function PersonalOptions({ value, onChange }: { value: PersonalInput[]; onChange: (v: PersonalInput[]) => void }) {
  const update = (i: number, patch: Partial<PersonalInput>) => onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const nextKind = PERSONAL_KINDS.find((k) => !value.some((i) => i.kind === k.id))?.id ?? 'custom';

  return (
    <div className="opt">
      <p className="opt-q">나에게 의미 있는 숫자를 넣어 주세요. 입력한 숫자는 이 기기 밖으로 보내지 않아요.</p>
      {value.map((inp, i) => {
        const kind = PERSONAL_KINDS.find((k) => k.id === inp.kind)!;
        const isDate = inp.kind === 'birthday' || inp.kind === 'anniversary';
        const preview = extractPicks(inp).slice(0, 4);
        return (
          <div key={i} className="input-block">
            <div className="chips">
              {PERSONAL_KINDS.map((k) => (
                <button key={k.id} type="button" className={`chip chip-sm${inp.kind === k.id ? ' chip-on' : ''}`} onClick={() => update(i, { kind: k.id, value: '' })}>
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
              {value.length > 1 && (
                <button type="button" className="icon-btn" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="이 입력 빼기">
                  ✕
                </button>
              )}
            </div>
            {preview.length > 0 && (
              <p className="preview">
                나올 숫자:
                {preview.map((p, j) => (
                  <b key={j}>{p.n}</b>
                ))}
              </p>
            )}
          </div>
        );
      })}
      {value.length < MAX_INPUTS && (
        <button type="button" className="link-btn" onClick={() => onChange([...value, { kind: nextKind, value: '' }])}>
          + 숫자 하나 더 넣기 (최대 {MAX_INPUTS}개)
        </button>
      )}
    </div>
  );
}
