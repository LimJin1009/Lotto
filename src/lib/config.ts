// 당첨 인증 후기 서버 주소 (Cloudflare Workers)
// 서버 코드: worker/, 올리기·관리: docs/후기서버.md
// 비어 있으면 후기 기능은 "준비 중"으로 보인다.
export const REVIEWS_API = 'https://lotto-reviews.lottojjin.workers.dev';

// 당첨 알림 서명 공개키 (서버 worker/wrangler.toml 의 VAPID_PUBLIC 과 같아야 함)
export const VAPID_PUBLIC_KEY = 'BGWjqDTlWkuJON7Z5tzuK_xvKc8w-vcXlWC9hq9TZsLpFGhguqIOCNDPQyrPpdXsvvpGwA6dIyHfRCZnNXwYd9I';

// 친구에게 알려주기로 보내는 앱 주소
export const SITE_URL = 'https://limjin1009.github.io/Lotto/';
