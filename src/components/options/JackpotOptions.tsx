import { SUPPORT_KAKAOPAY_URL } from '../../lib/config';
import { JACKPOT_GAMES, openJackpot } from '../../lib/jackpot';

/** 대박번호: 개발자 응원하기를 누르면 열린다 */
export function JackpotOptions({ open, pairs }: { open: boolean; pairs: number }) {
  return (
    <div className="jackpot">
      <p className="opt-q">
        역대 1등 번호 중에 6개 가운데 5개가 똑같았던 회차가 {pairs}쌍 있어요. 그 회차들에 나온 번호만 섞어서 한 번에 {JACKPOT_GAMES}게임을 뽑아요. 재미로 보는 번호이고, 당첨 확률은 다른 번호와 같아요.
      </p>
      {open ? (
        <p className="jackpot-open">💛 응원해 주셔서 고마워요! 대박번호가 열렸어요.</p>
      ) : (
        <>
          <a className="btn btn-kakaopay" href={SUPPORT_KAKAOPAY_URL} target="_blank" rel="noopener noreferrer" onClick={openJackpot}>
            ☕ 개발자 응원하고 대박번호 받기
          </a>
          <p className="opt-q">카카오페이 송금 화면으로 넘어가요. 금액은 직접 정하시면 돼요. 돌아오면 대박번호가 열려 있어요.</p>
        </>
      )}
    </div>
  );
}
