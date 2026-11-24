# 0006 — MCP 서버

> UUID: ae13753f-4433-404e-948e-36b83965cd94
> Status: TODO

> 착수 조건: 사용자가 이 지시서의 구현을 명시적으로 요청할 때만 시작한다. 기준 문서는 `references/SPEC.md`(번역본 `references/SPEC_ko.md`)이며, 명세와 다르게 해야 할 일이 생기면 구현하지 말고 먼저 묻는다.

## 목적

같은 핸들러 위에 MCP 도구를 얇게 구현한다.

## 근거

- 명세 §6-2 MCP

## 선행

- 0001의 MCP 명세 확인 결과, 0003, 0004

## 할 일

- [ ] 0001에서 확인한 전송 방식·인증 처리로 MCP 엔드포인트 구성 (확인 결과가 명세와 다르면 먼저 묻는다)
- [ ] 읽기 도구: `list_items`, `get_item`, `get_item_file`, `list_revisions`
- [ ] 쓰기 도구(`write` 토큰만 노출): `put_item`, `fork_item`
- [ ] 주소는 문자열 하나(`address`), 입력 스키마에 정규식 `pattern`
- [ ] `list_items` 결과마다 완성된 `address` 포함
- [ ] admin 토큰 거부
- [ ] 실제 MCP 클라이언트로 연결 테스트

## 완료 조건

- MCP 클라이언트에서 토큰 권한별로 보이는 도구가 다르고, 읽기·쓰기가 REST와 같은 결과를 낸다.
