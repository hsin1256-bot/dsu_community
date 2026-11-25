# 🎓 동서대 캠퍼스

동서대학교 학생을 위한 모바일 웹 앱입니다. 학교 홈페이지를 돌아다니지 않아도 **공지사항, 학사일정, 학식 메뉴와 리뷰**를 한곳에서 볼 수 있습니다.

> 동서대학교 공식 앱이 아닙니다. 공지·일정은 학교 홈페이지에서 주기적으로 가져옵니다.

최근 통합 작업 내용: [docs/2026-11-24-integration.md](docs/2026-11-24-integration.md) ([PR #5](https://github.com/hsin1256-bot/dsu_community/pull/5))

---

## 📱 주요 기능

| 탭 | 기능 |
|---|---|
| **홈** | 이번 학기, 다가오는 주요 일정 D-Day, 오늘의 글빌 식단, 최신 공지 |
| **공지사항** | 학사·모집·취업·장학·행사 공지, 검색, AI 요약 + 원문 보기, 첨부파일, 스크랩 |
| **학식** | 글빌·스플·경영 식당 메뉴와 지도, 별점·한줄 리뷰, 사진 첨부, 신고 |
| **캘린더** | 학교 학사일정(작년~내년) + 개인 일정, 일정별 D-Day 알림 받기 |
| **마이** | 보관함, 알림 설정(공지 키워드 + 캘린더 D-Day), 문의 및 피드백, 앱 정보, 약관 |

헤더의 🔔 아이콘을 누르면 알림 설정에 맞는 공지와 일정이 모인 **알림함**이 열립니다.

---

## 💻 실행 방법

### 1. 준비물
- Node.js 18.17 이상 (20 이상 권장)
- Supabase `dsu_community` 프로젝트 키 (팀장에게 받기)

### 2. 코드 받기 & 설치
```bash
git clone https://github.com/hsin1256-bot/dsu_community.git
cd dsu_community
npm install
```

### 3. 환경 변수 파일 만들기
`.env.example`을 복사해 `.env.local`을 만들고 값을 채웁니다.
```bash
cp .env.example .env.local
```

| 변수 | 어디서 | 필요한 경우 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | 항상 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 같은 화면의 **Publishable key** (`sb_publishable_…`) | 항상 |
| `SUPABASE_SERVICE_ROLE_KEY` | 같은 화면의 **Secret key** (`sb_secret_…`) | 리뷰·피드백 저장, 동기화 |
| `GEMINI_API_KEY` | Google AI Studio | 공지 AI 요약 (없으면 원문만 표시) |
| `CRON_SECRET` | 아무 긴 문자열 | 동기화 실행 |

> ⚠️ `.env.local`은 git에 올라가지 않습니다. Secret key는 채팅·GitHub에 붙여 넣지 말고, `NEXT_PUBLIC_`을 붙이지 마세요.

### 4. 개발 서버 실행
```bash
npm run dev
```
브라우저에서 http://localhost:3000 을 열고, 개발자 도구(F12)의 모바일 화면 모드로 보면 실제 앱처럼 보입니다.

### 5. (필요할 때) 공지·학사일정 가져오기
화면은 DB만 읽습니다. DB가 비어 있거나 최신 내용을 바로 보고 싶으면, **개발 서버를 켠 상태에서** 다른 터미널에서 실행합니다.
```bash
npm run sync:local              # 공지 + 학사일정
npm run sync:local -- notices   # 공지만
npm run sync:local -- schedules # 학사일정만
```
배포 환경에서는 GitHub Actions가 자동으로 실행합니다 (공지: 평일 9~18시 매시, 학사일정: 매일 03:30).

### 자주 묻는 문제
**먼저 http://localhost:3000/api/health 를 열어 보세요.** 어느 Supabase 프로젝트에 연결됐는지, 테이블별 데이터 수, 문제 원인을 알려줍니다 (개발 서버에서만 동작).

| 증상 | 원인 / 해결 |
|---|---|
| 공지는 나오는데 캘린더만 비어 있음 | 예전 개인 Supabase 주소가 `.env.local`에 남아 있음 → 팀 공용 `dsu_community` URL·키로 교체 |
| 공지·캘린더가 비어 있음 | 아직 동기화를 안 함 → 서버 키가 있는 사람이 5번 실행 |
| 동기화가 `503` | `SUPABASE_SERVICE_ROLE_KEY` 없음 |
| 동기화가 `401` | `CRON_SECRET`이 `.env.local`과 다름 |
| 리뷰 저장이 실패 | `SUPABASE_SERVICE_ROLE_KEY` 없음, 또는 메뉴를 선택하지 않음 |
| `.env.local`을 고쳤는데 그대로 | 개발 서버 재시작 (`Ctrl+C` 후 `npm run dev`) |

---

## 🗂️ 폴더 구조

```
src/
  app/                 화면(page.tsx)과 API(api/**/route.ts)
    api/sync/          예약 동기화 (CRON_SECRET 필요)
    my/                마이 탭 (알림 설정, 피드백, 앱 정보, 약관)
    alerts/            알림함
  components/          공통 UI
  lib/
    db/                DB 읽기·쓰기 (notices, cafeteria, schedules, feedback)
    dsu/               학교 사이트 크롤러 (공지, 학사일정)
    supabase-client.ts Supabase 연결 (브라우저에서도 import 가능한 유일한 DB 파일)
    date-kst.ts        한국 시간 기준 날짜
supabase/migrations/   DB 구조 (적용 기록: supabase/README.md)
.github/workflows/     예약 동기화
```

**규칙**
- 화면(클라이언트 컴포넌트)에서는 `@/lib/db/*`, `@/lib/dsu/*`를 import 하지 않습니다 (서버 전용).
- 데이터 쓰기는 API 라우트에서 검증한 뒤 서버 키로만 합니다. DB는 일반 사용자에게 읽기만 허용합니다.
- 날짜는 `new Date().toISOString()` 대신 `lib/date-kst.ts`를 씁니다 (UTC라 오전 9시 전에 하루 밀림).
- DB 구조를 바꾸면 `supabase/migrations/`에 새 파일을 추가하고 `supabase/README.md`에 기록합니다.

---

## 🤝 협업 방법

1. 항상 최신 `main`에서 새 브랜치를 만듭니다.
   ```bash
   git checkout main && git pull
   git checkout -b feat/기능이름
   ```
2. 작업 후 `npm run typecheck`와 `npm run build`로 확인합니다.
3. `main`으로 PR을 올리고 팀원 확인 후 머지합니다.

---

## 🛠️ 기술 스택
Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (PostgreSQL, Storage) · cheerio · sanitize-html · Google Gemini · Leaflet · Lucide
