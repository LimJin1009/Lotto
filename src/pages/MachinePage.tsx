import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app-context';
import { Ball } from '../components/Ball';
import { DrawMachine, type MachineApi } from '../components/DrawMachine';
import { pushResult, ResultList } from '../components/ResultCard';
import { randomNumbers } from '../lib/random';
import type { GenResult } from '../lib/types';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Phase = 'idle' | 'running' | 'done';

export function MachinePage() {
  const { round } = useApp();
  const api = useRef<MachineApi | null>(null);
  const run = useRef(0);
  const fast = useRef(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [drawn, setDrawn] = useState<number[]>([]);
  const [results, setResults] = useState<GenResult[]>([]);

  useEffect(
    () => () => {
      run.current++; // 화면을 떠나면 진행 중인 추첨을 멈춤
    },
    [],
  );

  const start = async () => {
    const id = ++run.current;
    const m = api.current!;
    fast.current = false;
    m.reset();
    setDrawn([]);
    setPhase('running');
    // 번호는 추첨 전에 이미 정해 둔다. 애니메이션은 이 번호를 꺼내는 모습일 뿐이다.
    const picks = randomNumbers(7);
    m.setMixing(true);
    await wait(1800);
    for (let i = 0; i < 7; i++) {
      if (run.current !== id) return;
      if (!fast.current) await wait(i === 6 ? 1600 : 700);
      if (run.current !== id) return;
      await m.extract(picks[i]);
      setDrawn((d) => [...d, picks[i]]);
    }
    if (run.current !== id) return;
    m.setMixing(false);
    const main = picks.slice(0, 6).sort((a, b) => a - b);
    const reasons: Record<number, string> = {};
    picks.slice(0, 6).forEach((n, i) => (reasons[n] = `${i + 1}번째로 나온 공`));
    setResults((l) =>
      pushResult(l, {
        method: 'machine',
        emoji: '🎱',
        title: `${round}회 추첨기 번호`,
        numbers: main,
        reasons,
        note: `보너스 공은 ${picks[6]}번이 나왔어요. (실제 로또는 6개만 고르면 돼요)`,
      }),
    );
    setPhase('done');
  };

  return (
    <div className="stack">
      <div className="page-head">
        <h1>🎱 추첨기</h1>
        <p>버튼을 누르면 45개의 공이 섞이고 7개가 차례로 나와요.</p>
      </div>

      <section className="machine">
        <DrawMachine apiRef={api} />
        <div className="tray" aria-live="polite">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className={`tray-slot${i === 6 ? ' tray-bonus' : ''}`}>
              {drawn[i] !== undefined ? <Ball n={drawn[i]} pop={0} /> : i === 6 ? '보너스' : i + 1}
            </span>
          ))}
        </div>
        {phase === 'running' ? (
          <button type="button" className="btn btn-ghost" onClick={() => (fast.current = true)}>
            빨리 감기 ⏩
          </button>
        ) : (
          <button type="button" className="btn btn-gold btn-big" onClick={start}>
            {phase === 'done' ? '한 번 더 추첨' : '추첨 시작'}
          </button>
        )}
      </section>

      <ResultList results={results} onClear={() => setResults([])} />
    </div>
  );
}
