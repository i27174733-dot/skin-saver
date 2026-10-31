# 스킨세이버 (Cloudflare Pages 배포 방법)

폴더 구조: index.html (화면) + functions/api/analyze.js (서버, Claude API 호출)

## 배포 (가장 쉬운 방법: GitHub 연동)
1. 이 폴더를 GitHub 저장소에 올리기
2. Cloudflare 대시보드 > Workers & Pages > Create > Pages > Connect to Git
3. 빌드 설정: Framework = None, Build command 비움, Output directory = `/`
4. 배포 후 Settings > Variables and Secrets 에서 `ANTHROPIC_API_KEY` 를 Secret으로 추가
   (console.anthropic.com 에서 발급) 후 다시 배포
5. 발급된 `xxx.pages.dev` 주소가 제출할 링크

## 터미널로 배포
npx wrangler pages deploy . --project-name=skin-saver
npx wrangler pages secret put ANTHROPIC_API_KEY --project-name=skin-saver
