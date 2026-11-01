# 당첨 인증 후기 서버(Supabase) 켜는 방법

후기는 모든 사람이 함께 보는 게시판이라 서버가 필요하다. 무료 서버인 Supabase를 쓴다.
아래 1~3은 누나 계정으로 직접 해야 하고, 4는 받은 값을 Claude에게 알려 주면 된다.

## 1. Supabase 가입과 프로젝트 만들기
1. https://supabase.com 에서 GitHub 계정(LimJin1009)으로 가입한다.
2. **New project** → 이름 `lotto`, 지역(Region)은 **Northeast Asia (Seoul)**, 데이터베이스 비밀번호는 아무거나 길게(따로 보관).
3. 1~2분 기다리면 프로젝트가 만들어진다.

## 2. 표와 규칙 만들기
1. 왼쪽 메뉴 **SQL Editor** → **New query**.
2. 저장소의 `supabase/schema.sql` 내용을 통째로 붙여 넣고 **Run**.
3. "Success" 가 나오면 끝. (여러 번 실행해도 괜찮다)

## 3. 당첨번호를 서버에 올리는 열쇠 넣기 (GitHub)
서버가 등수를 판정하려면 당첨번호가 서버에 있어야 한다. GitHub 배포 작업이 매주 올려 준다.
1. Supabase **Project Settings → API Keys** 에서 **service_role** 키를 복사한다. (⚠️ 비밀 키. 채팅이나 코드에 붙이지 않는다)
2. GitHub 저장소 **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `SUPABASE_SERVICE_KEY`
   - Secret: 복사한 service_role 키
3. 저장.

## 4. Claude에게 알려 줄 값 (공개해도 되는 값)
Supabase **Project Settings → API Keys / Data API** 에서:
- **Project URL** (예: `https://abcd1234.supabase.co`)
- **anon public** 키 (`eyJ…` 로 시작하는 긴 글자, 또는 `sb_publishable_…`)

이 둘을 `src/lib/config.ts` 에 넣고 올리면 후기 게시판이 켜지고, 배포 작업이 당첨번호를 서버에 채운다.

## 운영
- 후기 내리기: Supabase **Table Editor → reviews** 에서 그 줄의 `hidden` 을 `true` 로.
- 후기 지우기: 같은 화면에서 줄 삭제.
