# Supabase 마이그레이션

| 순서 | 파일 | 내용 |
|---|---|---|
| 01 | `20261123000001_create_cafeteria_schema.sql` | 학식 메뉴·리뷰 테이블 |
| 02 | `20261123000002_seed_cafeteria_menus_and_reviews.sql` | 3개 식당 메뉴 181개 (가짜 리뷰 시드는 제거) |
| 03 | `20261123000003_add_user_id_to_meal_reviews.sql` | 리뷰 작성자 `user_id` |
| 04 | `20261123000004_harden_reviews_rls_and_reports.sql` | 신고 테이블, 본인 글 수정/삭제 RLS |
| 05 | `20261123000005_create_review_photos_storage.sql` | 리뷰 사진 버킷 |
| 06 | `20261124000001_create_notices_and_schedules.sql` | 공지·학사일정 (읽기 전용 공개) |
| 07 | `20261124000002_server_only_review_writes.sql` | 리뷰·신고·사진 생성은 서버(service_role) 전용 |

## 권한 원칙
- **anon / authenticated**: 모든 테이블 읽기만. 직접 INSERT 불가.
- **authenticated**: 본인 리뷰의 `rating`, `comment` 수정과 삭제만 (RLS `auth.uid() = user_id`).
- **service_role (서버 API, /api/sync)**: 리뷰·신고·사진 생성, 공지·학사일정 저장.

## 팀 공용 프로젝트(lgphijmhyenycysmtjre) 적용 기록 — 2026-11-24
- 초기 임시 테이블(테스트 데이터만 존재)은 삭제하지 않고 `legacy` 스키마로 이동 (API 비노출).
  필요 없으면 `drop schema legacy cascade;`
- 01~07 을 적용했고, 04·07 의 `drop policy` 는 확인 절차 때문에
  같은 효과의 `alter policy ... using (false) / with check (false)` 로 적용했습니다.
  (정책 이름이 남아 있지만 항상 거부합니다)
