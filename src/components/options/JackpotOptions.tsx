import { useState, type ReactNode } from 'react';
import { SUPPORT_KAKAOPAY_URL } from '../../lib/config';
import { JACKPOT_GAMES, openJackpot } from '../../lib/jackpot';

// 응원을 권하는 말. 볼 때마다 다른 말이 나온다 (당첨이 더 잘 된다고는 말하지 않는다)
const PITCHES: ReactNode[] = [
  <>
    개발자가 역대 1등 번호를 1회부터 전부 뒤져서 <b>공들여 고른 번호</b>예요. 아무에게나 드리지 않아요. 응원해 주신 분께만 {JACKPOT_GAMES}게임을 선별해 드려요.
  </>,
  <>
    자동 번호는 누구나 받아요. 대박번호는 개발자가 <b>따로 아껴 둔 번호</b>예요. 응원 한 번에 {JACKPOT_GAMES}게임, 지금 열어 보세요.
  </>,
  <>
    커피 한 잔이면 돼요 ☕ 개발자가 밤새 당첨번호를 파헤쳐 찾아낸 조합에서 <b>{JACKPOT_GAMES}게임을 꺼내 드려요.</b>
  </>,
  <>
    1등 번호끼리 5개나 겹쳤던 순간들이 있었어요. <b>그 번호들만 모아</b> 개발자가 직접 조합했어요. 응원해 주시면 {JACKPOT_GAMES}게임을 선별해 드려요.
  </>,
  <>
    이번 주는 느낌이 좋다면, 번호도 특별하게 받아 보세요. <b>개발자가 직접 고른 {JACKPOT_GAMES}게임</b>을 응원해 주신 분께만 드려요.
  </>,
  <>
    복권 한 장 값보다 적은 커피 한 잔으로, 개발자가 <b>제일 아끼는 번호 {JACKPOT_GAMES}게임</b>을 받아 가세요. 여기서만 드려요.
  </>,
];

/** 대박번호: 개발자 응원하기를 누르면 열리고, 10게임을 받으면 다시 잠긴다 */
export function JackpotOptions({ open, uses, pairs }: { open: boolean; uses: number; pairs: number }) {
  const [first] = useState(() => Math.floor(Math.random() * PITCHES.length));
  return (
    <div className="jackpot">
      {uses > 0 && !open ? (
        <p className="jackpot-pitch">
          대박번호 {JACKPOT_GAMES}게임 잘 받으셨나요? 💛 <b>한 번 더 응원하면</b> 새로운 {JACKPOT_GAMES}게임을 또 선별해 드려요.
        </p>
      ) : (
        <p className="jackpot-pitch">{PITCHES[(first + uses) % PITCHES.length]}</p>
      )}
      {open ? (
        <p className="jackpot-open">💛 응원해 주셔서 고마워요! 선별한 대박번호 {JACKPOT_GAMES}게임, 아래 추첨 버튼으로 받아 가세요.</p>
      ) : (
        <>
          <a className="btn btn-kakaopay" href={SUPPORT_KAKAOPAY_URL} target="_blank" rel="noopener noreferrer" onClick={openJackpot}>
            ☕ 커피 한 잔 응원하고 {JACKPOT_GAMES}게임 {uses > 0 ? '더 ' : ''}받기
          </a>
          <p className="opt-q">카카오페이 송금 화면으로 넘어가요. 금액은 직접 정하시면 돼요. 돌아오면 대박번호가 열려 있어요.</p>
        </>
      )}
      <p className="opt-q">
        역대 1등 번호 중 6개 가운데 5개가 똑같았던 회차 {pairs}쌍의 번호로 조합해요. 재미로 보는 번호이고, 당첨 확률은 다른 번호와 같아요.
      </p>
    </div>
  );
}
