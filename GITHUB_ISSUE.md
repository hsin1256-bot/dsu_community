# [Feature & BugFix] 동서대학교 공지사항(학사·행사) 크롤링, AI 요약 정제 및 실시간 정렬 최적화

## 📌 이슈 개요 (Overview)
동서대학교 공식 웹사이트의 학사 및 행사 공지사항을 효율적으로 수집·제공하기 위해 일체형 크롤링 파이프라인을 구축하고, LLM(`gemini-3.1-flash-lite`)을 활용한 제목 정제 및 3~4줄 핵심 요약을 도입했습니다. 또한 Supabase DB 연동 및 게시판 고유 ID 기반 복합 정렬을 적용하여 모바일 앱 환경에 최적화된 공지사항 서비스를 완성했습니다.

---

## 🛠️ 주요 변경 및 작업 내역 (Key Changes)

### 1. 동서대학교 학사 및 행사 공지 크롤링 & AI 파이프라인 구축
- **관련 파일**: `scripts/sync-to-supabase.js`, `src/lib/dongseo-crawler.ts`
- **작업 상세**:
  - 동서대 공식 게시판 PCode 매핑 정상화 (`학사`: `MN2000194`, `행사`: `MN2000191`, `장학`: `MN2000195`, `취업`: `MN2000197`).
  - 상단 고정(Badge: `[공지]`) 행을 자동으로 건너뛰고 최신 일반 공지만 정확히 수집하도록 필터링.
  - 학사 공지 15건(839번~825번) 및 행사 공지 15건(1251번~1237번) 수집 완료.
  - 상세 본문 컨테이너(`#boardContents`) 크롤러 구현 및 이미지/링크 상대 경로를 `https://www.dongseo.ac.kr` 절대 경로로 자동 변환.
  - `gemini-3.1-flash-lite` 모델을 적용하여 단 1회의 API 호출로 JSON 스키마를 통해 **제목 정제 + 3~4줄 핵심 불릿 요약**을 동시 생성하도록 최적화 (API 요청량 50% 절감 및 할당량 안정성 확보).

### 2. 제목 정제 및 본문 가독성 강화 (AI Prompt & Cleaners)
- **작업 상세**:
  - 불필요한 특수기호(`★`, `★★`, `' < > '`), 행정 태그(`[전체]`, `[학사]`, `[행사]`), 마감일 날짜 태그(`(~11/30)`) 제거.
  - **타 대학 및 기관명 보존**: 타 대학(신라대, 동아대, 한국해양대 등) 및 학내 주요 기관/부서명(평생교육원, 청년도약 부트캠프사업단, 학생성공센터, 사회봉사센터 등), 핵심 인물(산악인 엄홍길 대장) 명칭을 제목에 명확히 유지하여 공지 혼선 방지.
  - **중복 링크 문제 해결**: 마크다운 문법 등으로 인해 `[URL](URL)` 형태로 링크가 중복 노출되던 문제를 정규식 및 파이프라인에서 단일 링크(`• **신청 링크**: https://...`)로 변환.

### 3. 공지사항 업로드 시간 순서 정렬 최적화
- **관련 파일**: `src/lib/supabase.ts`
- **작업 상세**:
  - 기존 `date DESC` 단일 정렬 시, 동일한 날짜(예: 11월 12일)에 여러 공지가 올라왔을 때 DB 내부 순서로 인해 업로드 순서가 역전되던 문제 수정.
  - 동서대학교 CMS의 순차 증가 고유번호인 `idx`를 반영하여 **1차: `date DESC` (등록일자 최신순) + 2차: `id DESC` (게시글 고유 ID 최신순)** 복합 정렬 적용.
  - [전체], [학사], [행사] 탭 모두에서 실제 학교 사이트 업로드 시간 순서대로 100% 일치하게 정렬되도록 보완.

### 4. 실시간 폴백 크롤링 제거 및 카테고리 침범 차단
- **관련 파일**: `src/app/api/notices/route.ts`, `src/lib/supabase.ts`
- **작업 상세**:
  - DB에 데이터가 0건일 때 실시간으로 크롤러가 동작하여 학사 공지를 타 카테고리(장학 등)로 재태깅하던 버그 원천 차단.
  - `getNoticesFromDB`에서 결과가 없을 때 `null` 대신 빈 배열(`[]`)을 반환하여 잘못된 폴백 트리거 방지.
  - API 라우트에 `force-dynamic`, `revalidate = 0`, `Cache-Control: no-store` 적용으로 캐시 오작동 차단.

### 5. 공지사항 UI 및 상세 페이지 렌더링 개선
- **관련 파일**: `src/app/notices/[id]/page.tsx`, `src/components/NoticeCard.tsx`
- **작업 상세**:
  - 목록 카드 및 상세 페이지 헤더에서 불필요한 작성자(`author`) 정보 제거.
  - `formatSummaryText` 및 `renderInlineContent`를 구현하여 AI 불릿(`•`) 요약본을 기본 본문 카드로 렌더링.
  - 포스터 이미지 공지의 경우 요약 하단에 반응형 이미지 자동 표시 및 학교 공식 원문 바로가기 버튼 배치.

---

## 📂 변경된 파일 목록 (Modified Files)

| 파일 경로 | 변경 유형 | 주요 내용 |
| :--- | :---: | :--- |
| `scripts/sync-to-supabase.js` | 신규/수정 | 학사·행사 공지 수집, Gemini 3.1 Flash-Lite AI 요약, Supabase Upsert 파이프라인 |
| `src/lib/supabase.ts` | 수정 | 복합 정렬(`date DESC, id DESC`), 0건 반환 버그 수정, 로컬 캐시 정렬 동기화 |
| `src/lib/dongseo-crawler.ts` | 수정 | `PCODE_MAP` 정상화(`행사: MN2000191`), 본문 셀렉터(`#boardContents`) 보완, 이미지 절대경로 처리 |
| `src/app/api/notices/route.ts` | 수정 | 실시간 폴백 크롤링 제거, 캐시 방지 헤더 설정 |
| `src/app/notices/[id]/page.tsx` | 수정 | 작성자 제거, AI 불릿 요약 렌더링, 중복 링크 정리, 포스터 이미지 뷰어 |
| `src/components/NoticeCard.tsx` | 수정 | 카드 UI 정제 (작성자 및 중복 AI 요약 박스 제거) |

---

## ✅ 검증 결과 (Verification)
1. **Supabase DB 적재 검증**:
   - 총 30건 적재 완료 (`학사`: 15건, `행사`: 15건).
2. **정렬 검증**:
   - `103844` > `103830` > `103822` > `103795` > `103781` ... 순서로 업로드 시간 역순 정렬 확인 완료.
3. **타입스크립트 컴파일**:
   - `node ./node_modules/typescript/bin/tsc --noEmit` 실행 결과 에러 0건 통과.
4. **인앱 브라우저 테스트**:
   - `http://localhost:3000/notices` 정상 로드 및 카테고리 탭 전환 검증 완료.

---

# 📅 2026-11-21 추가 수정 내역 (2차 피드백 반영 및 안정화)

## 📌 추가 작업 개요
팀원 피드백을 반영하여 수집 경로의 이원화 문제를 해결하고, 실제 검증된 A방법(`scripts/sync-to-supabase.js`) 규격으로 파이프라인 및 데이터베이스 스키마를 단일화했습니다. 또한 Gemini API 키의 클라이언트 노출 위험을 원천 차단하고, 상세 조회 온디맨드 크롤링 및 카테고리별 pCode 매핑을 보완하여 API 안정성을 대폭 강화했습니다.

---

## 🛠️ 주요 수정 내역 (Key Updates)

### 1. Gemini API 키 보안 조치 및 클라이언트 노출 방지
- **관련 파일**: `src/lib/llm-extractor.ts`
- **커밋**: `e94076e` (`fix(security): remove NEXT_PUBLIC_GEMINI_API_KEY to prevent client exposure`)
- **수정 상세**:
  - 클라이언트 번들에 API 키가 번들링될 수 있었던 `NEXT_PUBLIC_GEMINI_API_KEY` 환경변수 참조를 완전히 제거.
  - 서버 사이드 런타임 전용 환경변수(`process.env.GEMINI_API_KEY`)만을 사용하도록 제한하여 키 유출 보안 위험 원천 차단.

### 2. 크롤링 수집 경로 및 AI 요약 규격 일원화 (A방법 표준 적용)
- **관련 파일**: `src/lib/llm-extractor.ts`, `src/lib/notice-pipeline.ts`, `src/lib/supabase.ts`
- **커밋**: `0810ee6` (`refactor(crawler): unify notice pipeline and detail crawling to Method A standard`)
- **수정 상세**:
  - **통합 AI 분석 적용**: `gemini-3.1-flash-lite`(폴백: `gemini-flash-lite-latest`)를 통해 1회 API 호출로 제목 정제(`cleanTitle`)와 3~4줄 핵심 불릿 요약(`contentSummary`), 마감일, 키워드를 일괄 추출하는 `analyzeNoticeWithAI`로 통일.
  - **Supabase 스키마 불일치 해결**: 실제 `notices` 테이블 컬럼(`id`, `title`, `raw_title`, `category`, `author`, `date`, `views`, `url`, `content_html`, `content_text`)과 매핑 함수(`mapNoticeToRow`)를 일치시켜 존재하지 않는 컬럼(`attachments`, `ai_summary` 등)으로 인한 스키마 캐시 오류 해결.
  - **앱 파이프라인(`notice-pipeline.ts`) 정비**: 상단 고정(`[공지]`) 필터링, 기저장 여부 판별(`contentText` 20자 이상 기준 스킵), API Rate Limit 방지 딜레이(1000ms)를 동일하게 적용.

### 3. 공지사항 상세 조회 온디맨드 크롤링 및 pCode 매핑 보완
- **관련 파일**: `src/app/api/notices/[id]/route.ts`, `src/lib/dongseo-crawler.ts`
- **커밋**: `9c01d76` (`fix(api): enhance detail crawling with category-aware pCode resolution`)
- **수정 상세**:
  - `/api/notices/[id]` 엔드포인트 호출 시 DB에 본문(`contentText`)이 없거나 비어있는 경우, 동서대 원문에서 실시간 크롤링 및 A방법 AI 요약을 거쳐 DB에 비동기 저장하도록 개선.
  - 동서대 각 게시판별 `pCode`(`학사`: `MN2000194`, `행사`: `MN2000191`, `일반`: `MN2000192`, `장학`: `MN2000195`, `취업`: `MN2000197`)가 달라 본문을 찾지 못하던 문제를 해결하기 위해, 해당 공지의 URL 및 카테고리 후보군을 자동 순회 탐색하여 본문(`#boardContents`)을 안정적으로 확보하도록 보완.

---

## 📂 2026-11-21 추가 변경 파일 목록

| 파일 경로 | 변경 유형 | 주요 내용 |
| :--- | :---: | :--- |
| `src/lib/llm-extractor.ts` | 수정 | `NEXT_PUBLIC_` 제거(보안 강화), A방법 표준 `analyzeNoticeWithAI` 함수 추가 |
| `src/lib/supabase.ts` | 수정 | `mapNoticeToRow` DB 스키마 일치화, `mapRowToNotice` 불릿 요약 파싱 지원 |
| `src/lib/notice-pipeline.ts` | 수정 | A방법 수집/요약 로직으로 일원화, 기저장 스킵 및 호출 딜레이 적용 |
| `src/lib/dongseo-crawler.ts` | 수정 | `PCODE_MAP` export, 카테고리별 pCode 다중 후보 탐색 및 상세 본문 크롤러 강화 |
| `src/app/api/notices/[id]/route.ts` | 수정 | 온디맨드 크롤링 시 A방법 AI 요약 적용 및 카테고리별 pCode 전달 |

---

## ✅ 2026-11-21 검증 결과
1. **API 키 보안 검증**:
   - 브라우저 번들 내 API 키 노출 0건, Git 커밋 내 키 유출 없음 확인.
2. **TypeScript 타입 검사**:
   - `node ./node_modules/typescript/bin/tsc --noEmit` 통과 (에러 0건).
3. **Next.js 프로덕션 빌드 검증**:
   - `npm run build` 결과 12개 페이지 및 6개 API 라우트 정상 컴파일 완료 (`exit code 0`).
4. **Git 반영**:
   - `event` 브랜치에 커밋 `e94076e`, `0810ee6`, `9c01d76` 정상 푸시 완료.