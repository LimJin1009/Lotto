-- 로또 찐 번호 후기 서버 (Cloudflare D1) 표 만들기
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

-- ── 당첨 알림 (웹 푸시) ──
-- 알림을 켠 기기. id = 받는 주소(endpoint)의 SHA-256
CREATE TABLE IF NOT EXISTS subs (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 추첨 전 회차에 저장해 둔 번호 (그 회차 알림을 보내고 나면 지움)
CREATE TABLE IF NOT EXISTS watch (
  sub_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  nums TEXT NOT NULL,
  PRIMARY KEY (sub_id, round, nums)
);

-- 보낼 알림 내용 (알림을 받은 휴대폰이 와서 가져감)
CREATE TABLE IF NOT EXISTS inbox (
  sub_id TEXT PRIMARY KEY,
  round INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  tries INTEGER NOT NULL DEFAULT 0
);

-- 알림 준비를 끝낸 회차
CREATE TABLE IF NOT EXISTS push_rounds (
  round INTEGER PRIMARY KEY,
  done_at TEXT NOT NULL
);

-- 알림 신청 도배 막기 (후기와 따로 셈)
CREATE TABLE IF NOT EXISTS sync_hits (
  ip TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sync_hits_ip_ts ON sync_hits (ip, ts);
CREATE INDEX IF NOT EXISTS sync_hits_ts ON sync_hits (ts);
