import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SUPPORT_KAKAOPAY_URL } from '../lib/config';

/** 화면 맨 아래 "개발자 응원하기". 번호·당첨·후기와는 연결하지 않는 순수한 자발적 응원 */
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
                로또 찐번호는 광고 없이 무료로 운영돼요. 쓰면서 즐거우셨다면 커피 한 잔으로 응원해 주세요. 응원하지 않아도 모든 기능은 똑같이 쓸 수 있어요.
              </p>
              <div className="sheet-actions">
                <a className="btn btn-kakaopay" href={SUPPORT_KAKAOPAY_URL} target="_blank" rel="noopener noreferrer">
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
