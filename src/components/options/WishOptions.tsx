import { charNumber, normalizeWish } from '../../lib/wish';

const EXAMPLES = ['올해 집 사자', '우리 가족 건강하게', '내 이름', '대박 나자'];

export function WishOptions({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const chars = [...normalizeWish(value)].slice(0, 6);
  return (
    <div className="opt">
      <p className="opt-q">이름이나 소원 한 줄을 써 주세요. 글자마다 숫자로 바뀌고, 같은 문장은 언제나 같은 번호가 나와요.</p>
      <input
        className="input"
        type="text"
        maxLength={40}
        placeholder="예: 올해 집 사자"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="이름이나 소원 문장"
      />
      <div className="chips">
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" className="chip chip-sm" onClick={() => onChange(ex === '내 이름' ? '' : ex)}>
            {ex}
          </button>
        ))}
      </div>
      {chars.length > 0 && (
        <p className="preview">
          {chars.map((ch, i) => (
            <span key={i}>
              {ch}→<b>{charNumber(ch)}</b>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
