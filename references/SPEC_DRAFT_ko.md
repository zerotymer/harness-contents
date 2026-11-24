# 하네스 콘텐츠 서비스 — 설계 초안 (신규 프로젝트용)

> 상태: 초안 (2026-11-23). `agent-harness-tui`와 분리된 별도 프로젝트로 만든다.
> 합의 후 영어 `SPEC.md`와 짝을 만든다.

## 1. 목적

개발 환경 구성에서 대부분은 Git으로 공유한다. 이 서비스는 **Git으로 공유하지 않을 내용**만 맡는다.

| 공유 수단 | 대상 |
| --- | --- |
| Git | 공개해도 되는 지침, 스킬, 참조 문서 |
| 환경변수 (별도 공유) | 비밀 값, 서비스 토큰 |
| **이 서비스** | 공유하고 싶지 않거나 실시간으로 받아야 하는 스킬·참조 문서 (dynamic skills, dynamic references), 카탈로그 JSON |

## 2. 용어

- **dynamic skill:** 본문은 서비스에만 있는 스킬. 프로젝트에는 스텁만 두고, 에이전트가 사용할 때마다 본문을 받아 온다.
- **dynamic reference:** 본문이 서비스에만 있는 참조 문서. 프로젝트에는 목록만 있다.
- **스텁:** 이름, 설명, 가져오는 방법만 담은 파일. 본문은 담지 않는다.
- **프로젝트:** 서비스 안의 네임스페이스. 대상 저장소 하나와 대응한다.

## 3. 배치

- 바이너리 하나, 서버 하나(팀 또는 호스트 단위). 프로젝트는 설정으로 구분한다.
- 경량 유지: DB 없음. 저장소는 평범한 디렉터리다.
- 기본 바인딩은 `127.0.0.1`. 외부 공개는 설정으로 명시할 때만 하고, TLS는 리버스 프록시가 맡는다.

## 4. 저장 구조

```
<data_dir>/
  projects/<project-id>/
    catalogs/            # agents.json, skills.json, wiki.json, docs.json, hooks.json
    skills/<name>/       # SKILL.md + 부속 파일
    references/          # 임의 파일
```

- 1차 버전은 읽기 전용 API만 제공한다. 내용은 서버의 디렉터리를 직접 고쳐서 바꾼다.
- 파일을 고치면 다음 요청부터 바로 반영된다(dynamic).

## 5. 설정 (`service.toml`)

```toml
schema_version = 1
bind = "127.0.0.1:7878"
data_dir = "./data"

[[projects]]
id = "agent-harness-tui"
auth = "token"                     # "open" | "token"
token_env = "HARNESS_SVC_TOKEN_AHT" # 토큰 값은 환경변수로만 주입
```

- 인증은 프로젝트마다 `open` 또는 `token` 중 하나다.
- `token`이면 `Authorization: Bearer <token>`을 쓴다. 토큰 값은 설정 파일에 쓰지 않는다.
- 환경변수가 비어 있으면 그 프로젝트는 시작 시 오류로 거부한다. `open`으로 조용히 바뀌지 않는다.
- 모르는 키는 거부한다.

## 6. REST API (v1, 읽기 전용)

| 메서드·경로 | 응답 |
| --- | --- |
| `GET /health` | 상태, 서비스 버전, 규약 버전 (인증 없음) |
| `GET /v1/projects/{pid}/catalogs/{kind}` | 카탈로그 JSON (`agent-harness-tui` 카탈로그 규약과 같은 형식) |
| `GET /v1/projects/{pid}/skills` | 스킬 목록: `name`, `description`, `etag` |
| `GET /v1/projects/{pid}/skills/{name}` | `SKILL.md` 본문 |
| `GET /v1/projects/{pid}/skills/{name}/files/{path}` | 부속 파일 |
| `GET /v1/projects/{pid}/references` | 참조 문서 목록: `path`, `title`, `etag` |
| `GET /v1/projects/{pid}/references/{path}` | 참조 문서 본문 |

- 모든 응답에 `ETag`를 붙이고 `If-None-Match`를 지원한다.
- 오류는 `application/problem+json`으로 보낸다. 다른 프로젝트의 존재 여부가 드러나지 않도록 인증 실패와 미존재는 같은 `404`로 응답한다.
- 경로는 정규화하고 `..`, 절대 경로, 심볼릭 링크로 `data_dir` 밖으로 나가는 요청은 거부한다.

## 7. MCP

- 같은 핸들러 위에 MCP 도구를 얇게 둔다: `list_skills`, `get_skill`, `list_references`, `get_reference`.
- 전송 방식(HTTP 계열)과 인증 헤더 처리는 **구현 전에 최신 MCP 공식 명세로 확인한다.** 추측하지 않는다.

## 8. 클라이언트 측 (`agent-harness-tui`가 할 일)

- `harness.toml`에 서비스 연결 정보를 둔다. URL과 프로젝트 id는 Git으로 공유하고, 토큰은 `token_env`의 환경변수 이름만 적는다.
- **dynamic skill 스텁:** 에이전트 스킬 디렉터리에 `SKILL.md`를 만든다. frontmatter의 `name`·`description`은 서비스 목록 값이고, 본문은 "MCP `get_skill` 또는 REST로 최신 본문을 읽어 따른다"는 안내만 담는다.
- **dynamic reference:** 지침 파일의 관리 블록에 목록과 읽는 방법만 적는다.
- 스킬 이름이나 설명 자체도 비공개라면, 스텁을 Git에서 제외하도록 스킬별로 고를 수 있게 한다.
- 받아 온 본문은 Git 추적 경로에 저장하지 않는다. 캐시가 필요하면 Git에서 제외된 임시 경로(예: `.artifact/`)만 쓴다.
- 카탈로그는 로컬 JSON 파일이나 서비스 둘 중 하나에서 읽는다(JSON 고정 지원).

## 8-1. 초기 구성 파일 (2026-11-23 결정)

| 파일 | 역할 |
| --- | --- |
| `project.json` | 프로젝트 구성. 있으면 이것을 읽는다. 사용자(배포 책임자)가 작성하고 책임진다 |
| `default.json` | `project.json`이 없을 때 읽는 기본 구성 |

- 목록: `agents`, `skills`, `wiki-skill`(static, 내려받아 저장), `docs`, `hooks`(지금은 더미).
- 연결 화면: dynamic skills와 dynamic references의 서비스 연결(URL, 프로젝트 id, 토큰)을 설정하고 연결을 확인한다.
- **설치 명령은 사용자 책임이다.** `project.json`에 적힌 인자 배열을 TUI가 보여 주고, 사용자가 확인하면 셸 없이 실행한다. 출처 검증이나 차단 정책은 두지 않는다.
- **토큰은 로컬에 둔다(권장):** `.harness/local.toml`(Git 제외). 환경변수가 있으면 환경변수를 먼저 쓴다. 화면에 값을 표시하지 않는다.
- **재현성은 Git이 맡는다.** TUI는 초기 구성만 책임진다. 이후 갱신 지원은 있으면 좋은 기능으로 남긴다.
- 비밀 값은 `project.json`·`default.json`에 넣지 않는다.

## 9. 보안 원칙

- 토큰과 비밀 값은 파일에 쓰지 않는다.
- 스텁에는 본문을 넣지 않는다.
- 읽기 전용, 셸 실행 없음, 파일 시스템 밖 접근 없음.
- 요청 로그에 토큰과 본문을 남기지 않는다.

## 10. 범위 밖 (1차 버전)

쓰기 API, WebDAV, 원격 동기화, 사용자·권한 관리, 버전 이력, 위키(md-gw) 프록시. 위키 연동은 필요해지면 "프로젝트 디렉터리로 가져오기" 명령으로 따로 추가한다.

## 11. 열린 질문

1. 프로젝트 하나에 토큰 하나로 충분한가, 아니면 읽기 범위를 나눈 토큰이 필요한가.
2. 에이전트가 오프라인일 때 동작: 실패로 보고할지, `.artifact/` 캐시를 허용할지.
3. 서버 구현 언어: `agent-harness-tui`와 같은 Rust로 할지(카탈로그 규약 코드 공유).
4. 카탈로그 규약을 두 프로젝트가 함께 쓸 때 어느 쪽이 원본인지.
