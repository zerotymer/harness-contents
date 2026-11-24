# CLAUDE_ko.md

> 이 파일은 `CLAUDE.md`의 한국어 번역본이며 사람이 읽기 위한 것이다. 내용이 다르면 `CLAUDE.md`가 기준이다. 관리 블록 밖을 고치면 두 파일을 함께 맞춘다.

## 현재 상태

이 저장소는 설계 단계다. 소스 코드, 빌드 시스템, 테스트가 아직 없으므로 실행할 빌드·린트·테스트 명령도 없다.

- `references/SPEC.md` — 합의된 명세 v2(2026-11-24). 무엇을 만들지에 대한 기준 문서다. `references/SPEC_ko.md`는 그 한국어 번역본이며 두 파일을 함께 맞춘다. 구현은 사용자가 명시적으로 요청할 때까지 보류한다.
- `agent-harness-tui` — 짝을 이루는 클라이언트(별도 Rust 프로젝트). 이 저장소에는 **없다.** `harness.toml`, `harness.lock.json`, `instructions/agent-db.*`, 아래 관리 블록을 이 도구가 만들었다. 실행할 때는 프로젝트 루트에서 실행한다. 상위 디렉터리를 찾거나 Git 초기화·커밋·푸시를 하지 않는다.
- `CLAUDE_ko.md` — `CLAUDE.md`의 한국어 짝(이 파일). 지침 문서는 영어·한국어 쌍으로 둔다.

소스 코드가 추가되면 실제 빌드·테스트 명령을 이 문서에 적는다.

## 이 서비스는 무엇인가

"하네스 콘텐츠 서비스": 프로젝트 에이전트가 쓰는 **스킬, 참조 문서, 지침**을 Git 밖에서 권한과 버전 이력을 갖춰 저장하고 제공하는, 여러 팀이 함께 쓰는 서비스다. 서비스는 콘텐츠만 제공한다. 프로젝트 파일에 반영하는 일(스텁, 지침 블록)은 클라이언트(`agent-harness-tui`)가 맡는다.

주요 용어: **콘텐츠 저장소**는 공유와 공개(`private`/`public`)의 단위다. **항목**은 `skill`(`SKILL.md` + 스크립트 같은 부속 파일), `reference`, `guidance` 중 하나다. 저장할 때마다 변경할 수 없는 **리비전**이 생긴다. **태그**는 리비전을 가리키며 `latest`는 항상 최신을 가리킨다(docker 방식). **프로젝트**는 대상 Git 저장소 하나와 대응하는 소비자 네임스페이스이고, 콘텐츠 저장소에 `read`/`write`로 연결된다.

## 계획된 설계 (명세 v2, 2026-11-24)

- 서버 프로그램 하나, admin 한 명(v1). 같은 핸들러와 권한 검사 위에 접점 셋: 웹 UI(사람의 기본 접점), REST API v1, MCP(읽기 도구, `write` 토큰이면 쓰기 도구도).
- 토큰은 서버가 발급하고 해시만 저장한다. 프로젝트 토큰(`read` 또는 `write`)과 admin 토큰이 있다. 토큰 없이는 `public` 저장소만 읽을 수 있다. 권한 없음과 없음은 같은 `404`.
- 속성: md frontmatter의 자유 key-value + 고정 `tags`, `version`. 기본으로 `latest`를 읽고 `ref`로 태그나 리비전을 고른다. `ETag`는 리비전을 가리키고, 쓰기는 `If-Match`가 필요하다.
- 항목 주소는 `<저장소 UUID>/<항목 UUID>@<ref>`이며, `@`가 없으면 `latest`다. 별칭은 검색 전용(중복 허용)이고, 식별자·경로·별칭·태그는 대소문자를 구분하지 않는다. frontmatter의 `version`이 바뀌면 버전 태그가 자동으로 생긴다. 삭제는 소프트 삭제. 재사용은 주로 복제(fork)로 한다.
- 저장: SQLite(WAL) + sha256 내용 주소 텍스트 본문. admin은 환경변수 `HCS_ADMIN_PASSWORD`로 로그인해 서버가 자동 생성한, 만료가 있는 admin 토큰(Bearer 헤더)을 받는다. 비밀번호는 저장하지 않는다. admin 토큰은 웹 UI 전용(`/ui/api/*`, REST·MCP는 거부), 12시간, 로테이션 없음. 프로젝트 토큰은 로테이션하지 않으며 만료일(무기한 가능)은 생성 시 정하고, admin이 폐기할 수 있다. 관리 기능은 웹 UI에만 있다. 인증 실패는 fail2ban용 고정 형식 한 줄로 로그에 남긴다(명세 §8-1). 삭제는 소프트 삭제만. 구현은 Node + TypeScript(기술 스택은 명세 §11).
- 카탈로그 JSON과 클라이언트 초기 구성(구 §8-1)은 폐기했다. MCP 전송 방식과 인증 처리는 구현 전에 최신 MCP 공식 명세로 확인한다. 추측하지 않는다.

## 지켜야 할 원칙

- 서버는 셸 명령이나 저장된 스크립트를 실행하지 않는다. 저장하고 전달만 한다.
- 토큰은 해시로만 저장한다. 로그에 토큰이나 본문을 남기지 않는다.
- 스텁에는 본문을 넣지 않고, 받아 온 본문은 Git 추적 경로에 저장하지 않는다(클라이언트 원칙).

## 열린 질문 (명세 §12)

MCP 전송·인증을 공식 명세로 확인한 뒤 조정 / 구현 착수 시 SQLite 드라이버와 HTTP 서버 선택. 혼자 결정하지 말고 묻는다.

<!-- agent-harness:begin agent-harness -->
## 에이전트 하네스

agent-harness-tui가 `harness.toml`에서 생성한 블록이다. 이 블록 밖의 내용은 자유롭게 편집한다. 블록 안을 수정하면 충돌로 보고된다.

### 경로

- `instructions/`: 진행 중인 작업 지시서.
- `instructions/.completed/<UUID>.md`: 완료된 지시서.
- `instructions/completed.log`: 완료 로그, 추가만 가능.
- `references/`: 참조 문서.
- `.skills/<id>/`: 스킬 원본 패키지. 관련 주제가 나오면 해당 위치의 `SKILL.md`를 읽는다. 여기에 경로를 적는다고 에이전트가 자동으로 찾는 것은 아니다.
- `.output/`: 생성 산출물. 단방향이며 다시 입력으로 읽지 않는다. Git으로 추적하지 않는다.
- `instructions/agent.db`: 백로그(`backlog` 테이블)와 지시서 상태(`instructions` 테이블). Git으로 추적하지 않는다. `bash instructions/agent-db.sh <command>` 또는 `pwsh -File instructions/agent-db.ps1 <command>`로 관리한다(인자 없이 실행하면 명령 목록이 나오며 `sqlite3` CLI가 필요하다). 완료된 지시서의 기준은 `instructions/completed.log`이다. 스크립트는 이 로그에 한 줄을 추가하기만 하고, 데이터베이스는 로그를 따라 맞춘다. 변경자를 기록하려면 `AGENT_DB_ACTOR`를 설정한다. 스키마는 바꾸지 않는다.

### 지시서

- 지시서 하나당 파일 하나: `instructions/NNNN_short-name.md`. `NNNN`은 `0001`부터 시작하는 4자리 순번이다.
- 지시서는 한국어로만 작성하는 Markdown이며 번역하지 않는다. 영어·한국어 쌍은 참조 문서·스킬·지침 문서에만 적용한다.
- 머리말에는 고정된 UUID와 상태(`TODO`, `IN_PROGRESS`, `DONE`)를 적는다:

  ```markdown
  # 0001 — <title>

  > UUID: <uuid>
  > Status: TODO
  ```

- UUID는 독립된 작업 사본 사이에서도 고유해야 한다. `NNNN`과 로그의 줄 순서는 로컬 순서일 뿐이며, 브랜치 전체의 고유 번호나 전역 시간순이 아니다.
- 지시서는 사용자가 명시적으로 완료라고 할 때만 완료다. 에이전트의 응답이나 세션 종료는 완료가 아니다. 완료 시 상태를 `DONE`으로 바꾸고 파일을 `instructions/.completed/<UUID>.md`로 옮긴 뒤 `instructions/completed.log`에 한 줄을 추가한다.
- 로그 형식: `UUID | summary | datetime with offset`. 예: `2026-11-16 14:00:00 +0900`.
- 로그를 비우거나, 고쳐 쓰거나, 순서·번호를 바꾸지 않는다. 병합 충돌이 나면 이력을 몰래 버리지 말고 사용자에게 드러낸다.

### Git

- 추적: `instructions/`(`instructions/.completed/`와 `instructions/completed.log` 포함), `references/`, `.skills/`, `harness.toml`, `harness.lock.json`, 루트 지침 파일.
- 제외: `.output/`, `.harness/`, `instructions/agent.db`, `instructions/agent.db-wal`, `instructions/agent.db-shm`, `instructions/agent.db-journal`. 인증 정보는 추적 파일에 넣지 않는다.

### 스킬

- Claude Code: 각 스킬은 `.skills/<id>/`에서 `.claude/skills/<id>/`로 복사되며, Claude Code는 그 위치에서 스킬을 찾는다. 복사본이 아니라 `.skills/`를 편집한다. 복사본은 다시 생성되며 Git으로 추적하지 않는다.
- 아직 선택한 스킬이 없다.

이 지침은 정책을 표현할 뿐이며, 파일 시스템·명령 실행 권한을 그 자체로 강제하지 않는다.
<!-- agent-harness:end agent-harness -->
