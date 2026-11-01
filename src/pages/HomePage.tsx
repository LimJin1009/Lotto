import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app-context';
import { Ball, BallRow } from '../components/Ball';
import { DrawMachine, type MachineApi } from '../components/DrawMachine';
import { DreamOptions, type DreamChoice } from '../components/options/DreamOptions';
import { PersonalOptions } from '../components/options/PersonalOptions';
import { StatsOptions } from '../components/options/StatsOptions';
import { pushResult, ResultList } from '../components/ResultCard';
import { dreamNumbers } from '../lib/dream';
import { drawTime, formatDate, rankOf } from '../lib/draws';
import { extractPicks, personalNumbers, type PersonalInput } from '../lib/personal';
import { randInt, randomNumbers } from '../lib/random';
import { statsNumbers, type StatsStrategy } from '../lib/stats';
import type { Draw, GenResult } from '../lib/types';

type Mode = 'random' | 'dream' | 'personal' | 'stats';

const MODES: { id: Mode; emoji: string; label: string }[] = [
  { id: 'dream', emoji: '🌙', label: '꿈 해몽' },
  { id: 'personal', emoji: '🎂', label: '나만의 숫자' },
  { id: 'stats', emoji: '📈', label: '통계' },
  { id: 'random', emoji: '🎱', label: '자동 추첨' },
];

const SOON = ['🔮 오늘의 운세', '✍️ 이름·소원 문장', '💞 궁합 번호', '📷 복권 QR 확인', '🏆 당첨 인증 후기'];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomResult(): GenResult {
  const numbers = randomNumbers(6).sort((a, b) => a - b);
  const reasons: Record<number, string> = {};
  for (const n of numbers) reasons[n] = '자동 추첨으로 나온 공';
  return { method: 'machine', emoji: '🎱', title: '자동 추첨 번호', numbers, reasons };
}

function countdown(ms: number) {
  if (ms <= 0) return '추첨 중';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${d > 0 ? `${d}일 ` : ''}${hh}:${mm}:${ss}`;
}

function Countdown() {
  const { latest, round, now } = useApp();
  const left = drawTime(round, latest).getTime() - now.getTime();
  return (
    <section className="countdown">
      <span>
        제 <b>{round}</b>회 추첨까지
      </span>
      <strong>{countdown(left)}</strong>
    </section>
  );
}

function LatestDraw({ latest }: { latest: Draw }) {
  const { saved } = useApp();
  const mine = saved.filter((s) => s.drawNo === latest.no);
  const best = mine
    .map((s) => rankOf(s.numbers, latest))
    .filter((r) => r > 0)
    .sort((a, b) => a - b)[0];
  return (
    <section className="card">
      <div className="card-head">
        <h2>
          {latest.no}회 당첨번호 <small>{formatDate(latest.date)}</small>
        </h2>
        <a href="#/stats" className="link-btn">
          통계 보기
        </a>
      </div>
      <BallRow nums={latest.nums} bonus={latest.bonus} />
      {mine.length > 0 && (
        <a href="#/saved" className={`my-result${best ? ' my-result-win' : ''}`}>
          {best ? `🎉 내 번호 중 ${best}등이 있어요!` : `내 번호 ${mine.length}게임은 아쉽게 낙첨이에요`}
          <span>확인 →</span>
        </a>
      )}
    </section>
  );
}

export function HomePage() {
  const { draws, latest } = useApp();
  const [mode, setMode] = useState<Mode>('dream');
  const [dream, setDream] = useState<DreamChoice>({ dream: null, sit: null });
  const [personal, setPersonal] = useState<PersonalInput[]>([{ kind: 'birthday', value: '' }]);
  const [strategy, setStrategy] = useState<StatsStrategy>('hot');

  const api = useRef<MachineApi | null>(null);
  const machineBox = useRef<HTMLElement>(null);
  const run = useRef(0);
  const fast = useRef(false);
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<GenResult | null>(null);
  const [drawn, setDrawn] = useState<number[]>([]);
  const [results, setResults] = useState<GenResult[]>([]);

  useEffect(
    () => () => {
      run.current++; // 화면을 떠나면 진행 중인 추첨을 멈춤
    },
    [],
  );

  const usablePersonal = personal.filter((i) => extractPicks(i).length > 0);
  const notReady =
    mode === 'dream' && !dream.dream ? '꿈을 먼저 골라 주세요' : mode === 'personal' && usablePersonal.length === 0 ? '숫자를 먼저 넣어 주세요' : null;

  const build = (): GenResult => {
    if (mode === 'dream' && dream.dream) return dreamNumbers(dream.dream, dream.sit ?? undefined);
    if (mode === 'personal') return personalNumbers(usablePersonal);
    if (mode === 'stats') return statsNumbers(draws, strategy);
    return randomResult();
  };

  const start = async () => {
    const m = api.current;
    if (!m || notReady) return;
    const id = ++run.current;
    // 번호는 추첨 전에 이미 정해 둔다. 추첨기는 그 공을 꺼내는 모습을 보여줄 뿐이다.
    const r = build();
    fast.current = false;
    m.reset();
    m.setFast(false);
    setCurrent(r);
    setDrawn([]);
    setRunning(true);
    machineBox.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    m.setMixing(true);
    await wait(1900);
    for (const n of shuffle(r.numbers)) {
      if (run.current !== id) return;
      if (!fast.current) await wait(500);
      if (run.current !== id) return;
      await m.extract(n);
      if (run.current !== id) return;
      setDrawn((d) => [...d, n]);
    }
    m.setMixing(false);
    setResults((l) => pushResult(l, r));
    setRunning(false);
  };

  const skip = () => {
    fast.current = true;
    api.current?.setFast(true);
  };

  return (
    <div className="stack">
      <Countdown />

      <section className="card picker">
        <h2>어떤 방식으로 뽑을까요?</h2>
        <div className="modes" role="tablist">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              className={`mode${mode === m.id ? ' mode-on' : ''}`}
              onClick={() => setMode(m.id)}
              disabled={running}
            >
              <span className="mode-emoji" aria-hidden>
                {m.emoji}
              </span>
              {m.label}
            </button>
          ))}
        </div>
        {mode === 'random' && <p className="opt-q">아무것도 넣지 않고 추첨기가 공 6개를 자동으로 뽑아요.</p>}
        {mode === 'dream' && <DreamOptions value={dream} onChange={setDream} />}
        {mode === 'personal' && <PersonalOptions value={personal} onChange={setPersonal} />}
        {mode === 'stats' && <StatsOptions value={strategy} onChange={setStrategy} lastNo={latest.no} />}
      </section>

      <section className="machine" ref={machineBox}>
        <div className="machine-title">{running && current ? `${current.emoji} ${current.title}` : '로또 찐번호 추첨기'}</div>
        <DrawMachine apiRef={api} />
        <div className="tray" aria-live="polite">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="tray-slot">
              {drawn[i] !== undefined ? <Ball n={drawn[i]} pop={0} /> : i + 1}
            </span>
          ))}
        </div>
        {running ? (
          <button type="button" className="btn btn-ghost" onClick={skip}>
            빨리 감기 ⏩
          </button>
        ) : (
          <button type="button" className="btn btn-gold btn-big" onClick={start} disabled={!!notReady}>
            {notReady ?? (results.length ? '한 게임 더 추첨' : '추첨 시작')}
          </button>
        )}
      </section>

      <ResultList results={results} onClear={() => setResults([])} />

      <LatestDraw latest={latest} />

      <div className="soon">
        <span className="soon-label">준비 중</span>
        {SOON.map((s) => (
          <span key={s} className="chip chip-soon">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
