# Hotel Ocean View 홈페이지

- `site/` — 실제 홈페이지 (GitHub Pages로 자동 배포, main 브랜치에 push 하면 1~2분 뒤 반영)
- `site/config.js` — 예약 문의 수신 주소 설정
- `apps-script/Code.gs` — 예약 문의 → 구글 시트 기록 + front@hoteloceanview.co.kr 알림 메일 (설치 방법은 파일 상단 주석)
- `tools/` — 사진 보정(`build-images.js`), 미리보기 서버(`serve.js`)

## 로컬 미리보기
```
node tools/serve.js site 5173
```
