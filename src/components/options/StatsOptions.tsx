import { STRATEGIES, type StatsStrategy } from '../../lib/stats';

export function StatsOptions({ value, onChange, lastNo }: { value: StatsStrategy; onChange: (v: StatsStrategy) => void; lastNo: number }) {
  return (
    <div className="opt">
      <p className="opt-q">1회부터 {lastNo}회까지의 당첨 기록으로 뽑아요. 지난 기록이 다음 추첨에 영향을 주지는 않아요.</p>
      <div className="options">
        {STRATEGIES.map((s) => (
          <button key={s.id} type="button" className={`option option-tall${value === s.id ? ' option-on' : ''}`} onClick={() => onChange(s.id)}>
            <span className="option-title">
              {s.emoji} {s.label}
            </span>
            <span className="option-desc">{s.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
