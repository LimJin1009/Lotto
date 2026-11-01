import { useEffect, useRef, useState } from 'react';
import { decodeCanvas } from '../lib/qr-decode';

type State = 'idle' | 'starting' | 'scanning' | 'error';

/** 카메라로 QR을 계속 읽다가, onText가 true를 돌려주면 멈춘다 */
export function QrScanner({ onText, onFallback }: { onText: (text: string) => boolean; onFallback: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');

  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  useEffect(() => stop, []);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('error');
      setError(
        window.isSecureContext
          ? '이 브라우저에서는 카메라 화면을 바로 쓸 수 없어요. 아래 "카메라로 찍기"로 확인해 주세요.'
          : '카메라 화면은 https 주소에서만 쓸 수 있어요. 아래 "카메라로 찍기"로 확인해 주세요.',
      );
      return;
    }
    setState('starting');
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      stream.current = s;
      const v = video.current!;
      v.srcObject = s;
      await v.play();
      setState('scanning');
      loop();
    } catch (e) {
      stop();
      setState('error');
      const name = (e as DOMException)?.name;
      setError(
        name === 'NotAllowedError'
          ? '카메라 권한을 받지 못했어요. 화면 위에 떠 있는 다른 앱의 버튼·말풍선·화면 필터를 끄고 다시 눌러 보거나, 주소창 왼쪽 설정에서 카메라를 허용해 주세요. 권한 없이 쓰려면 아래 "카메라로 찍기"를 눌러요.'
          : name === 'NotFoundError'
            ? '카메라를 찾지 못했어요. 아래 "카메라로 찍기"로 확인해 주세요.'
            : '카메라를 켜지 못했어요. 다시 눌러 보거나 아래 "카메라로 찍기"를 써 주세요.',
      );
    }
  };

  const loop = () => {
    const canvas = document.createElement('canvas');
    const tick = async () => {
      const v = video.current;
      if (!stream.current || !v) return;
      if (v.readyState >= 2 && v.videoWidth) {
        // 가운데 네모 부분만 잘라서 읽음 (빠르고 정확)
        const side = Math.min(v.videoWidth, v.videoHeight) * 0.8;
        const target = Math.min(side, 720);
        canvas.width = canvas.height = target;
        canvas.getContext('2d', { willReadFrequently: true })!.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, target, target);
        const text = await decodeCanvas(canvas);
        if (text && onText(text)) {
          stop();
          setState('idle');
          return;
        }
      }
      setTimeout(tick, 180);
    };
    tick();
  };

  const on = state === 'starting' || state === 'scanning';
  return (
    <div className="scanner">
      <div className={`scanner-view${on ? ' scanner-on' : ''}`}>
        <video ref={video} playsInline muted />
        {on ? (
          <>
            <span className="scanner-frame" aria-hidden />
            <span className="scanner-hint">복권 오른쪽 위의 QR 코드를 네모 안에 맞춰 주세요</span>
          </>
        ) : (
          <div className="scanner-idle">
            <span className="scanner-icon" aria-hidden>
              📷
            </span>
            <p>복권 용지의 QR 코드를 찍으면 바로 당첨을 맞춰 봐요.</p>
            <button type="button" className="btn btn-gold" onClick={start}>
              카메라 켜기
            </button>
          </div>
        )}
      </div>
      {on && (
        <button
          type="button"
          className="link-btn muted"
          onClick={() => {
            stop();
            setState('idle');
          }}
        >
          카메라 끄기
        </button>
      )}
      {state === 'error' && (
        <>
          <p className="form-error">{error}</p>
          <button type="button" className="btn btn-gold" onClick={onFallback}>
            📸 카메라로 찍기 (권한 필요 없음)
          </button>
        </>
      )}
    </div>
  );
}
