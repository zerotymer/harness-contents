# 0005 — REST API v1

> UUID: 521deebe-3b89-4468-801f-4a480801a7dc
> Status: TODO

> 착수 조건: 사용자가 이 지시서의 구현을 명시적으로 요청할 때만 시작한다. 기준 문서는 `references/SPEC.md`(번역본 `references/SPEC_ko.md`)이며, 명세와 다르게 해야 할 일이 생기면 구현하지 말고 먼저 묻는다.

## 목적

명세 §6-1의 REST API를 도메인·권한 계층 위에 얇게 구현한다.

## 근거

- 명세 §6-1 REST API v1

## 선행

- 0003, 0004

## 할 일

- [ ] `GET /health`
- [ ] `GET /v1/projects/{pid}/items` (kind·alias·tag·attr 필터)
- [ ] `GET /v1/repos/{repo}/items/{item}[@ref]`: 메타데이터와 파일 목록(`path`, `sha256`, `size`, `script_lang`)
- [ ] `GET .../files/{path}`: `text/plain; charset=utf-8`, 경로 정규화, `..`·절대 경로 거부
- [ ] `GET .../revisions`
- [ ] `POST /v1/repos/{repo}/items`, `PUT .../items/{item}`(`If-Match` 필수), `POST .../fork`, `DELETE .../items/{item}`
- [ ] 모든 응답 `ETag`, 읽기 `If-None-Match` → `304`
- [ ] 오류는 `application/problem+json`
- [ ] 요청 본문 크기 제한
- [ ] API 통합 테스트(권한별)

## 완료 조건

- 표의 모든 엔드포인트가 권한별 통합 테스트를 통과한다.
