// 공기식 추첨기 그리기. 번호는 밖에서 먼저 정하고, 여기서는 그 공을 꺼내는 모습만 보여준다.
import { useEffect, useRef } from 'react';
import { BR, C, extractBall, makeWorld, R, SIZE, stepWorld, type PBall } from '../lib/machine';
import { ballColor } from './Ball';

export interface MachineApi {
  setMixing: (on: boolean) => void;
  setFast: (on: boolean) => void;
  /** 해당 번호 공을 출구로 꺼낸다. 관을 빠져나가면 resolve */
  extract: (n: number) => Promise<void>;
  reset: () => void;
}

export function DrawMachine({ apiRef }: { apiRef: React.RefObject<MachineApi | null> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const world = useRef(makeWorld());

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
        world.current = makeWorld();
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
      // 실제 로또 공처럼: 색 공 + 가운데 흰 원 + 숫자
      const g = ctx.createRadialGradient(b.x - 5, b.y - 6, 1, b.x, b.y, BR);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.35, color);
      g.addColorStop(1, color);
      ctx.beginPath();
      ctx.arc(b.x, b.y, BR, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x, b.y, 7.6, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.fillStyle = '#1f2a44';
      ctx.font = '800 9.5px Pretendard Variable, Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(b.n), b.x, b.y + 0.5);
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

  return <canvas ref={canvas} className="machine-canvas" style={{ width: SIZE, height: SIZE }} role="img" aria-label="로또 추첨기" />;
}
