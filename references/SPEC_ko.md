# 하네스 콘텐츠 서비스 — 명세 v2

> 상태: 합의안 v2 (2026-11-24). v1 초안(2026-11-23)의 "읽기 전용 파일 서버" 방향을 바꿔 **권한과 버전이 있는 콘텐츠 저장소**로 다시 정리했다.
> 이 문서는 `SPEC.md`의 한국어 번역본이다. 내용이 다르면 `SPEC.md`가 기준이며, 두 문서는 함께 맞춘다. 구현은 명시적 요청이 있을 때까지 보류한다.

## 0. v1 초안에서 바뀐 점

- 카탈로그 JSON(`catalogs/`, `/catalogs/{kind}`, 카탈로그 규약)은 폐기한다.
- 클라이언트 초기 구성(구 §8-1: `project.json`, `default.json`, 연결 화면)은 `agent-harness-tui`의 일이므로 이 문서에서 뺀다.
- 읽기 전용 → 쓰기 API, 버전 이력, 권한·토큰 관리를 범위에 넣는다.
- 저장소: 디렉터리 트리 → SQLite.
- 토큰: 환경변수 주입 → 서버가 발급하고 해시만 저장. admin은 환경변수 비밀번호로 로그인해 토큰을 받는다.

## 1. 목적

프로젝트 에이전트가 쓰는 **스킬, 참조 문서, 지침**을 Git 밖에서 동적으로 관리하고 제공한다. 서비스는 콘텐츠만 제공한다. 프로젝트 파일에 반영하는 일(스텁 생성, 지침 블록 갱신 등)은 클라이언트(`agent-harness-tui`)가 맡는다.

| 공유 수단 | 대상 |
| --- | --- |
| Git | 공개해도 되는 지침, 스킬, 참조 문서 |
| 환경변수 (별도 공유) | 비밀 값, 서비스 토큰 |
| **이 서비스** | 공유 범위를 통제하거나 실시간으로 받아야 하는 스킬·참조 문서·지침 (dynamic) |

## 2. 용어

- **콘텐츠 저장소(repository):** 콘텐츠 묶음. 공유와 공개의 단위다. (Git 저장소와 구분해 "콘텐츠 저장소"라 부른다.)
- **항목(item):** 콘텐츠 저장소 안의 콘텐츠 하나. 식별자는 **UUID**다. 종류는 셋이다.
  - `skill`: `SKILL.md`와 부속 파일(스크립트 등)의 묶음.
  - `reference`: md 문서 하나.
  - `guidance`: 지침 md 문서 하나.
- **별칭(alias):** **검색용** 이름. 한 대상에 여러 개를 붙일 수 있고, 다른 대상과 겹쳐도 된다. 식별에는 쓰지 않는다. 식별자는 항상 UUID다.
- **리비전(revision):** 항목의 변경할 수 없는 스냅샷. 저장할 때마다 1부터 하나씩 늘어난다.
- **버전 태그(version tag):** 리비전을 가리키는 이름. `latest`는 예약어이며 항상 최신 리비전을 가리킨다(docker 태그와 같은 방식). 검색용 속성 `tags`(§4-1)와는 다른 것이다.
- **프로젝트:** 콘텐츠를 쓰는 쪽의 네임스페이스. 대상 Git 저장소 하나와 대응한다.
- **연결(grant):** 프로젝트가 어떤 콘텐츠 저장소를 읽거나 쓸 수 있는지에 대한 기록.
- **토큰:** 서버가 발급하는 접근 키.
- **dynamic skill / dynamic reference:** 본문이 서비스에만 있는 스킬·참조 문서. 프로젝트에는 스텁이나 목록만 있다.

## 3. 배치

- 여러 팀이 함께 쓰는 서비스. 서버 프로그램은 하나다.
- 관리 주체는 **admin 한 명**이다(v1). 프로젝트·저장소·연결·토큰은 admin이 관리한다. 팀이 늘면 병목이 되는 한계는 받아들인다.
- 접점은 셋이며 모두 같은 핸들러와 **같은 권한 검사**를 쓴다: **웹 UI(브라우저), REST API, MCP.** 어느 접점이든 쓰기에는 `write` 토큰이 필요하다. admin 토큰은 웹 UI에서만 쓴다(§5).
  - 사람은 기본적으로 웹에서 편집한다. 에이전트는 REST나 MCP로 읽고, 권한이 있으면 쓴다(버전 올리기·배포를 어디서 할지는 팀마다 다르므로 세 접점 모두 쓰기를 지원한다).
- 기본 바인딩은 `127.0.0.1`. 외부 공개는 설정으로 명시할 때만 하고, TLS는 리버스 프록시가 맡는다.

## 4. 데이터 모델

| 엔터티 | 주요 필드 |
| --- | --- |
| Repository | `id`(UUID), `aliases[]`, `visibility`(`private` \| `public`), `description`, `created_at`, `deleted_at` |
| Item | `id`(UUID), `repository_id`(바뀌지 않음), `kind`, `aliases[]`, `forked_from`(저장소·항목·리비전, 선택), `created_at`, `deleted_at` |
| Revision | `item_id`, `rev`, `files[]`(`path`(원본 파일명, 예: `scripts/run.js`), `sha256`, `size`, `script_lang`), `attributes`, `message`, `author_token_id`, `created_at` |
| Blob | `sha256` → 본문(UTF-8 텍스트). 같은 내용은 한 번만 저장한다 |
| VersionTag | `item_id`, `name`, `rev` |
| Project | `id`(UUID), `aliases[]`, `description`, 기본 저장소 |
| Grant | `project_id`, `repository_id`, `access`(`read` \| `write`) |
| Token | `id`, `hash`, `scope`(`admin` \| `project`), `project_id`, `access`(`read` \| `write`), `label`, `source`(`issued` \| `admin_login`), `expires_at`, `revoked_at`, `last_used_at` |
| Audit | 시각, 토큰 id, 동작, 대상. 본문과 토큰 값은 남기지 않는다 |

### 4-1. 이름과 속성

- 저장 이름과 요청 이름은 **UUID**다. 별칭은 검색에만 쓰며 겹칠 수 있다.
- **대소문자:** 식별자(UUID)와 항목 안 파일 경로, 별칭, `tags`, 버전 태그는 모두 **대소문자를 구분하지 않고** 비교한다. UUID는 소문자로 정규화해 저장한다. 파일 경로와 별칭은 입력한 모양 그대로 보여 주되, 대소문자만 다른 두 경로는 한 항목 안에 둘 수 없다.
- **별칭·`tags`·버전 태그 문자 규칙:** 한글, 영문, 숫자, 공백, 일반 기호 `- _ . ( ) + #`. 1–64자. 저장 전에 유니코드 NFC로 정규화하고 앞뒤 공백을 없앤다. 주소 구문에 쓰는 `/`, `@`와 제어 문자는 쓸 수 없다. (버전 태그는 공백 불가, 숫자만으로 된 이름은 리비전 번호와 겹치므로 불가.)
- **고정 속성:** `tags`(검색용 문자열 목록), `version`(사람이 붙이는 버전 표기, 예: `1.2.0`).
- **자유 속성:** md frontmatter의 나머지 key-value. 저장할 때 frontmatter에서 뽑아 `attributes`에 넣는다. 원본은 본문의 frontmatter다.
- `skill`은 `SKILL.md` frontmatter에 `name`, `description`이 있어야 한다. `name`은 그 항목의 별칭으로 자동 등록된다.
- 검색은 **별칭과 `tags`**로 한다(종류·속성으로 거르기 포함). 결과는 UUID 목록이며, 그 뒤의 요청은 UUID로 한다. 전문 검색은 하지 않는다.

### 4-2. 버전

- 저장할 때마다 새 리비전을 만든다. 이전 리비전은 바꾸지 않는다.
- 주소는 `<저장소 UUID>/<항목 UUID>@<ref>` 형식이다. `<ref>`는 버전 태그나 리비전 번호다. **`@`가 없으면 `latest`**다.
  - 예: `<repo>/<item>`, `<repo>/<item>@latest`, `<repo>/<item>@1.2.0`, `<repo>/<item>@7`
  - 항목은 다른 저장소로 옮기지 않는다(옮기려면 복제). 그래서 주소는 바뀌지 않는다.
- frontmatter의 `version`이 바뀐 리비전을 저장하면 같은 이름의 버전 태그를 **자동으로 만든다.** 이미 다른 리비전에 있는 이름이면 저장을 거부한다(버전 태그는 옮기지 않는다, `latest` 제외).
- `ETag`는 리비전을 가리킨다. 읽기는 `If-None-Match`를 지원하고, 쓰기는 `If-Match`를 요구해 남의 변경을 덮어쓰지 않게 한다.
- 되돌리기는 이전 리비전의 내용으로 새 리비전을 만드는 것이다.
- 삭제는 **소프트 삭제**만 있다(`deleted_at`). 삭제된 항목은 목록과 검색에서 빠지고, UUID로는 admin만 볼 수 있다. 복구할 수 있다. 영구 삭제는 두지 않는다(필요하면 별도 기능으로 추가).

### 4-3. 공유와 재사용

- 공유 단위는 **콘텐츠 저장소**다. 같은 저장소를 여러 프로젝트에 연결하면 원본 하나를 여러 프로젝트가 함께 쓴다.
- `public` 저장소는 토큰 없이 누구나 읽을 수 있다.
- 프로젝트를 만들면 그 프로젝트 전용 기본 저장소를 하나 만들고 `write`로 연결한다.
- 재사용의 기본 방법은 **복제(fork)**다. 공유·공개 항목을 내 저장소에 새 항목(새 UUID)으로 복사하고 출처(`forked_from`)를 기록한다. 원본이 새 리비전을 내면 복제본에서 알 수 있게 한다(갱신은 사람이 결정).
- 별칭은 검색에만 쓰므로 겹쳐도 해석 충돌이 없다. 같은 별칭의 항목이 여러 개면 검색 결과에 모두 나온다.

## 5. 권한과 토큰

| 주체 | 할 수 있는 일 |
| --- | --- |
| 토큰 없음 | `public` 저장소 읽기, `/health` |
| 프로젝트 토큰 `read` | 연결된 저장소와 `public` 저장소 읽기 |
| 프로젝트 토큰 `write` | `read` + `write`로 연결된 저장소에 항목 생성·수정·삭제·복제 |
| admin 토큰 (비밀번호 로그인으로 발급, **웹 UI 전용**) | 전부. 프로젝트·저장소·연결·토큰 관리, 삭제 항목 복구 |

- 프로젝트 토큰의 권한은 웹·REST·MCP 모두에 똑같이 적용된다. **admin 토큰은 웹 UI API(`/ui/api/*`)에서만 받고, REST(`/v1/*`)와 MCP는 admin 토큰을 거부한다.**
- 요청은 `Authorization: Bearer <token>`을 쓴다. **웹 UI도 같은 헤더를 쓴다:** 로그인 때 입력한 토큰을 브라우저 탭 메모리(또는 `sessionStorage`)에 두고 요청마다 헤더로 보낸다. 쿠키를 쓰지 않으므로 CSRF 대책이 필요 없다. 대신 md 미리보기는 반드시 정제(sanitize)해 스크립트 삽입(XSS)을 막는다.
- 프로젝트 토큰 값은 발급할 때 한 번만 보여 준다. 서버는 해시만 저장한다. 만료는 §5-2.
- 권한 없음과 없음은 같은 `404`로 응답해 비공개 대상의 존재를 드러내지 않는다(REST와 웹 UI API). MCP의 인증 실패는 표준 `401`을 쓴다(§6-2).

### 5-1. admin 로그인

- admin 비밀번호는 환경변수 `HCS_ADMIN_PASSWORD`로만 준다. 파일에 쓰지 않고, DB에도 저장하지 않는다.
- admin은 웹 UI에서 비밀번호로 로그인하고(`POST /ui/api/admin/login`), 서버가 **자동 생성한 admin 토큰**을 받는다. 웹 UI는 이후 요청에 이 토큰을 `Authorization: Bearer` 헤더로 보낸다.
- admin 토큰은 해시만 저장하고 **12시간** 뒤 만료된다. 로테이션은 없고, 만료되면 다시 로그인한다. 서버를 다시 시작하면 그전에 발급한 admin 토큰은 모두 폐기한다(비밀번호 변경이 바로 반영되게).
- 비밀번호 비교는 상수 시간으로 한다. 비밀번호는 **8자 이상**이어야 하며 기동 시 검사한다. 로그인 실패 응답은 일정 시간 지연하고, 실패는 정해진 형식으로 로그에 남겨 fail2ban이 차단하게 한다(§8-1).
- `HCS_ADMIN_PASSWORD`가 없거나 8자보다 짧으면 서버는 뜨지만 admin 로그인을 끈다(경고 출력). 읽기·쓰기는 기존 프로젝트 토큰으로 계속 된다.

### 5-2. 프로젝트 토큰 만료

- 프로젝트 토큰은 **로테이션하지 않는다.**
- 만료일은 **처음 만들 때** 정하며, 무기한도 가능하다. 만료일 전까지는 계속 쓸 수 있다.
- 만료일은 만든 뒤 바꾸지 않는다. 기간을 늘리려면 새 토큰을 만든다.
- admin은 웹 UI에서 토큰을 폐기할 수 있다(유출 대응용).

## 6. 접점

### 6-1. REST API v1

`{repo}`, `{item}`은 UUID다. `{item}` 뒤에 `@<ref>`를 붙일 수 있다(없으면 `latest`).

| 메서드·경로 | 내용 | 권한 |
| --- | --- | --- |
| `GET /health` | 상태, 서비스 버전 | 없음 |
| `GET /v1/projects/{pid}/items?kind=&alias=&tag=&attr.<key>=` | 프로젝트에서 보이는 항목 목록 | read |
| `GET /v1/repos/{repo}/items/{item}` | 항목 메타데이터와 파일 목록(`path`, `sha256`, `size`, `script_lang`) | read |
| `GET /v1/repos/{repo}/items/{item}/files/{path}` | 파일 본문 (`text/plain; charset=utf-8`) | read |
| `GET /v1/repos/{repo}/items/{item}/revisions` | 리비전 이력 | read |
| `POST /v1/repos/{repo}/items` | 항목 생성 | write |
| `PUT /v1/repos/{repo}/items/{item}` | 새 리비전 저장 (`If-Match` 필수) | write |
| `POST /v1/repos/{repo}/items/{item}/fork` | 복제 | write |
| `DELETE /v1/repos/{repo}/items/{item}` | 소프트 삭제 | write |

- REST는 프로젝트 토큰(또는 토큰 없이 `public` 읽기)만 받는다. 관리 기능은 REST에 없고 웹 UI에만 있다.
- 오류는 `application/problem+json`.
- 파일 경로는 정규화하고 `..`, 절대 경로를 거부한다.

### 6-2. MCP

- 같은 핸들러 위에 얇은 도구를 둔다.
  - 읽기: `list_items`(종류·별칭·`tags`·속성으로 거르기), `get_item`, `get_item_file`, `list_revisions`
  - 쓰기(`write` 토큰만): `put_item`, `fork_item`
- 토큰 권한에 따라 보이는 도구가 달라진다.
- **주소는 문자열 하나**(`address`)로 받는다: `<저장소 UUID>/<항목 UUID>[@<ref>]`. `list_items` 결과마다 완성된 `address`를 넣어 에이전트가 그대로 복사해 쓰게 한다. 도구 입력 스키마에 정규식 `pattern`을 걸어 잘못된 주소를 일찍 거른다. REST 경로와 같은 구문이라 문서와 로그에서도 하나로 통일된다.
- **전송:** Streamable HTTP, 단일 엔드포인트 `POST /mcp`, 세션 없음. MCP 명세 2026-07-28 기준(2026-11-24 확인, MCP 명세가 개정되면 다시 확인).
- **인증:** 모든 요청에 프로젝트 토큰을 `Authorization: Bearer <token>`으로 보낸다(쿼리 문자열 금지). 토큰이 없으면 `public` 저장소만 읽을 수 있다.
  - 잘못된·만료된·폐기된 토큰이나 admin 토큰은 표준 `401 Unauthorized`와 `WWW-Authenticate: Bearer realm="hcs", error="invalid_token"`(RFC 6750)으로 응답한다. OAuth 흐름과 보호 자원 메타데이터는 제공하지 않는다.
  - `/mcp`는 프로젝트별 주소가 아니므로 `401`이 프로젝트 존재를 드러내지 않는다. 도구 안에서는 권한 없음과 없음을 같은 오류로 돌려준다.
- **Origin 검사:** `Origin` 헤더가 있는데 `HCS_ALLOWED_ORIGINS`에 없으면 `403 Forbidden`(MCP 명세가 요구하는 DNS 리바인딩 방지). `Origin`이 없는 요청(브라우저가 아닌 클라이언트)은 영향이 없다.

### 6-3. 웹 UI

- admin: 프로젝트·저장소·연결·토큰 관리, 삭제 항목 복구, 콘텐츠 편집.
- 웹 UI는 자기 전용 API `/ui/api/*`를 쓴다. admin 토큰과 프로젝트 토큰을 모두 받는다.
  - `POST /ui/api/admin/login`: 비밀번호로 admin 토큰 발급 (권한 없음)
  - `/ui/api/admin/{projects,repos,grants,tokens}`: 관리 (admin)
  - 콘텐츠 읽기·쓰기는 REST와 같은 핸들러를 쓴다.
- `/ui/api/*`는 공개 계약이 아니다. 버전을 붙이지 않고 웹 UI와 함께 바뀐다. (주의: HTTP로 열려 있으므로 admin 토큰을 가진 사람이 직접 부를 수는 있다. 이 구분은 "admin 토큰을 자동화에 쓰지 않는다"는 사용 범위의 경계이지 비밀 장치가 아니다.)
- `write` 권한: md 편집, 파일 추가, 리비전 비교(diff), 복제, 되돌리기, 삭제.
- md 편집기와 diff 표시는 외부 라이브러리를 쓴다(§11).

## 7. 저장

- **SQLite(WAL)**를 쓴다. 메타데이터와 본문을 함께 둔다. 본문은 sha256 내용 주소로 저장해 중복을 없앤다.
- 쓰기는 한 번에 하나(SQLite 특성). 사람이 편집하는 빈도에는 충분하다. 서버 여러 대·고가용성은 v1 범위 밖이다.
- 텍스트(UTF-8)만 저장한다. 일괄 가져오기·내보내기는 두지 않는다(백업은 SQLite 파일 백업).
- 파일 본문은 DB 안에 있으므로 서버 디스크에 실행 가능한 파일이 생기지 않는다. 원본 파일명은 `path`에 따로 저장한다.

### 7-1. 크기 제한 (기본값, 설정으로 변경 가능)

| 대상 | 기본값 | 근거 |
| --- | --- | --- |
| 파일 하나 | 1 MiB (256 KiB 넘으면 경고) | md 문서는 보통 수 KB~수십 KB. 256 KiB는 대략 수만 토큰으로, 에이전트 컨텍스트에 한 번에 넣기에 이미 크다 |
| 항목 하나(모든 파일 합) | 5 MiB | 스킬 본문 + 스크립트 여러 개에 충분 |
| 항목 하나의 파일 수 | 100 | |
| frontmatter | 64 KiB | 속성은 짧은 값이어야 한다 |
| 별칭·`tags`·버전 태그 | 1–64자, 항목당 `tags` 32개·별칭 16개 | |
| 요청 본문 | 항목 한도 + 여유 (6 MiB) | |

## 8. 보안 원칙

- 서버는 셸을 실행하지 않고 스크립트도 실행하지 않는다. 저장하고 전달만 한다.
- **스크립트:** 언어 제한 없이 허용한다. 파일마다 언어(`script_lang`, 예: `js`)와 원본 파일명(`path`)을 저장하고, 본문은 항상 `text/plain`으로 전달한다. 서버는 실행하지 않는다.
- 서버는 파일마다 **해시와 리비전**을 제공한다. 실행 전 검토는 실행하는 쪽(클라이언트·에이전트)이 강제한다. 예: 마지막으로 검토한 해시와 다르면 실행 전에 다시 검토.
- 토큰은 해시만 저장한다. 로그에 토큰, 비밀번호, 본문을 남기지 않는다.
- 클라이언트 쪽 원칙(참고): 스텁에는 본문을 넣지 않는다. 받아 온 본문은 Git 추적 경로에 저장하지 않는다.

### 8-1. 인증 실패 로그 (fail2ban 용)

인증 실패는 아래 형식의 **한 줄**로 남긴다. 형식은 고정이며 바꾸면 호환성 변경으로 취급한다.

```
<ISO8601 UTC 시각> hcs auth_failed ip=<클라이언트 IP> kind=<admin_login|bearer> path=<요청 경로>
```

예:

```
2026-11-24T07:30:00.123Z hcs auth_failed ip=203.0.113.5 kind=admin_login path=/ui/api/admin/login
```

- `admin_login`: 비밀번호가 틀림. `bearer`: 없는·만료된·폐기된 토큰, 또는 REST·MCP에 admin 토큰을 보냄. (REST는 §5대로 `404`, MCP는 §6-2대로 `401`로 응답하지만 어느 쪽이든 로그에는 실패로 남긴다.)
- 비밀번호, 토큰 값, 본문은 절대 넣지 않는다.
- 로그는 표준 출력으로 내보낸다. `HCS_LOG_FILE`을 주면 파일에도 쓴다(fail2ban이 파일이나 systemd journal 어느 쪽이든 읽을 수 있게).
- 리버스 프록시 뒤에서는 `HCS_TRUSTED_PROXIES`에 적힌 주소에서 온 요청만 `X-Forwarded-For`를 믿는다. 그렇지 않으면 연결한 쪽 IP를 쓴다(프록시 IP가 차단되는 일을 막기 위해).

fail2ban 설정 예:

```ini
# /etc/fail2ban/filter.d/hcs.conf
[Definition]
failregex = ^\S+ hcs auth_failed ip=<HOST> kind=\S+ path=\S+$
datepattern = ^%%Y-%%m-%%dT%%H:%%M:%%S

# /etc/fail2ban/jail.d/hcs.conf
[hcs]
enabled  = true
filter   = hcs
logpath  = /var/log/hcs/hcs.log
maxretry = 5
findtime = 10m
bantime  = 1h
```

## 9. 범위 밖 (v1)

여러 admin, 팀별 관리자 위임, 영구 삭제, 요청 제한, 프로젝트별 용량 한도, SSO·OAuth 로그인, 바이너리 파일, 서버 측 스크립트 실행, 전문 검색, 일괄 가져오기·내보내기, 서버 여러 대·고가용성, WebDAV, 원격 동기화, 위키(md-gw) 프록시, 카탈로그 JSON.

## 10. 결정 기록 (2026-11-24)

- 카탈로그와 구 §8-1은 폐기한다.
- 관리 주체는 admin 한 명. 한계는 받아들인다. 토큰은 프로젝트별 `read`/`write`.
- 공유 단위는 콘텐츠 저장소. `public` 공개를 지원한다. 재사용은 복제를 적극 쓴다.
- 쓰기 접점: 웹(기본), REST API, MCP. 모든 접점에서 쓰기는 `write` 토큰이 필요하다.
- 속성: frontmatter 계열(자유) + 고정(`tags`, `version`). `version` 변경 시 버전 태그를 자동 생성한다.
- 서비스는 콘텐츠만 제공한다.
- 여러 팀이 함께 쓰는 서비스.
- 주소는 `<저장소 UUID>/<항목 UUID>@<ref>`, `@`가 없으면 `latest`. 버전은 항목 단위.
- 저장소는 SQLite.
- admin은 `HCS_ADMIN_PASSWORD`로 로그인하고, admin 토큰은 서버가 자동 생성한다(Bearer 헤더).
- 삭제는 소프트 삭제만. 영구 삭제는 필요하면 별도 기능.
- 프로젝트 용량 한도와 요청 제한은 없다.
- 구현 언어는 Node(TypeScript). 기술 스택은 §11 후보로 확정(버전·상태는 착수 시 확인).
- admin 토큰은 웹 UI 전용, 12시간, 로테이션 없음(만료되면 다시 로그인).
- 프로젝트 토큰은 로테이션 없음. 만료일은 생성 시 지정(무기한 가능), 그전까지 계속 사용. admin은 폐기 가능.
- 관리 기능은 웹 UI(`/ui/api/*`)에만 있고 REST·MCP에는 없다.
- admin 비밀번호는 8자 이상. 요청 제한 대신 fail2ban이 읽을 고정 형식의 인증 실패 로그를 남긴다.
- MCP 주소는 문자열 하나(`address`).
- 식별자는 UUID. 별칭은 검색 전용, 여러 개·중복 허용. 검색은 별칭과 `tags`. 일괄 가져오기·내보내기는 없다.
- 식별자·경로·별칭·태그는 대소문자를 구분하지 않는다. 별칭은 한글·영문·숫자·일반 기호.
- 스크립트는 언어 제한 없음. 원본 파일명은 따로 저장한다. 서버는 해시와 리비전만 주고, 검토는 실행 쪽이 강제한다.
- 웹 UI는 쿠키 없이 Bearer 헤더를 쓴다(CSRF 대책 불필요).
- 크기 제한 기본값은 §7-1.
- MCP: `POST /mcp`(Streamable HTTP, 세션 없음). 인증 실패는 표준 `401` + `WWW-Authenticate: Bearer`(RFC 6750). `Origin`은 `HCS_ALLOWED_ORIGINS`로 검사한다.
- 기술 스택은 지시서 0001로 §11과 같이 확정: Hono, `node:sqlite`, MCP TypeScript SDK v2, Biome, `node:test`, 빌드 단계 없음.

## 11. 기술 스택 (지시서 0001로 확정, 2026-11-24)

| 용도 | 후보 | 메모 |
| --- | --- | --- |
| 언어·런타임 | Node LTS + TypeScript | |
| 실행 | Node 24.15 이상이 TypeScript를 바로 실행(타입 제거) | 빌드 단계 없음, 타입 검사만 `tsc --noEmit`(TypeScript 7) |
| HTTP 서버 | Hono + `@hono/node-server` | 웹 표준 Request/Response, 공식 MCP Hono 어댑터, `app.request()`로 프로세스 안 테스트 |
| SQLite | 내장 `node:sqlite` | Node 24.15부터 Release candidate, 네이티브 빌드 불필요 |
| MCP | `@modelcontextprotocol/server` + `@modelcontextprotocol/hono` (SDK v2) | 웹 표준 Streamable HTTP 전송, 세션 없는 방식 |
| 린트·포맷 | Biome | |
| 테스트 | `node:test` + `node:assert` | 추가 의존성 없음 |
| md 편집기 | CodeMirror 6 | 가볍고 md 모드 있음 |
| md 렌더링 + 정제 | markdown-it + DOMPurify | 미리보기 XSS 방지 |
| diff 표시 | jsdiff (+ diff2html) | 리비전 비교 |

## 12. 열린 질문

현재 없음. (MCP 명세가 개정되면 §6-2를 다시 확인한다.)
