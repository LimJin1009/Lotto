// 휴대폰 기울기·흔들기 읽기: 추첨기 공이 휴대폰을 기울인 쪽으로 굴러가고, 흔들면 추첨을 시작한다.
// 안드로이드는 바로 되고, 아이폰은 한 번 "허용"을 눌러야 한다 (사파리 규칙).
import { useCallback, useEffect, useRef, useState } from 'react';
import { tiltGravity } from './machine';
import { makeShakeDetector } from './shake';

type OrientationCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };
type MotionCtor = typeof DeviceMotionEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

export type TiltState = 'unsupported' | 'need-permission' | 'on' | 'denied';

const KEY = 'lotto.tilt';

function screenAngle(): number {
  return screen.orientation?.angle ?? (typeof window.orientation === 'number' ? window.orientation : 0);
}

/** onTilt 에 화면 기준 중력 방향을 계속 넘겨주고, 휴대폰을 흔들면 onShake 를 부른다 */
export function useTilt(onTilt: (g: { x: number; y: number }) => void, onShake?: () => void) {
  const cb = useRef(onTilt);
  cb.current = onTilt;
  const shakeCb = useRef(onShake);
  shakeCb.current = onShake;
  const Ctor = (typeof window !== 'undefined' ? window.DeviceOrientationEvent : undefined) as OrientationCtor | undefined;
  const needsAsk = !!Ctor && typeof Ctor.requestPermission === 'function';

  const [state, setState] = useState<TiltState>(() => {
    if (!Ctor) return 'unsupported';
    if (!needsAsk) return 'on';
    try {
      // 아이폰: 예전에 허용했으면 다시 묻지 않고 켜 본다 (안 되면 버튼이 다시 보임)
      return localStorage.getItem(KEY) === 'granted' ? 'on' : 'need-permission';
    } catch {
      return 'need-permission';
    }
  });

  // 실제로 기울기 값이 들어온 적이 있는지 (컴퓨터는 값이 안 와서 안내를 숨김)
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (state !== 'on') return;
    const onEvent = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      setLive(true);
      const g = tiltGravity(e.beta, e.gamma, screenAngle());
      if (g) cb.current(g);
    };
    const isShake = makeShakeDetector();
    const onMotion = (e: DeviceMotionEvent) => {
      const pure = e.acceleration;
      const a = pure && pure.x != null ? pure : e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      if (isShake({ x: a.x, y: a.y, z: a.z }, e.timeStamp, a !== pure) && document.visibilityState === 'visible') shakeCb.current?.();
    };
    window.addEventListener('deviceorientation', onEvent);
    window.addEventListener('devicemotion', onMotion);
    return () => {
      window.removeEventListener('deviceorientation', onEvent);
      window.removeEventListener('devicemotion', onMotion);
    };
  }, [state]);

  const enable = useCallback(async () => {
    if (!Ctor?.requestPermission) return;
    try {
      const r = await Ctor.requestPermission();
      // 흔들기(움직임 센서)도 같이 허용받는다. 아이폰은 한 번 물어본 답을 그대로 돌려준다
      const Motion = window.DeviceMotionEvent as MotionCtor | undefined;
      await Motion?.requestPermission?.().catch(() => {});
      setState(r === 'granted' ? 'on' : 'denied');
      try {
        localStorage.setItem(KEY, r);
      } catch {
        /* 무시 */
      }
    } catch {
      setState('denied');
    }
  }, [Ctor]);

  return { state, live, enable };
}
