import { useState } from 'react';
import { MAX_EXCLUDED, MAX_FIXED, toggleFilter, type PickFilter } from '../../lib/picks';

type Kind = keyof PickFilter;

/** 고정수·제외수: 모든 뽑기 방식에 함께 쓰는 옵션. 접어 두고, 고른 게 있으면 개수를 보여 준다 */
export function FilterOptions({ value, onChange, disabled }: { value: PickFilter; onChange: (v: PickFilter) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('fixed');
  const count = value.fixed.length + value.excluded.length;
  const full = kind === 'fixed' ? value.fixed.length >= MAX_FIXED : value.excluded.length >= MAX_EXCLUDED;

  return (
    <div className="filter">
      <button type="button" className="filter-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>🎯 고정수·제외수</span>
        <span className="filter-sum">
          {count === 0 ? '안 씀' : `고정 ${value.fixed.length}개 · 제외 ${value.excluded.length}개`} {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <fieldset className="filter-body" disabled={disabled}>
          <div className="filter-kinds">
            <button type="button" className={`chip chip-sm${kind === 'fixed' ? ' chip-on' : ''}`} onClick={() => setKind('fixed')} aria-pressed={kind === 'fixed'}>
              꼭 넣을 번호 ({value.fixed.length}/{MAX_FIXED})
            </button>
            <button type="button" className={`chip chip-sm${kind === 'excluded' ? ' chip-on' : ''}`} onClick={() => setKind('excluded')} aria-pressed={kind === 'excluded'}>
              뺄 번호 ({value.excluded.length}/{MAX_EXCLUDED})
            </button>
            {count > 0 && (
              <button type="button" className="link-btn muted" onClick={() => onChange({ fixed: [], excluded: [] })}>
                모두 지우기
              </button>
            )}
          </div>
          <div className="filter-grid">
            {Array.from({ length: 45 }, (_, i) => {
              const n = i + 1;
              const state = value.fixed.includes(n) ? 'fixed' : value.excluded.includes(n) ? 'excluded' : null;
              return (
                <button
                  key={n}
                  type="button"
                  className={`filter-num${state ? ` filter-${state}` : ''}`}
                  onClick={() => onChange(toggleFilter(value, state ?? kind, n))}
                  disabled={!state && full}
                  aria-pressed={!!state}
                  aria-label={`${n}번${state === 'fixed' ? ', 고정수' : state === 'excluded' ? ', 제외수' : ''}`}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <p className="opt-q">
            고정수는 모든 게임에 들어가고, 제외수는 나오지 않아요. 고른 번호를 다시 누르면 풀려요. 당첨 확률은 달라지지 않아요.
          </p>
        </fieldset>
      )}
    </div>
  );
}
