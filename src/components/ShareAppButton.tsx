import { useApp } from '../app-context';
import { SITE_URL } from '../lib/config';

export const SHARE_APP_TEXT = '🎱 로또 찐 명당: 꿈·소원·통계로 재미 삼아 로또 번호를 뽑아 보고, QR로 당첨도 확인해요. 무료예요!';

/** 오른쪽 위 "친구에게 알려주기": 휴대폰 공유 창(카톡 등), 안 되면 주소 복사 */
export function ShareAppButton() {
  const { toast } = useApp();

  const click = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: '로또 찐 명당', text: SHARE_APP_TEXT, url: SITE_URL });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // 공유 창을 닫음
    }
    try {
      await navigator.clipboard.writeText(`${SHARE_APP_TEXT}\n${SITE_URL}`);
      toast('주소를 복사했어요. 카톡에 붙여넣어 친구에게 보내 보세요');
    } catch {
      toast(SITE_URL);
    }
  };

  return (
    <button type="button" className="install-btn share-app-btn" onClick={click} aria-label="친구에게 앱 알려주기">
      <span aria-hidden>📤</span> 친구 공유
    </button>
  );
}
