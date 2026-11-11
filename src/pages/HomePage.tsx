import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app-context';
import { Ball, BallRow } from '../components/Ball';
import { DrawMachine, type MachineApi } from '../components/DrawMachine';
import { DreamOptions, type DreamChoice } from '../components/options/DreamOptions';
import { FilterOptions } from '../components/options/FilterOptions';
import { JackpotOptions } from '../components/options/JackpotOptions';
import { PersonalOptions } from '../components/options/PersonalOptions';
import { StatsOptions } from '../components/options/StatsOptions';
import { WishOptions } from '../components/options/WishOptions';
import { pushResult, ResultList } from '../components/ResultCard';
import { DREAMS, dreamNumbers } from '../lib/dream';
import { drawTime, formatDate, rankOf } from '../lib/draws';
import { isJackpotOpen, JACKPOT_GAMES, jackpotNumbers, jackpotPool, onJackpotOpen } from '../lib/jackpot';
import { extractPicks, personalNumbers, type PersonalInput } from '../lib/personal';
import { applyFilter, loadFilter, saveFilter, type PickFilter } from '../lib/picks';
import { randInt, randomNumbers } from '../lib/random';
import { statsNumbers, type StatsStrategy } from '../lib/stats';
import { normalizeWish, wishNumbers } from '../lib/wish';
import type { Draw, GenResult } from '../lib/types';

type Mode = 'random' | 'dream' | 'personal' | 'wish' | 'stats' | 'jackpot';

const MODES: { id: Mode; emoji: string; label: string }[] = [
  { id: 'random', emoji: '🎱', label: '자동 추첨' },
  { id: 'dream', emoji: '🌙', label: '꿈 해몽' },
  { id: 'personal', emoji: '🎂', label: '나만의 숫자' },
  { id: 'wish', emoji: '✍️', label: '이름·소원' },
  { id: 'stats', emoji: '📈', label: '통계' },
];

/** 한 번에 뽑는 게임 수 (복권 한 장 = 5게임) */
const MAX_GAMES = 5;
const GAMES_KEY = 'lotto.games';

function loadGames(): number {
  try {
    const n = Number(localStorage.getItem(GAMES_KEY));
    return n >= 1 && n <= MAX_GAMES ? n : 1;
  } catch {
    return 1;
  }
}

function GamePicker({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled: boolean }) {
  return (
    <fieldset className="game-pick" disabled={disabled}>
      <legend>몇 게임 뽑을까요?</legend>
      {Array.from({ length: MAX_GAMES }, (_, i) => {
        const n = i + 1;
        return (
          <label key={n} className={`game-box${n <= value ? ' game-on' : ''}`}>
            <input
              type="checkbox"
              checked={n <= value}
              // 켜진 맨 끝 칸을 다시 누르면 한 칸 줄인다
              onChange={() => onChange(n === value && n > 1 ? n - 1 : n)}
            />
            <span aria-hidden>{n <= value ? '✓' : ''}</span>
            {n}게임
          </label>
        );
      })}
    </fieldset>
  );
}

const SOON = ['🔮 오늘의 운세', '💞 궁합 번호', '🎬 추첨 영상 저장'];

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
  // 꿈 페이지의 "추첨기로 뽑기"에서 오면 (#/?dream=pig) 꿈 해몽에 그 꿈이 골라진 채로 시작
  const [dream, setDream] = useState<DreamChoice>(() => {
    const id = new URLSearchParams(location.hash.split('?')[1] ?? '').get('dream');
    return { dream: DREAMS.find((d) => d.id === id) ?? null, sit: null };
  });
  const [mode, setMode] = useState<Mode>(() => (dream.dream ? 'dream' : 'random'));
  const [games, setGamesState] = useState(loadGames);
  const setGames = (n: number) => {
    setGamesState(n);
    try {
      localStorage.setItem(GAMES_KEY, String(n));
    } catch {
      /* 저장 못 해도 이번엔 그대로 씀 */
    }
  };
  const [personal, setPersonal] = useState<PersonalInput[]>([{ kind: 'birthday', value: '' }]);
  const [strategy, setStrategy] = useState<StatsStrategy>('hot');
  const [wish, setWish] = useState('');
  const [filter, setFilterState] = useState<PickFilter>(loadFilter);
  const setFilter = (f: PickFilter) => {
    setFilterState(f);
    saveFilter(f);
  };
  // 대박번호는 개발자 응원하기를 누르면 열린다
  const [jackpotOpen, setJackpotOpen] = useState(isJackpotOpen);
  useEffect(() => onJackpotOpen(() => setJackpotOpen(true)), []);

  const api = useRef<MachineApi | null>(null);
  const machineBox = useRef<HTMLElement>(null);
  const run = useRef(0);
  // 이번 추첨에서 뽑을 게임들과, 결과 목록에 이미 넣은 개수
  const batch = useRef<{ list: GenResult[]; done: number }>({ list: [], done: 0 });
  const [running, setRunning] = useState(false);
  const [gameNo, setGameNo] = useState(0);
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
    mode === 'dream' && !dream.dream ? '꿈을 먼저 골라 주세요' : mode === 'personal' && usablePersonal.length === 0
        ? '숫자를 먼저 넣어 주세요'
        : mode === 'wish' && !normalizeWish(wish)
          ? '문장을 먼저 써 주세요'
          : mode === 'jackpot' && !jackpotOpen
            ? '응원하면 대박번호가 열려요'
            : null;

  // 대박번호는 늘 10게임이고, 고정수·제외수를 쓰지 않는다 (쌍둥이 회차 번호만 나와야 하므로)
  const jackpot = mode === 'jackpot';
  const count = jackpot ? JACKPOT_GAMES : games;

  const build = (game: number): GenResult => {
    if (mode === 'dream' && dream.dream) return dreamNumbers(dream.dream, dream.sit ?? undefined);
    if (mode === 'personal') return personalNumbers(usablePersonal);
    if (mode === 'wish') return wishNumbers(wish, game);
    if (mode === 'stats') return statsNumbers(draws, strategy);
    if (mode === 'jackpot') return jackpotNumbers(draws);
    return randomResult();
  };

  const start = async () => {
    const m = api.current;
    if (!m || notReady) return;
    const id = ++run.current;
    // 번호는 추첨 전에 이미 정해 둔다. 추첨기는 그 공을 꺼내는 모습을 보여줄 뿐이다.
    const list = Array.from({ length: count }, (_, g) => (jackpot ? build(g) : applyFilter(build(g), filter)));
    batch.current = { list, done: 0 };
    setRunning(true);
    machineBox.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    for (let g = 0; g < list.length; g++) {
      const r = list[g];
      m.reset();
      m.setFast(false);
      setGameNo(g + 1);
      setCurrent(r);
      setDrawn([]);
      m.setMixing(true);
      await wait(g === 0 ? 1900 : 1100);
      for (const n of shuffle(r.numbers)) {
        if (run.current !== id) return;
        await wait(500);
        if (run.current !== id) return;
        await m.extract(n);
        if (run.current !== id) return;
        setDrawn((d) => [...d, n]);
      }
      m.setMixing(false);
      setResults((l) => pushResult(l, r));
      batch.current.done = g + 1;
      if (g < list.length - 1) {
        await wait(900);
        if (run.current !== id) return;
      }
    }
    setRunning(false);
  };

  // 휴대폰을 흔들면 추첨 시작 (추첨 중이거나 입력이 덜 됐으면 아무 일도 없음)
  const shake = useRef(() => {});
  shake.current = () => {
    if (!running) start();
  };

  // 바로 뽑기: 남은 공과 남은 게임을 기다리지 않고 한 번에 보여 준다
  const instant = () => {
    const { list, done } = batch.current;
    run.current++;
    const rest = list.slice(done);
    setResults((l) => rest.reduce(pushResult, l));
    batch.current.done = list.length;
    const last = list[list.length - 1];
    if (last) {
      setCurrent(last);
      setGameNo(list.length);
      setDrawn(last.numbers);
    }
    api.current?.reset();
    api.current?.setMixing(false);
    setRunning(false);
  };

  return (
    <div className="stack">
      <Countdown />

      <section className="card picker">
        <button
          type="button"
          aria-pressed={jackpot}
          className={`jackpot-cta${jackpot ? ' jackpot-cta-on' : ''}`}
          onClick={() => setMode('jackpot')}
          disabled={running}
        >
          <strong>
            <span aria-hidden>💰</span> 대박번호 받기 {!jackpotOpen && <span aria-label="잠김">🔒</span>}
          </strong>
          <span>개발자가 공들여 고른 번호 10게임</span>
        </button>
        {jackpot && <JackpotOptions open={jackpotOpen} pairs={jackpotPool(draws).pairs} />}
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
        {mode === 'wish' && <WishOptions value={wish} onChange={setWish} />}
        {mode === 'stats' && <StatsOptions value={strategy} onChange={setStrategy} lastNo={latest.no} />}
        {!jackpot && <FilterOptions value={filter} onChange={setFilter} disabled={running} />}
        {!jackpot && <GamePicker value={games} onChange={setGames} disabled={running} />}
      </section>

      <section className="machine" ref={machineBox}>
        <div className="machine-title">
          {running && current
            ? `${current.emoji} ${current.title}${batch.current.list.length > 1 ? ` · ${gameNo}/${batch.current.list.length}게임` : ''}`
            : '로또 찐 번호 추첨기'}
        </div>
        <DrawMachine apiRef={api} onShake={() => shake.current()} />
        <div className="tray" aria-live="polite">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="tray-slot">
              {drawn[i] !== undefined ? <Ball n={drawn[i]} pop={0} /> : i + 1}
            </span>
          ))}
        </div>
        {running ? (
          <button type="button" className="btn btn-ghost" onClick={instant}>
            바로 뽑기 ⚡
          </button>
        ) : (
          <button type="button" className="btn btn-gold btn-big" onClick={start} disabled={!!notReady}>
            {notReady ?? `${count}게임 ${results.length ? '더 ' : ''}추첨${results.length ? '' : ' 시작'}`}
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
