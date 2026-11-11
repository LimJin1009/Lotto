// 로또 찐 명당 서버 진입 파일. 요청 처리는 app.mjs, 정해진 시간 실행(당첨 알림)은 push.mjs
import { handle } from './app.mjs';
import { runBuyReminder, runPushRound } from './push.mjs';

export default {
  fetch: (request, env) => handle(request, env),
  scheduled: (_event, env, ctx) => {
    ctx.waitUntil(
      (async () => {
        console.log('구매 알림', JSON.stringify(await runBuyReminder(env)));
        console.log('당첨 알림', JSON.stringify(await runPushRound(env)));
      })(),
    );
  },
};
