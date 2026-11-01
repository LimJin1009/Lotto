import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider } from './app-context';
import { App } from './App';
import './styles.css';

// 배포된 사이트에서만 서비스 워커를 켠다 (개발 중에는 저장본 때문에 헷갈리지 않게)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* 등록 실패해도 앱은 그대로 동작 */
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
