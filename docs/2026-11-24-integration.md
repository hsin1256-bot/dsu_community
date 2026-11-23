# 통합 작업 정리 (2026-11-24)

> [PR #5](https://github.com/hsin1256-bot/dsu_community/pull/5) 설명을 그대로 옮긴 문서입니다. 실행 방법은 [README](../README.md)를 보세요.

## 개요
`calenda`(학사일정) · `cafeteria`(학식) · `event`(공지사항) 브랜치를 `main` 위에 하나로 합치고, 브랜치 리뷰에서 나온 문제와 보안 문제를 함께 고쳤습니다.

`calenda`는 `main`과 공통 조상이 없어서, 최종 상태(`324593d`, KIMMINCEOL 님 17개 커밋)를 첫 커밋 하나로 옮겼습니다. 나머지 4개 커밋은 그 위의 통합·수정 작업입니다.

| 커밋 | 내용 |
|---|---|
| `1c1dd1c` | calenda 학사일정 기능을 main 위로 가져오기 (작성자 KIMMINCEOL) |
| `6cd9c01` | cafeteria + event 통합, 기능별 모듈 분리, 리뷰에서 나온 문제 수정 |
| `b871d6a` | 보안: 리뷰·신고·사진 생성은 서버(service role)만 가능 |
| `3f855cf` | Next.js의 Supabase 응답 캐시 문제 해결, Gemini 키가 없을 때 재크롤링 방지 |
| `b48208d` | 마이 탭: 알림 설정(키워드 + D-Day), 알림함, 문의·피드백, 앱 정보, 약관 초안 |

## 주요 변경
**구조**
- 세 브랜치가 함께 고치던 공용 파일을 기능별로 나눴습니다.
  - `lib/db/{notices,cafeteria,schedules,feedback}.ts`
  - `lib/dsu/{notice,schedule}-crawler.ts`
  - `lib/supabase-client.ts`, `lib/date-kst.ts`
- 기존 import 경로(`@/lib/supabase`, `@/lib/dongseo-crawler`)는 그대로 쓸 수 있습니다.

**데이터 흐름**
- 학교 사이트 크롤링은 예약 동기화(`/api/sync`, `CRON_SECRET` 인증)에서만 합니다. 화면과 API는 DB만 읽습니다.
- GitHub Actions(`.github/workflows/sync.yml`)
  - 공지: 평일 KST 9~18시 매시 정각
  - 학사일정: 매일 KST 03:30
- 이미 요약된 공지는 다시 요약하지 않습니다. 새 공지가 없으면 Gemini 호출이 0번입니다.

**공지 (event)**
- 크롤링에 실패하면 목업 데이터를 DB에 저장하던 문제를 고쳤습니다.
- AI 요약·키워드·첨부파일·`ai_status`를 저장합니다. 원문 텍스트는 요약으로 덮어쓰지 않습니다.
- 5개 카테고리를 모두 동기화하고, 첨부파일은 학교 사이트 실제 구조에 맞춰 파싱합니다.
- 목록은 DB에서 페이지 단위로 조회합니다.

**학사일정 (calenda)**
- API 실패와 상관없이 개인 일정은 항상 보입니다.
- 학기 정보와 의미 있는 연도는 제목에서 지우지 않습니다.
- 학교에서 지운 일정은 DB에서도 정리됩니다.
- 아직 동작하지 않는 반복·알림 설정 UI는 숨겼습니다.

**보안**
- 일반 사용자(anon/authenticated)는 읽기만 가능합니다. 리뷰·신고·사진·피드백 생성은 서버가 검증한 뒤 service role로만 합니다.
- 사진 업로드는 파일 내용(매직 바이트)을 검사해 SVG 같은 위장 파일을 차단합니다. 리뷰에는 우리 저장소의 사진 주소만 넣을 수 있습니다.
- 공지 HTML은 허용 목록 방식으로 정제합니다 (class도 제한). 보안 헤더를 추가했습니다.
- 운영 DB에 넣던 가짜 학생 리뷰 시드를 제거했습니다.

## DB (supabase/migrations)
- 01~05: 학식 (cafeteria 브랜치)
- 06: 공지·학사일정
- 07: 서버 전용 쓰기
- 08: 피드백

팀 프로젝트 `dsu_community`에는 이미 적용했습니다. 적용 기록과 차이점은 `supabase/README.md`에 있습니다.

## 배포 전 필요한 것
- [ ] 환경 변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `CRON_SECRET` (`.env.example` 참고)
- [ ] GitHub Secrets: `SYNC_BASE_URL`, `CRON_SECRET`
- [ ] 이용약관·개인정보처리방침의 `[대괄호]` 부분 확정
- [ ] 글빌 식단 주간 갱신 방식 결정 (현재 DB에는 11/16~11/20 메뉴로 고정)

## 확인한 것
- `tsc --noEmit`, `next build` 통과
- 실제 Supabase 연결 상태에서 확인
  - 학사일정 210건, 공지 75건 동기화
  - 화면 11개 정상 표시
  - 피드백 API의 검증·도배 제한·허니팟 동작
- anon 권한으로 직접 INSERT/UPDATE를 시도하면 차단되는 것을 확인 (트랜잭션 롤백 테스트)
- 아직 확인하지 못한 것
  - Gemini 요약 (키 없음)
  - 로그인 사용자 기능 (로그인 기능은 마지막에 구현 예정)

## 알려진 남은 과제
- Next.js 14 자체 취약점: 15 이상으로 올려야 해결됩니다 (별도 작업).
- 알림은 앱 안 알림함 방식입니다. 푸시 알림은 아직 없습니다.
- 북마크·알림 설정·개인 일정은 기기(localStorage)에 저장됩니다. 로그인을 붙일 때 계정으로 옮길 예정입니다.


