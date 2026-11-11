import { useApp } from './app-context';
import { useRoute } from './router';
import { InstallButton } from './components/InstallSheet';
import { ShareAppButton } from './components/ShareAppButton';
import { SupportButton } from './components/SupportButton';
import { buildLabel, useUpdateAvailable } from './lib/version';
import { CheckPage } from './pages/CheckPage';
import { HomePage } from './pages/HomePage';
import { ReviewsPage } from './pages/ReviewsPage';
import { SavedPage } from './pages/SavedPage';
import { StatsPage } from './pages/StatsPage';

const TABS = [
  { path: '/', label: '번호 추첨', icon: '🎱' },
  { path: '/check', label: '당첨 확인', icon: '🔍' },
  { path: '/reviews', label: '당첨 후기', icon: '🏆' },
  { path: '/saved', label: '내 번호함', icon: '🗂️' },
  { path: '/stats', label: '통계', icon: '📊' },
];

function page(route: string) {
  switch (route) {
    case '/check':
      return <CheckPage />;
    case '/reviews':
      return <ReviewsPage />;
    case '/saved':
      return <SavedPage />;
    case '/stats':
      return <StatsPage />;
    default:
      return <HomePage />;
  }
}

export function App() {
  const route = useRoute();
  const { toastMsg, saved, round } = useApp();
  const active = TABS.slice(1).find((t) => route.startsWith(t.path))?.path ?? '/';
  const waiting = saved.filter((s) => s.drawNo === round).length;
  const update = useUpdateAvailable();

  return (
    <div className="app">
      <header className="topbar">
        <a href="#/" className="brand">
          <img src="./icon-192.png" alt="" className="brand-icon" />
          로또 찐 명당
        </a>
        <div className="topbar-actions">
          <InstallButton />
          <ShareAppButton />
        </div>
      </header>

      {update && (
        <div className="update-bar" role="status">
          <span>✨ 새 버전이 나왔어요</span>
          <button type="button" className="btn btn-gold" onClick={() => location.reload()}>
            업데이트
          </button>
        </div>
      )}

      <main className="main">{page(route)}</main>

      <footer className="disclaimer">
        재미로 보는 번호예요. 어떤 방법으로 만들어도 모든 번호 조합의 당첨 확률은 같습니다 (1등 8,145,060분의 1).
        <br />
        당첨번호 출처: 동행복권 결과를 모은 공개 데이터 · 정확한 결과는 동행복권(dhlottery.co.kr)에서 확인하세요.
        <br />
        <SupportButton />
        <br />
        <span className="version">버전 {buildLabel()}</span>
      </footer>

      <nav className="tabbar" aria-label="메뉴">
        {TABS.map((t) => (
          <a key={t.path} href={`#${t.path}`} className={`tab${active === t.path ? ' tab-on' : ''}`} aria-current={active === t.path ? 'page' : undefined}>
            <span className="tab-icon" aria-hidden>
              {t.icon}
              {t.path === '/saved' && waiting > 0 && <span className="tab-badge">{waiting}</span>}
            </span>
            {t.label}
          </a>
        ))}
      </nav>

      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
