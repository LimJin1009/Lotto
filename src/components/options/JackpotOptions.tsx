import { SUPPORT_KAKAOPAY_URL } from '../../lib/config';
import { JACKPOT_GAMES, openJackpot } from '../../lib/jackpot';

/** 대박번호: 개발자 응원하기를 누르면 열린다 */
export function JackpotOptions({ open, pairs }: { open: boolean; pairs: number }) {
  return (
    <div className="jackpot">
      <p className="jackpot-pitch">
        개발자가 역대 1등 번호를 1회부터 전부 뒤져서 직접 조합한 <b>강력한 번호</b>예요. 아무에게나 드리지 않아요. 응원해 주신 분께만 {JACKPOT_GAMES}게임을 선별해 드려요.
      </p>
      {open ? (
        <p className="jackpot-open">💛 응원해 주셔서 고마워요! 선별한 대박번호 {JACKPOT_GAMES}게임, 아래 추첨 버튼으로 받아 가세요.</p>
      ) : (
        <>
          <a className="btn btn-kakaopay" href={SUPPORT_KAKAOPAY_URL} target="_blank" rel="noopener noreferrer" onClick={openJackpot}>
            ☕ 커피 한 잔 응원하고 {JACKPOT_GAMES}게임 받기
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
