const METHODS = [
  { href: '#/make/dream', emoji: '🐷', title: '꿈 해몽 번호', desc: '어젯밤 꾼 꿈을 고르면 해몽과 함께', tone: 'pink' },
  { href: '#/make/personal', emoji: '🎂', title: '나만의 숫자', desc: '생일·전화번호·차량번호로', tone: 'yellow' },
  { href: '#/make/stats', emoji: '📈', title: '통계 분석', desc: '역대 당첨번호 기록으로', tone: 'blue' },
  { href: '#/machine', emoji: '🎱', title: '추첨기', desc: '공이 섞이고 하나씩 나와요', tone: 'green' },
];

const SOON = ['🔮 오늘의 운세', '✍️ 이름·소원 문장', '💞 궁합 번호', '📷 복권 QR 확인', '🏆 당첨 인증 후기'];

export function MethodGrid({ showSoon = false }: { showSoon?: boolean }) {
  return (
    <>
      <div className="method-grid">
        {METHODS.map((m) => (
          <a key={m.href} href={m.href} className={`method-card tone-${m.tone}`}>
            <span className="method-emoji" aria-hidden>
              {m.emoji}
            </span>
            <strong>{m.title}</strong>
            <span className="method-desc">{m.desc}</span>
          </a>
        ))}
      </div>
      {showSoon && (
        <div className="soon">
          <span className="soon-label">준비 중</span>
          {SOON.map((s) => (
            <span key={s} className="chip chip-soon">
              {s}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
