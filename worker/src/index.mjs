// 로또 찐번호 후기 서버 진입 파일. 규칙과 처리는 reviews.mjs
import { handle } from './reviews.mjs';

export default {
  fetch: (request, env) => handle(request, env),
};
