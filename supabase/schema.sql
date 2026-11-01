-- 로또 찐번호: 당첨 인증 후기 서버 (Supabase)
-- 사용법: Supabase 대시보드 → SQL Editor → 이 파일 내용을 통째로 붙여 넣고 Run.
-- 여러 번 실행해도 괜찮게 만들었다.
--
-- 규칙
-- - 복권 QR로 확인한 번호만 올릴 수 있다 (직접 입력은 누구나 당첨번호를 넣을 수 있어서 안 됨)
-- - 등수는 서버가 직접 당첨번호와 맞춰 본다. 3개 이상 맞은 5등부터 올릴 수 있고, 꽝은 막는다.
-- - 같은 복권의 같은 게임은 한 번만 올릴 수 있다.
-- - 후기를 내리려면 대시보드 Table Editor에서 reviews.hidden 을 true 로 바꾼다.

create extension if not exists pgcrypto with schema extensions;

-- 당첨번호 (GitHub 배포 작업이 매주 채운다)
create table if not exists public.draws (
  no int primary key,
  draw_date date not null,
  nums int[] not null check (array_length(nums, 1) = 6),
  bonus int not null
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  round int not null references public.draws(no),
  rank int not null check (rank between 1 and 5),
  game_label text not null,
  game_type text not null default '',
  numbers int[] not null,
  nickname text not null check (char_length(nickname) between 1 and 12),
  content text not null check (char_length(content) between 5 and 300),
  method text check (method is null or char_length(method) <= 60),
  ticket_key text not null unique,
  hidden boolean not null default false
);
create index if not exists reviews_created_at on public.reviews (created_at desc);

alter table public.draws enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "누구나 당첨번호 보기" on public.draws;
create policy "누구나 당첨번호 보기" on public.draws for select using (true);

drop policy if exists "누구나 후기 보기" on public.reviews;
create policy "누구나 후기 보기" on public.reviews for select using (not hidden);
-- 후기 쓰기는 아래 submit_review 함수로만 (표에 직접 쓰는 권한은 없음)

-- 후기 올리기: QR 글자와 게임(A~E)을 받아 서버가 직접 등수를 판정한다
create or replace function public.submit_review(
  p_qr text,
  p_game text,
  p_nickname text,
  p_content text,
  p_method text default null
) returns public.reviews
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v text;
  r int;
  m text[];
  arr int[];
  idx int := 0;
  picked int[];
  gtype text := '';
  d public.draws;
  hit int;
  rk int;
  nick text := btrim(coalesce(p_nickname, ''));
  body text := btrim(coalesce(p_content, ''));
  saved public.reviews;
begin
  v := (regexp_match(coalesce(p_qr, ''), '[?&]v=([0-9A-Za-z]+)'))[1];
  if v is null or length(v) < 17 then
    raise exception '로또 복권 QR이 아니에요';
  end if;
  r := substr(v, 1, 4)::int;

  -- 앱과 같은 방식으로 게임을 센다: 올바른 번호 6개인 게임만 A, B, C… 순서
  for m in select regexp_matches(substr(v, 5), '([A-Za-z])([0-9]{12})', 'g') loop
    arr := array[
      substr(m[2], 1, 2)::int, substr(m[2], 3, 2)::int, substr(m[2], 5, 2)::int,
      substr(m[2], 7, 2)::int, substr(m[2], 9, 2)::int, substr(m[2], 11, 2)::int
    ];
    continue when (select min(x) from unnest(arr) x) < 1
      or (select max(x) from unnest(arr) x) > 45
      or (select count(distinct x) from unnest(arr) x) <> 6;
    idx := idx + 1;
    exit when idx > 5;
    if chr(64 + idx) = upper(p_game) then
      picked := (select array_agg(x order by x) from unnest(arr) x);
      gtype := case lower(m[1]) when 'q' then '자동' when 'm' then '수동' when 's' then '반자동' else '' end;
    end if;
  end loop;

  if picked is null then
    raise exception '복권에서 % 게임을 찾지 못했어요', upper(p_game);
  end if;

  select * into d from public.draws where no = r;
  if not found then
    raise exception '%회 당첨번호가 아직 없어요. 추첨이 끝난 뒤 다시 올려 주세요', r;
  end if;

  hit := (select count(*) from unnest(picked) x where x = any(d.nums));
  rk := case
    when hit = 6 then 1
    when hit = 5 and d.bonus = any(picked) then 2
    when hit = 5 then 3
    when hit = 4 then 4
    when hit = 3 then 5
    else 0
  end;
  if rk = 0 then
    raise exception '낙첨된 번호는 후기를 올릴 수 없어요 (3개 이상 맞아야 해요)';
  end if;

  if char_length(nick) < 1 or char_length(nick) > 12 then
    raise exception '닉네임은 1~12자로 써 주세요';
  end if;
  if char_length(body) < 5 or char_length(body) > 300 then
    raise exception '후기는 5~300자로 써 주세요';
  end if;

  begin
    insert into public.reviews (round, rank, game_label, game_type, numbers, nickname, content, method, ticket_key)
    values (r, rk, upper(p_game), gtype, picked, nick, body, nullif(btrim(coalesce(p_method, '')), ''),
            encode(digest(v || ':' || upper(p_game), 'sha256'), 'hex'))
    returning * into saved;
  exception when unique_violation then
    raise exception '이 복권의 % 게임은 이미 후기가 올라와 있어요', upper(p_game);
  end;
  return saved;
end;
$$;

-- 등수별 후기 수
create or replace function public.review_stats()
returns table (rank int, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select rank, count(*) from public.reviews where not hidden group by rank order by rank;
$$;

grant execute on function public.submit_review(text, text, text, text, text) to anon, authenticated;
grant execute on function public.review_stats() to anon, authenticated;
