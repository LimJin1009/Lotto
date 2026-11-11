import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../app-context';
import { useInstall, type Platform } from '../lib/install';

function openInChrome() {
  // 안드로이드 카카오톡 안에서 크롬으로 열기
  const url = location.href.replace(/^https?:\/\//, '');
  location.href = `intent://${url}#Intent;scheme=https;package=com.android.chrome;end`;
}

const STEPS: Record<Exclude<Platform, 'installed'>, { title: string; steps: string[] }> = {
  kakao: {
    title: '카카오톡 안에서는 설치가 안 돼요',
    steps: ['오른쪽 아래(또는 위) ⋮ 메뉴를 눌러요', '"다른 브라우저로 열기"를 눌러요', '열린 브라우저에서 다시 "앱 설치"를 눌러요'],
  },
  inapp: {
    title: '이 앱 안의 브라우저에서는 설치가 안 돼요',
    steps: ['메뉴에서 "다른 브라우저로 열기"를 눌러요', '아이폰은 Safari, 안드로이드는 Chrome에서 다시 "앱 설치"를 눌러요'],
  },
  ios: {
    title: '아이폰은 Safari에서 이렇게 설치해요',
    steps: ['아래쪽 가운데 공유 버튼(네모에 위 화살표)을 눌러요', '목록을 내려 "홈 화면에 추가"를 눌러요', '오른쪽 위 "추가"를 누르면 홈 화면에 로또 찐 명당 아이콘이 생겨요'],
  },
  'ios-other': {
    title: '아이폰은 Safari에서 설치할 수 있어요',
    steps: ['이 주소를 Safari에서 열어요 (아래 "주소 복사" 후 Safari에 붙여넣기)', '공유 버튼 → "홈 화면에 추가"를 눌러요'],
  },
  android: {
    title: '안드로이드는 Chrome에서 이렇게 설치해요',
    steps: ['오른쪽 위 ⋮ 메뉴를 눌러요', '"앱 설치" 또는 "홈 화면에 추가"를 눌러요', '"설치"를 누르면 홈 화면에 로또 찐 명당 아이콘이 생겨요'],
  },
  desktop: {
    title: '휴대폰에서 열어 설치해 주세요',
    steps: ['휴대폰으로 이 주소를 열어요', '아이폰은 Safari의 "홈 화면에 추가", 안드로이드는 Chrome의 "앱 설치"를 눌러요', 'PC 크롬에서는 주소창 오른쪽 설치 아이콘으로도 설치할 수 있어요'],
  },
};

/** 상단의 "앱 설치" 버튼 + 안내 창 */
export function InstallButton() {
  const { platform, canPrompt, prompt } = useInstall();
  const { toast } = useApp();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (platform === 'installed') return null;

  const click = async () => {
    if (canPrompt) {
      if (await prompt()) toast('홈 화면에 로또 찐 명당을 설치했어요');
      return;
    }
    setOpen(true);
  };

  const guide = STEPS[platform];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.href.split('#')[0]);
      toast('주소를 복사했어요');
    } catch {
      toast(location.href.split('#')[0]);
    }
  };

  return (
    <>
      <button type="button" className="install-btn" onClick={click}>
        📲 앱 설치
      </button>
      {open &&
        // 상단바의 흐림 효과 안에 갇히지 않도록 화면 맨 바깥(body)에 그린다
        createPortal(
        <div className="sheet-back" onClick={() => setOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={(e) => e.stopPropagation()}>
            <img src="./icon-192.png" alt="" className="sheet-icon" />
            <h2 id="install-title">{guide.title}</h2>
            <p className="muted-text">설치하면 홈 화면 아이콘으로 바로 열리고, 인터넷이 약해도 열려요. 앱 마켓을 거치지 않아요.</p>
            <ol className="sheet-steps">
              {guide.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <div className="sheet-actions">
              {platform === 'kakao' && /Android/i.test(navigator.userAgent) && (
                <button type="button" className="btn btn-primary" onClick={openInChrome}>
                  Chrome으로 열기
                </button>
              )}
              {(platform === 'ios-other' || platform === 'kakao' || platform === 'inapp' || platform === 'desktop') && (
                <button type="button" className="btn" onClick={copy}>
                  주소 복사
                </button>
              )}
              <button type="button" className="btn" onClick={() => setOpen(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}
