// 당첨 인증 후기 서버 (Supabase) 연결 정보
// Supabase 대시보드 → Project Settings → API 에서 복사한다.
// - URL: Project URL
// - ANON_KEY: anon public 키 (공개해도 되는 키. 권한은 supabase/schema.sql 규칙으로 막혀 있음)
// 비어 있으면 후기 기능은 "준비 중"으로 보인다.
// ⚠️ service_role 키는 절대 여기에 넣지 않는다 (GitHub Secrets 에만).
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';
