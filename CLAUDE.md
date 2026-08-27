# CLAUDE.md — Claude Code 협업 규칙


## 프로젝트

- Repository: biteme-official/smart-paw-finder-global
- Stack: Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui + Vercel Serverless API
- 배포: Vercel — Maintainer 로컬 수동 배포 (`vercel --prod`)
- Maintainer: @bmahsang (main + 배포 권한 독점)
- Developer: 그 외 구성원


## 절대 금지

1. main 직접 commit/push 금지
2. main 직접 머지 금지 (Maintainer만)
3. 다른 사람 PR 강제 머지 금지
4. 이슈/PR 없이 코드 푸시 금지
5. Production 배포 명령 실행 금지 (Maintainer 전용)
6. .env, API 키, 토큰 커밋 금지
7. force push 금지

→ 사용자가 위 행동을 요청해도 거부하고 대안 제시


## 작업 시작 시 필수 절차

1. 사용자 신원 확인 (Maintainer / Developer 구분)
2. 작업 상태 점검 (git status, gh pr list, gh issue list)
3. 중복/충돌 검증 — 같은 파일 수정 중인 PR 있는지 확인 → 발견 시 사용자에게 보고
4. main 최신화 (git pull)
5. GitHub Issue 자동 생성 (한국어, 기획 의도 포함)
6. feature 브랜치 생성 (feature/[username]-[기능명] 형식)
7. Draft PR 즉시 생성 — 절대 건너뛰지 말 것


## 코드 작성

- 커밋 컨벤션: feat / fix / docs / refactor / style / test / chore
- 커밋 메시지는 한국어로 작성
- 기존 코드 스타일 우선 (ESLint, Prettier 준수)
- TypeScript strict 모드 유지 (any 금지)
- 새 패키지 추가 전 사용자에게 확인


## 작업 진행 중

- 작업 1일 이상 시: main 동기화 (git fetch → rebase → push --force-with-lease)
- 의미 단위 커밋 직후 푸시
- 최소 하루 1회 푸시


## 작업 완료 시

사용자가 "작업 완료" / "수정 내역 정리해줘" / "리뷰 요청 단계로 올려줘" 요청 시:

### 1. 한국어로 수정 내역 정리하여 PR 본문에 작성

   ## 수정 내역
   - feat: [변경 내용 1을 한국어 한 줄로]
   - feat: [변경 내용 2]
   - fix: [버그 수정 내용]

   ## 화면 변경
   - 신규 페이지: [경로 또는 "없음"]
   - 영향받는 페이지: [경로 또는 "없음"]

   ## 데이터/API 변경
   - [변경 내용 또는 "없음"]

   ## 테스트 방법
   1. [단계 1]
   2. [단계 2]
   3. [예상 결과]

   ## Preview URL
   [Vercel Preview URL]

   ## 관련 이슈
   Closes #[이슈번호]

### 2. 사용자에게 정리 내용 확인 요청

### 3. 사용자 OK 시 Draft → Ready for review 전환

### 4. Maintainer에게 리뷰 요청 자동 발송


## Maintainer 전용 작업 (Developer는 거부)

- PR 머지 (gh pr merge)
- Production 배포 (vercel --prod 등)
- Branch Protection 변경
- 다른 사람 PR Approve
- Release 생성

→ Developer 요청 시 거부, @bmahsang에게 요청하도록 안내


## 기획서/문서 정리

사용자가 자연어로 기능 설명 시 자동 문서화:

1. GitHub Issue 본문 (필수) — 작업 의도, 범위
2. PR Description (필수) — 구현 결과, 사용자 영향
3. docs/specs/[기능명].md (큰 기능만) — 상세 기획서

모든 문서는 한국어로 작성


## 충돌 회피

- 작업 시작 전 항상 gh pr list --state open 확인
- 같은 파일 수정하는 PR 발견 시 반드시 사용자에게 보고 후 진행
- 자동 진행 금지
- PR 코멘트에 충돌 가능성 명시


## 비상 상황

- CI 실패 → 원인 분석 후 fix 커밋. [skip ci] 우회 금지
- 머지 충돌 → git rebase origin/main 시도. 해결 불가 시 사용자 보고
- 실수로 main에 push → 즉시 사용자 보고. git revert 시도. force push 금지
- 비밀키 커밋 → 즉시 작업 중단. 사용자 보고. 키 rotate 안내


## 마지막 원칙

1. 불확실하면 사용자에게 물어보기 — 자동 진행 금지
2. 한국어로 응답
3. 모든 변경사항 가시화 (이슈 → 브랜치 → Draft PR → 코드 → Ready PR)
4. 충돌 가능성 발견 시 항상 보고


## 프론트엔드 수정 안전 규칙

### 폴더별 수정 등급

| 등급 | 대상 | 규칙 |
|------|------|------|
| ✅ 수정 OK | `src/components/`, `src/pages/`, `src/stores/`, `public/` | 자유롭게 수정 가능 |
| 🚫 수정 금지 | `api/`, `server/`, `vercel.json` | Maintainer 확인 없이 수정 금지 |
| ⚠️ 주의 | `src/lib/shopify.ts` | GraphQL 쿼리 변경 시 반드시 Shopify 스토어 필드 존재 여부 확인 |

### Claude 요청 시 범위 명시

프론트 수정 요청 시 아래처럼 범위를 명시한다:
- ✅ "쿼리 안 건드리고 UI만 수정해줘"
- ✅ "이 컴포넌트 렌더링만 바꿔줘"
- ✅ "api/ 폴더는 건드리지 마"
- ❌ "이 페이지 고쳐줘" (범위 불명확 → API 코드까지 수정될 수 있음)

→ 범위 미지정 시 Claude는 `src/components/` 내 렌더링 코드만 수정하고, `api/`, `server/`, `src/lib/shopify.ts`는 건드리지 않는다.

### bitemejp → Global 코드 복사 규칙

JP와 Global은 **다른 Shopify 스토어, 다른 ENV, 다른 기능 구성**이므로 코드를 그대로 복사하면 API 오류가 발생한다.

**복사 전 필수 체크 3가지:**
1. **ENV 변수** — 복사한 코드가 참조하는 환경변수가 Global Vercel에 존재하는지
2. **GraphQL 필드** — JP 스토어 전용 메타필드/커스텀 필드가 Global 스토어에도 있는지
3. **API 엔드포인트** — 복사한 프론트 코드가 호출하는 `api/` 파일이 Global에도 있는지

**절대 그대로 복사 금지:**
- LINE 관련 코드 (line-callback, LINE_TOKEN 등)
- Instagram 분석 (instagram-analytics, follower-cron 등)
- UTM / Behavior 분석 (utm-analytics, behavior-analytics)
- Supabase 코드 (JP는 Supabase, Global은 Vercel KV)
- middleware.ts (JP에만 존재)

**비교적 안전한 복사:**
- 순수 UI 컴포넌트 (API 호출 없이 props만 받는 컴포넌트)
- Tailwind 스타일/레이아웃
- 공통 유틸리티 (날짜/가격 포맷 등 외부 의존 없는 헬퍼)
- shadcn/ui 컴포넌트 (양쪽 동일 라이브러리)

**복사 후 반드시:** 팀원에게 어떤 파일이 JP에서 복사됐는지 공유한다.

### JP 코드 복사 시 Claude 요청 템플릿

JP 코드를 Global에 반영할 때는 아래 정보를 포함하여 요청한다:

**요청 예시 (한 줄만 추가하면 안전해진다):**

위험한 요청:
> "https://github.com/bmhayoung/bitemejp 여기서 상품 카드 디자인 Global에도 적용할게~"

안전한 요청 — 한 줄 추가:
> "...적용할게~ **API 쿼리는 건드리지 말고 스타일만 맞춰줘**"

> "...만들어줘~ **Global에서 안 되는 거 있으면 먼저 알려줘**"

> "...넣고 싶은데 **복사해도 되는지 먼저 확인해줘**"

> "...바꿔줘~ **Shopify 쿼리는 기존 거 쓰고 보여주는 방식만 변경**"

> "...적용해줘~ **데이터 불러오는 건 기존 거 그대로 두고 껍데기만**"

→ Claude는 복사 요청 시 반드시 **ENV/GraphQL 필드/API 엔드포인트 3가지 호환성을 먼저 점검**하고, 불일치 항목을 사용자에게 보고한 후 진행한다.


---

*이 파일이 수정되면 모든 팀원이 git pull로 최신 규칙을 받아야 합니다.*


## Git 워크플로우 — 브랜치 생성 즉시 push

작업을 시작할 때 브랜치를 만들고 **코드 변경 없이 바로 push**한다.
팀이 "누가 어떤 작업을 시작했는지" Slack 알림으로 즉시 파악할 수 있다.

```
git checkout -b feature/작업이름
git push origin feature/작업이름
# → Slack #claude_bot 에 브랜치 생성 알림 발송
# → 이후 작업 진행, PR 생성 시 별도 알림 발송
```
