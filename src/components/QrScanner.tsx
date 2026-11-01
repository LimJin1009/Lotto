import { useEffect, useRef, useState } from 'react';
import { decodeImageData, detectNative, hasNativeDetector, initZxing } from '../lib/qr-decode';

type State = 'idle' | 'starting' | 'scanning' | 'error';

// 브라우저 표준 타입에 아직 없는 카메라 기능 (줌·초점·플래시)
interface CamCaps {
  zoom?: { min: number; max: number; step?: number };
  focusMode?: string[];
  torch?: boolean;
}
type CamSettings = { zoom?: number; focusMode?: string; torch?: boolean; pointsOfInterest?: { x: number; y: number }[] };

const ZOOMS = [1, 2, 3];

/** 카메라로 QR을 계속 읽다가, onText가 true를 돌려주면 멈춘다 */
export function QrScanner({ onText, onFallback }: { onText: (text: string) => boolean; onFallback: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');
  const [caps, setCaps] = useState<CamCaps>({});
  const [zoom, setZoom] = useState<number | null>(null);
  const [torch, setTorch] = useState(false);
  /** 원인 파악용: 어떤 카메라·인식기·해상도로 읽는 중인지 */
  const [info, setInfo] = useState('');
  /** 후면 카메라 목록 (기본·광각·망원 등) */
  const cams = useRef<MediaDeviceInfo[]>([]);
  const [camIdx, setCamIdx] = useState(0);
  const [camCount, setCamCount] = useState(0);
  const loopId = useRef(0);

  const track = () => stream.current?.getVideoTracks()[0];

  const apply = async (s: CamSettings) => {
    try {
      await track()?.applyConstraints({ advanced: [s as MediaTrackConstraintSet] });
    } catch {
      /* 지원하지 않는 기능은 무시 */
    }
  };

  const stop = () => {
    loopId.current++;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setTorch(false);
  };

  const open = async (deviceId?: string) => {
    const size = { width: { ideal: 1920 }, height: { ideal: 1080 } };
    const s = await navigator.mediaDevices.getUserMedia({
      video: deviceId ? { deviceId: { exact: deviceId }, ...size } : { facingMode: { ideal: 'environment' }, ...size },
      audio: false,
    });
    stream.current = s;
    const v = video.current!;
    v.srcObject = s;
    await v.play();
  };

  /** 후면 카메라 목록. 이름(label)은 카메라 권한을 받은 뒤에만 보인다. */
  const backCameras = async () => {
    const all = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    const back = all.filter((d) => /back|rear|environment|후면/i.test(d.label));
    return back.length ? back : all;
  };

  useEffect(() => stop, []);

  /** index를 주면 그 카메라로, 안 주면 기본(메인) 후면 카메라를 찾아서 켠다 */
  const start = async (index?: number) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('error');
      setError(
        window.isSecureContext
          ? '이 브라우저에서는 카메라 화면을 바로 쓸 수 없어요. 아래 "카메라로 찍기"로 확인해 주세요.'
          : '카메라 화면은 https 주소에서만 쓸 수 있어요. 아래 "카메라로 찍기"로 확인해 주세요.',
      );
      return;
    }
    stop();
    setState('starting');
    const zx = initZxing(); // 인식기를 카메라 켜는 동안 미리 받아 둠
    try {
      if (index !== undefined && cams.current[index]) {
        await open(cams.current[index].deviceId);
        setCamIdx(index);
      } else {
        await open();
        // 브라우저가 초점 고정 광각 카메라를 고르는 경우가 있어서, 메인 카메라로 다시 켠다.
        // 안드로이드 크롬은 보통 "camera2 0, facing back"이 메인 카메라
        const list = await backCameras();
        cams.current = list;
        setCamCount(list.length);
        const current = track()?.getSettings().deviceId;
        const mainIdx = Math.max(0, list.findIndex((d) => /camera2? 0\b/i.test(d.label)));
        if (list[mainIdx] && list[mainIdx].deviceId !== current) {
          try {
            stop();
            await open(list[mainIdx].deviceId);
            setCamIdx(mainIdx);
          } catch {
            await open();
            setCamIdx(Math.max(0, list.findIndex((d) => d.deviceId === current)));
          }
        } else {
          setCamIdx(Math.max(0, list.findIndex((d) => d.deviceId === current)));
        }
      }
      const v = video.current!;

      // 가까이 대면 초점이 안 맞으므로: 자동 초점 켜고, 줌을 2배로 해서 조금 떨어져서 찍게 한다
      const c = ((track()?.getCapabilities?.() ?? {}) as CamCaps) || {};
      setCaps(c);
      const settings: CamSettings = {};
      if (c.focusMode?.includes('continuous')) settings.focusMode = 'continuous';
      if (c.zoom && c.zoom.max >= 2) {
        settings.zoom = Math.max(c.zoom.min, 2);
        setZoom(settings.zoom);
      } else {
        setZoom(null);
      }
      await apply(settings);

      const ready = await zx;
      const zoomText = c.zoom ? `줌 ${settings.zoom ?? 1}배` : '줌 없음';
      const focusText = `초점 ${c.focusMode?.length ? c.focusMode.join('/') : '정보 없음'}`;
      const label = track()?.label.replace(/,? ?facing back/i, '').trim() || '카메라';
      setInfo(
        `${label} · ${v.videoWidth}×${v.videoHeight} · ${[hasNativeDetector() && '기본 인식', ready ? 'ZXing' : 'jsQR'].filter(Boolean).join('+')} · ${zoomText} · ${focusText}`,
      );
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
    const id = ++loopId.current;
    const canvas = document.createElement('canvas');
    let n = 0;
    const tick = async () => {
      const v = video.current;
      if (id !== loopId.current || !stream.current || !v) return;
      if (v.readyState >= 2 && v.videoWidth) {
        n++;
        // 1) 휴대폰 기본 QR 인식으로 원본 화면 통째로 (빠르고 흐린 QR에도 강함)
        let text = await detectNative(v);
        // 2) 없으면 ZXing: 네모 안(70%)을 원본 해상도 그대로, 세 번에 한 번은 화면 전체를 꼼꼼히
        if (!text) {
          const full = n % 3 === 0;
          const side = full ? Math.min(v.videoWidth, v.videoHeight) : Math.min(v.videoWidth, v.videoHeight) * 0.7;
          const target = Math.min(side, full ? 1280 : 1400);
          canvas.width = canvas.height = Math.round(target);
          const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
          ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          text = await decodeImageData(img.data, canvas.width, canvas.height, full);
        }
        if (text && onText(text)) {
          stop();
          setState('idle');
          return;
        }
      }
      setTimeout(tick, 60);
    };
    tick();
  };

  const changeZoom = (z: number) => {
    if (!caps.zoom) return;
    const value = Math.min(caps.zoom.max, Math.max(caps.zoom.min, z));
    setZoom(value);
    apply({ zoom: value });
  };

  /** 화면을 누르면 그 자리에 초점을 다시 맞춘다 (지원하는 휴대폰만) */
  const refocus = (e: React.MouseEvent<HTMLDivElement>) => {
    if (state !== 'scanning') return;
    const r = e.currentTarget.getBoundingClientRect();
    const point = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    const modes = caps.focusMode ?? [];
    const mode = modes.includes('single-shot') ? 'single-shot' : modes.includes('continuous') ? 'continuous' : undefined;
    apply({ ...(mode ? { focusMode: mode } : {}), pointsOfInterest: [point] } as CamSettings);
  };

  const toggleTorch = () => {
    const next = !torch;
    setTorch(next);
    apply({ torch: next });
  };

  const on = state === 'starting' || state === 'scanning';
  return (
    <div className="scanner">
      <div className={`scanner-view${on ? ' scanner-on' : ''}`} onClick={refocus}>
        <video ref={video} playsInline muted />
        {on ? (
          <>
            <span className="scanner-frame" aria-hidden />
            <span className="scanner-hint">QR을 네모 안에 맞춰 주세요. 흐리면 화면을 눌러 초점을 맞추거나 "카메라 바꾸기"를 눌러요</span>
          </>
        ) : (
          <div className="scanner-idle">
            <span className="scanner-icon" aria-hidden>
              📷
            </span>
            <p>복권 용지의 QR 코드를 찍으면 바로 당첨을 맞춰 봐요.</p>
            <button type="button" className="btn btn-gold" onClick={() => start()}>
              카메라 켜기
            </button>
          </div>
        )}
      </div>
      {on && (
        <div className="scanner-tools">
          {caps.zoom && (
            <div className="seg" role="group" aria-label="확대">
              {ZOOMS.filter((z) => z <= (caps.zoom?.max ?? 1)).map((z) => (
                <button key={z} type="button" className={zoom !== null && Math.round(zoom) === z ? 'seg-on' : ''} onClick={() => changeZoom(z)}>
                  {z}배
                </button>
              ))}
            </div>
          )}
          {camCount > 1 && (
            <button type="button" className="chip chip-sm" onClick={() => start((camIdx + 1) % camCount)}>
              🔄 카메라 바꾸기 {camIdx + 1}/{camCount}
            </button>
          )}
          {caps.torch && (
            <button type="button" className={`chip chip-sm${torch ? ' chip-on' : ''}`} onClick={toggleTorch}>
              🔦 플래시
            </button>
          )}
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
        </div>
      )}
      {on && info && <p className="scanner-info">{info}</p>}
      {on && (
        <p className="scanner-tip">
          계속 안 읽히면{' '}
          <button type="button" className="link-btn" onClick={onFallback}>
            📸 사진으로 찍어서 확인
          </button>
        </p>
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
