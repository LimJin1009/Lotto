import { MethodGrid } from '../components/MethodGrid';

export function MakePage() {
  return (
    <div className="stack">
      <div className="page-head">
        <h1>번호 만들기</h1>
        <p>만든 번호마다 왜 그 숫자가 나왔는지 알려드려요.</p>
      </div>
      <MethodGrid showSoon />
    </div>
  );
}

export function BackLink() {
  return (
    <a href="#/make" className="back">
      ← 번호 만들기
    </a>
  );
}
