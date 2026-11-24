# 0007 — 웹 UI API와 관리 기능

> UUID: aac6f62f-f61f-4b85-9c7c-4bb00bf7febe
> Status: TODO

> 착수 조건: 사용자가 이 지시서의 구현을 명시적으로 요청할 때만 시작한다. 기준 문서는 `references/SPEC.md`(번역본 `references/SPEC_ko.md`)이며, 명세와 다르게 해야 할 일이 생기면 구현하지 말고 먼저 묻는다.

## 목적

웹 UI 전용 API `/ui/api/*`와 admin 관리 기능을 구현한다.

## 근거

- 명세 §5-1 admin 로그인, §6-3 웹 UI

## 선행

- 0004, 0005

## 할 일

- [ ] `POST /ui/api/admin/login`
- [ ] `/ui/api/admin/projects`: 프로젝트 생성 시 기본 저장소 생성과 `write` 연결
- [ ] `/ui/api/admin/repos`: 저장소 생성, `public`/`private`, 별칭, 소프트 삭제·복구
- [ ] `/ui/api/admin/grants`: 연결 추가·제거
- [ ] `/ui/api/admin/tokens`: 발급(만료일 지정), 목록(값 제외), 폐기
- [ ] 삭제된 항목 조회·복구(admin)
- [ ] 콘텐츠 읽기·쓰기는 REST와 같은 핸들러 재사용
- [ ] 통합 테스트

## 완료 조건

- admin 토큰으로 관리 기능 전체가 동작하고, 프로젝트 토큰으로는 관리 기능이 `404`다.
