import type { ReactNode } from 'react';
import { SUPPORT_KAKAOPAY_URL } from '../../lib/config';
import { JACKPOT_GAMES, openJackpot } from '../../lib/jackpot';

// 응원을 권하는 말 (당첨이 더 잘 된다고는 말하지 않는다)
const PITCH: ReactNode = (
  <>
    이번 주는 느낌이 좋다면, 번호도 특별하게 받아 보세요. <b>개발자가 직접 고른 {JACKPOT_GAMES}게임</b>을 응원해 주신 분께만 드려요.
  </>
);

/** 대박번호: 개발자 응원하기를 누르면 열리고, 10게임을 받으면 다시 잠긴다 */
export function JackpotOptions({ open, uses, pairs }: { open: boolean; uses: number; pairs: number }) {
  return (
    <div className="jackpot">
      {uses > 0 && !open ? (
        <p className="jackpot-pitch">
          대박번호 {JACKPOT_GAMES}게임 잘 받으셨나요? 💛 <b>한 번 더 응원하면</b> 새로운 {JACKPOT_GAMES}게임을 또 선별해 드려요.
        </p>
      ) : (
        <p className="jackpot-pitch">{PITCH}</p>
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
