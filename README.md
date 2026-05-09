# 우리가정 자산관리사

가족 자산을 한눈에 — 대시보드 · 자산현황 · 수입/지출 · 재무상태표 · 계좌관리

---

## 🚀 GitHub Pages 배포 방법

### 1. 폴더 구조 만들기

```
wealth-manager/
├── index.html
├── manifest.json
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── wealth-manager.jsx        ← 메인 앱 컴포넌트
└── src/
    ├── main.jsx
    └── index.css
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 로컬 개발 서버

```bash
npm run dev
```
브라우저에서 http://localhost:5173 열기

### 4. 빌드

```bash
npm run build
```
`dist/` 폴더에 정적 파일 생성됨

### 5. GitHub Pages 배포

**방법 A — gh-pages 패키지 (추천)**

```bash
npm install --save-dev gh-pages
```

`package.json`에 추가:
```json
"scripts": {
  "deploy": "gh-pages -d dist"
}
```

```bash
npm run build && npm run deploy
```

GitHub 저장소 Settings → Pages → Source: `gh-pages` 브랜치 선택

**방법 B — GitHub Actions 자동배포**

`.github/workflows/deploy.yml` 파일 생성:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

### 6. vite.config.js 수정

배포 URL에 맞게 `base` 수정:
- `https://username.github.io/wealth-manager/` → `base: "/wealth-manager/"`
- `https://username.github.io/` (루트) → `base: "/"`

---

## 📱 홈 화면에 추가 (PWA)

### iPhone (Safari)
1. Safari에서 앱 URL 열기
2. 하단 공유 버튼(□↑) 탭
3. "홈 화면에 추가" 선택

### Android (Chrome)
1. Chrome에서 앱 URL 열기
2. 우측 상단 ⋮ 메뉴
3. "홈 화면에 추가" 또는 "앱 설치" 선택

---

## 🤖 AI 계좌 파싱 기능

설정 → "AI 계좌 자동 파싱" → 은행 앱 스크린샷 업로드

Claude Vision이 계좌번호, 잔액, 상품명을 자동 추출합니다.
추출 결과를 확인/수정 후 "선택 항목 추가"로 저장.

> **참고**: claude.ai 아티팩트에서 직접 실행 시 API 키가 자동 주입됩니다.
> 독립 배포 환경에서는 환경변수 `VITE_ANTHROPIC_API_KEY` 설정 필요.

---

## 📊 Google Sheets 연동

설정 → CSV 내보내기 → Google Sheets에 붙여넣기

| CSV 파일 | Sheets 탭 이름 |
|---|---|
| 계좌현황.csv | 계좌목록 |
| 재무상태표이력.csv | 재무상태표_이력 |
| 수입지출실적.csv | 수입지출_월별 |

---

## 💾 데이터 저장

모든 데이터는 브라우저 `localStorage`에 저장됩니다.
- 같은 브라우저·기기에서 유지
- 정기적으로 설정 → JSON 내보내기로 백업 권장
- 다른 기기로 이전 시 JSON 파일 가져오기 사용
