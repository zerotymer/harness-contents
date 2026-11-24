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
