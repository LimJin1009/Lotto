import { useApp } from '../app-context';
import { usePush } from '../lib/push';

/** 당첨 알림 켜기·끄기. compact 면 꺼져 있을 때만 짧게 보인다 */
export function PushCard({ compact = false }: { compact?: boolean }) {
  const { saved, latest } = useApp();
  const { state, busy, error, turnOn, turnOff } = usePush(saved, latest.no);

  if (state === 'checking') return null;
  if (compact && state !== 'off') return null;

  if (compact) {
    return (
      <div className="push-mini">
        <span>🔔 저장한 번호가 당첨되면 알림으로 알려 드릴까요?</span>
        <button type="button" className="link-btn" onClick={turnOn} disabled={busy}>
          {busy ? '켜는 중…' : '알림 받기'}
        </button>
      </div>
    );
  }

  return (
    <section className={`card push-card${state === 'on' ? ' push-on' : ''}`}>
      {state === 'on' ? (
        <>
          <div className="push-head">
            <strong>🔔 당첨 알림이 켜져 있어요</strong>
            <button type="button" className="link-btn muted" onClick={turnOff} disabled={busy}>
              알림 끄기
            </button>
          </div>
          <p>추첨이 끝나면 저장한 번호를 맞춰 보고, 5등 이상이면 휴대폰으로 알려 드려요.</p>
        </>
      ) : state === 'off' ? (
        <>
          <strong>🔔 저장한 번호가 당첨되면 알려 드릴까요?</strong>
          <p>토요일 추첨이 끝나면 번호를 맞춰 보고, 5등 이상이면 휴대폰 알림으로 알려 드려요.</p>
          <button type="button" className="btn btn-primary" onClick={turnOn} disabled={busy}>
            {busy ? '켜는 중…' : '당첨 알림 받기'}
          </button>
        </>
      ) : (
        <>
          <strong>🔔 당첨 알림</strong>
          <p>
            {state === 'denied' && '알림이 막혀 있어요. 휴대폰이나 브라우저 설정에서 이 사이트의 알림을 허용한 뒤 다시 열어 주세요.'}
            {state === 'ios-install' && "아이폰은 '홈 화면에 추가'한 앱에서만 알림을 받을 수 있어요. 위의 '앱 설치'로 추가한 뒤, 그 앱에서 알림을 켜 주세요."}
            {state === 'inapp' && '카카오톡 같은 앱 안에서는 알림을 받을 수 없어요. 크롬이나 사파리로 열어 주세요.'}
            {state === 'unsupported' && '이 브라우저는 알림을 지원하지 않아요. 크롬으로 열어 주세요.'}
          </p>
        </>
      )}
      {error && <p className="push-error">{error}</p>}
      <p className="push-note">알림을 켜면 추첨 전 회차에 저장한 번호만 서버에 맡겨 두고, 추첨이 끝나면 지워요.</p>
    </section>
  );
}
