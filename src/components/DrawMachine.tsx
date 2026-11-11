// 공기식 추첨기 그리기. 번호는 밖에서 먼저 정하고, 여기서는 그 공을 꺼내는 모습만 보여준다.
import { useEffect, useRef } from 'react';
import { useTilt } from '../lib/tilt';
import { BR, C, extractBall, makeWorld, R, SIZE, stepWorld, type PBall } from '../lib/machine';
import { ballColor, ballPalette } from './Ball';

/** 광택 플라스틱 공 한 개를 미리 그려 둔다 (CSS의 .ball과 같은 모양) */
function makeBallSprite(n: number, dpr: number): HTMLCanvasElement {
  const pad = 3;
  const size = (BR + pad) * 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = Math.ceil(size * dpr);
  const c = cv.getContext('2d')!;
  c.scale(dpr, dpr);
  const x = size / 2;
  const y = size / 2;
  const r = BR;
  const p = ballPalette(n);

  // 바닥 그림자
  c.beginPath();
  c.ellipse(x, y + r * 0.92, r * 0.72, r * 0.2, 0, 0, Math.PI * 2);
  c.fillStyle = 'rgba(0,0,0,0.22)';
  c.fill();

  // 구 음영
  const body = c.createRadialGradient(x - r * 0.3, y - r * 0.38, 0, x, y, r);
  body.addColorStop(0, p.light);
  body.addColorStop(0.42, p.base);
  body.addColorStop(1, p.dark);
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = body;
  c.fill();

  // 오른쪽 아래 반사광
  const bounce = c.createRadialGradient(x + r * 0.42, y + r * 0.62, 0, x + r * 0.42, y + r * 0.62, r * 0.55);
  bounce.addColorStop(0, 'rgba(255,255,255,0.35)');
  bounce.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = bounce;
  c.fill();

  // 흰 숫자 원
  const face = c.createRadialGradient(x - r * 0.12, y - r * 0.18, 0, x, y, r * 0.6);
  face.addColorStop(0.55, '#ffffff');
  face.addColorStop(1, '#e3e8ef');
  c.beginPath();
  c.arc(x, y, r * 0.6, 0, Math.PI * 2);
  c.fillStyle = face;
  c.fill();
  c.lineWidth = 0.5;
  c.strokeStyle = 'rgba(0,0,0,0.12)';
  c.stroke();

  c.fillStyle = '#18203a';
  c.font = `800 ${r * 0.78}px 'Pretendard Variable', Pretendard, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(String(n), x - 0.2, y + 0.7);

  // 표면 반사광 (숫자 원 위로도 지나감)
  c.save();
  c.translate(x - r * 0.34, y - r * 0.5);
  c.rotate(-0.5);
  const spec = c.createRadialGradient(0, 0, 0, 0, 0, r * 0.42);
  spec.addColorStop(0, 'rgba(255,255,255,0.95)');
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  c.scale(1, 0.55);
  c.beginPath();
  c.arc(0, 0, r * 0.42, 0, Math.PI * 2);
  c.fillStyle = spec;
  c.fill();
  c.restore();

  // 그림자 쪽 테두리
  c.beginPath();
  c.arc(x, y, r - 0.4, 0, Math.PI * 2);
  c.lineWidth = 0.8;
  c.strokeStyle = 'rgba(0,0,0,0.18)';
  c.stroke();
  return cv;
}

export interface MachineApi {
  setMixing: (on: boolean) => void;
  setFast: (on: boolean) => void;
  /** 해당 번호 공을 출구로 꺼낸다. 관을 빠져나가면 resolve */
  extract: (n: number) => Promise<void>;
  reset: () => void;
}

export function DrawMachine({ apiRef, onShake }: { apiRef: React.RefObject<MachineApi | null>; onShake?: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const world = useRef(makeWorld());
  // 휴대폰을 기울이면 공이 그쪽으로 떨어지고, 흔들면 추첨을 시작함
  const tilt = useTilt((g) => {
    world.current.tx = g.x;
    world.current.ty = g.y;
  }, onShake);

  useEffect(() => {
    apiRef.current = {
      setMixing: (on) => {
        world.current.mixing = on;
      },
      setFast: (on) => {
        world.current.fast = on;
      },
      extract: (n) => extractBall(world.current, n, performance.now()),
      reset: () => {
        const { tx, ty } = world.current;
        world.current = { ...makeWorld(), tx, ty, gx: tx, gy: ty };
      },
    };
  }, [apiRef]);

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext('2d')!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = SIZE * dpr;
    cv.height = SIZE * dpr;
    ctx.scale(dpr, dpr);
    let raf = 0;
    const sprites: HTMLCanvasElement[] = [];
    const paintSprites = () => {
      for (let n = 1; n <= 45; n++) sprites[n] = makeBallSprite(n, dpr);
    };
    paintSprites();
    // 글꼴이 늦게 받아지면 숫자를 다시 그림
    document.fonts?.ready.then(paintSprites);

    const drawBall = (b: PBall) => {
      const color = ballColor(b.n);
      // 빠르게 날아가는 공은 꼬리를 남김
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 4 && !b.out) {
        ctx.beginPath();
        ctx.moveTo(b.x - b.vx * 2.2, b.y - b.vy * 2.2);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = color;
        ctx.globalAlpha = Math.min((sp - 4) / 10, 0.35);
        ctx.lineWidth = BR * 1.6;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      const sprite = sprites[b.n];
      const half = sprite.width / dpr / 2;
      ctx.drawImage(sprite, b.x - half, b.y - half, half * 2, half * 2);
    };

    const draw = () => {
      const w = world.current;
      ctx.clearRect(0, 0, SIZE, SIZE);

      // 출구 관
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(C - 17, -4, 34, C - R + 14, 6);
      ctx.fill();
      ctx.stroke();

      // 유리 통
      const glass = ctx.createRadialGradient(C - 50, C - 60, 10, C, C, R);
      glass.addColorStop(0, 'rgba(255,255,255,0.32)');
      glass.addColorStop(1, 'rgba(255,255,255,0.05)');
      ctx.beginPath();
      ctx.arc(C, C, R, 0, Math.PI * 2);
      ctx.fillStyle = glass;
      ctx.fill();

      // 바람 줄기 (바닥 노즐에서 위로)
      if (w.air > 0.05) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(C, C, R - 2, 0, Math.PI * 2);
        ctx.clip();
        for (let i = 0; i < 9; i++) {
          const x = C + (Math.random() - 0.5) * 90;
          const len = (60 + Math.random() * 170) * w.air;
          const y0 = C + R - 4;
          const grad = ctx.createLinearGradient(x, y0, x, y0 - len);
          grad.addColorStop(0, `rgba(255,255,255,${0.22 * w.air})`);
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.strokeStyle = grad;
          ctx.lineWidth = 2 + Math.random() * 3;
          ctx.beginPath();
          ctx.moveTo(x, y0);
          ctx.lineTo(x + (Math.random() - 0.5) * 30, y0 - len);
          ctx.stroke();
        }
        ctx.restore();
      }

      for (const b of w.balls) if (!b.out) drawBall(b);
      for (const b of w.balls) if (b.out) drawBall(b);

      // 통 테두리와 반사광
      ctx.beginPath();
      ctx.arc(C, C, R, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(C, C, R - 10, Math.PI * 1.1, Math.PI * 1.45);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.stroke();

      // 바닥 노즐
      ctx.fillStyle = w.air > 0.05 ? '#f5b800' : 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.roundRect(C - 14, C + R - 7, 28, 10, 4);
      ctx.fill();
    };

    // 화면 주사율과 관계없이 1초에 60번 계산한다 (느린 기기에서도 같은 속도)
    let last = performance.now();
    let acc = 0;
    const loop = (ts: number) => {
      acc += Math.min(ts - last, 100);
      last = ts;
      while (acc >= 1000 / 60) {
        stepWorld(world.current, performance.now());
        acc -= 1000 / 60;
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <canvas ref={canvas} className="machine-canvas" style={{ width: SIZE, height: SIZE }} role="img" aria-label="로또 추첨기" />
      {tilt.state === 'on' && tilt.live && <p className="tilt-hint">📱 기울이면 공이 굴러가고, 흔들면 추첨해요</p>}
      {tilt.state === 'need-permission' && navigator.maxTouchPoints > 0 && (
        <button type="button" className="tilt-hint tilt-btn" onClick={tilt.enable}>
          📱 기울여 공 굴리기·흔들어 뽑기 켜기
        </button>
      )}
    </>
  );
}
