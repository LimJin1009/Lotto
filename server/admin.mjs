#!/usr/bin/env node
// 후기 관리 (맥미니에서): 최근 후기 보기, 숨기기·다시 보이기·지우기
//   node admin.mjs list            최근 30개
//   node admin.mjs hide <id앞부분>   숨기기 (앱에서 안 보임)
//   node admin.mjs show <id앞부분>   다시 보이기
//   node admin.mjs delete <id앞부분> 완전히 지우기
import { DatabaseSync } from 'node:sqlite';
import { homedir } from 'node:os';
import { join } from 'node:path';

const db = new DatabaseSync(join(process.env.LOTTO_DATA ?? join(homedir(), 'LottoData'), 'reviews.sqlite'));
const [cmd, id] = process.argv.slice(2);

const find = (prefix) => {
  const rows = db.prepare('SELECT id FROM reviews WHERE id LIKE ?').all(`${prefix}%`);
  if (rows.length !== 1) throw new Error(rows.length ? 'id가 여러 개 맞아요. 더 길게 써 주세요' : '그런 후기가 없어요');
  return rows[0].id;
};

if (cmd === 'list' || !cmd) {
  for (const r of db.prepare('SELECT id, created_at, round, rank, game_label, nickname, content, hidden FROM reviews ORDER BY created_at DESC LIMIT 30').all()) {
    console.log(`${r.id.slice(0, 8)} ${r.created_at.slice(0, 16)} ${r.round}회 ${r.game_label} ${r.rank}등 ${r.hidden ? '[숨김] ' : ''}${r.nickname}: ${r.content.slice(0, 40)}`);
  }
} else if (cmd === 'hide' || cmd === 'show') {
  db.prepare('UPDATE reviews SET hidden = ? WHERE id = ?').run(cmd === 'hide' ? 1 : 0, find(id));
  console.log(cmd === 'hide' ? '숨겼어요' : '다시 보이게 했어요');
} else if (cmd === 'delete') {
  db.prepare('DELETE FROM reviews WHERE id = ?').run(find(id));
  console.log('지웠어요');
} else {
  console.log('사용법: node admin.mjs list | hide <id> | show <id> | delete <id>');
}
