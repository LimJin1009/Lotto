import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { currentRound, fetchNewDraws, localDraws } from './lib/draws';
import { syncPush } from './lib/push';
import { addSaved, loadSaved, removeSaved } from './lib/saved';
import type { Draw, GenResult, SavedSet } from './lib/types';

interface AppState {
  draws: Draw[];
  latest: Draw;
  /** 지금 사면 응모되는 회차 */
  round: number;
  now: Date;
  saved: SavedSet[];
  /** 번호함에 저장. drawNo를 안 주면 이번 회차 */
  save: (r: GenResult, drawNo?: number) => void;
  remove: (id: string) => void;
  toast: (msg: string) => void;
  toastMsg: string | null;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppProvider 밖에서 쓰였습니다');
  return v;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [draws, setDraws] = useState<Draw[]>(localDraws);
  const [saved, setSaved] = useState<SavedSet[]>(loadSaved);
  const [now, setNow] = useState(() => new Date());
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchNewDraws(draws).then((d) => alive && d && setDraws(d));
    return () => {
      alive = false;
    };
    // 앱을 열 때 한 번만 확인
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2400);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const latest = draws.at(-1)!;
  const round = currentRound(latest, now);

  // 당첨 알림을 켜 둔 기기면, 추첨 전 회차에 저장한 번호가 바뀔 때마다 서버에 다시 맡긴다
  useEffect(() => {
    const t = setTimeout(() => syncPush(saved, latest.no).catch(() => {}), 800);
    return () => clearTimeout(t);
  }, [saved, latest.no]);

  const save = useCallback(
    (r: GenResult, drawNo = round) => {
      setSaved(addSaved(r, drawNo));
      setToastMsg(`${drawNo}회 번호함에 저장했어요`);
    },
    [round],
  );
  const remove = useCallback((id: string) => setSaved(removeSaved(id)), []);

  const value = useMemo(
    () => ({ draws, latest, round, now, saved, save, remove, toast: setToastMsg, toastMsg }),
    [draws, latest, round, now, saved, save, remove, toastMsg],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
