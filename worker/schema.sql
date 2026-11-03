-- 로또 찐번호 후기 서버 (Cloudflare D1) 표 만들기
-- 처음 한 번: npx wrangler d1 execute lotto-reviews --remote --file worker/schema.sql

CREATE TABLE IF NOT EXISTS draws (
  no INTEGER PRIMARY KEY,
  draw_date TEXT NOT NULL,
  nums TEXT NOT NULL,
  bonus INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  round INTEGER NOT NULL,
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 5),
  game_label TEXT NOT NULL,
  game_type TEXT NOT NULL DEFAULT '',
  numbers TEXT NOT NULL,
  nickname TEXT NOT NULL,
  content TEXT NOT NULL,
  method TEXT,
  ticket_key TEXT NOT NULL UNIQUE,
  hidden INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS reviews_created ON reviews (created_at DESC);

-- 도배 막기 기록 (IP 는 그대로 두지 않고 해시만, 1시간 지나면 지움)
CREATE TABLE IF NOT EXISTS hits (
  ip TEXT NOT NULL,
  ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS hits_ip_ts ON hits (ip, ts);
CREATE INDEX IF NOT EXISTS hits_ts ON hits (ts);
