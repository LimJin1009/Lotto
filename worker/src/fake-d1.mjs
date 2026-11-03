// 시험용: Cloudflare D1 과 같은 모양의 가짜 DB (내 PC 의 SQLite 로 흉내). 서버에는 올라가지 않는다.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export class FakeD1 {
  constructor() {
    this.db = new DatabaseSync(':memory:');
    this.db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  }
  prepare(sql) {
    const st = this.db.prepare(sql);
    let args = [];
    const q = {
      bind: (...a) => ((args = a), q),
      first: async () => st.get(...args) ?? null,
      all: async () => ({ results: st.all(...args) }),
      run: async () => (st.run(...args), { success: true }),
    };
    return q;
  }
  /** D1 처럼 한 묶음을 한꺼번에 (중간에 실패하면 모두 되돌림) */
  async batch(stmts) {
    this.db.exec('BEGIN');
    try {
      const out = [];
      for (const s of stmts) out.push(await s.run());
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
}
