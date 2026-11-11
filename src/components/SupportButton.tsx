import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SUPPORT_KAKAOPAY_URL } from '../lib/config';
import { openJackpot } from '../lib/jackpot';

/** 화면 맨 아래 "개발자 응원하기". 자발적 응원만 받는다. 누르면 대박번호 받기가 열린다 (실제로 보냈는지는 확인하지 않음) */
export function SupportButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="support-link" onClick={() => setOpen(true)}>
        ☕ 개발자 응원하기
      </button>
      {open &&
        createPortal(
          <div className="sheet-back" onClick={() => setOpen(false)}>
            <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="support-title" onClick={(e) => e.stopPropagation()}>
              <div className="sheet-icon support-icon" aria-hidden>
                ☕
              </div>
              <h2 id="support-title">개발자 응원하기</h2>
              <p className="muted-text">
                로또 찐 번호는 광고 없이 무료로 운영돼요. 쓰면서 즐거우셨다면 커피 한 잔으로, 당첨되셨다면 크게 응원해 주세요^^ 응원하면 '대박번호 받기'가 열려요. 나머지 기능은 응원하지 않아도 똑같이 쓸 수 있어요.
              </p>
              <div className="sheet-actions">
                <a className="btn btn-kakaopay" href={SUPPORT_KAKAOPAY_URL} target="_blank" rel="noopener noreferrer" onClick={openJackpot}>
                  카카오페이로 응원하기
                </a>
                <button type="button" className="btn" onClick={() => setOpen(false)}>
                  닫기
                </button>
              </div>
              <p className="push-note">카카오페이 송금 화면으로 넘어가요. 금액은 직접 정하시면 돼요.</p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
