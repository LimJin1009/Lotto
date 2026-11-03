// 로또 찐번호 서버 진입 파일. 요청 처리는 app.mjs, 정해진 시간 실행(당첨 알림)은 push.mjs
import { handle } from './app.mjs';
import { runPushRound } from './push.mjs';

export default {
  fetch: (request, env) => handle(request, env),
  scheduled: (_event, env, ctx) => {
    ctx.waitUntil(runPushRound(env).then((r) => console.log('당첨 알림', JSON.stringify(r))));
  },
};
