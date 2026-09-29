# 소나무의 기록

GitHub Pages 블로그. 글 원본은 `content/posts`에 마크다운으로 저장됩니다.

## 글쓰기와 수정

블로그 상단 **글쓰기** 또는 글 하단 **이 글 수정하기**를 누릅니다. GitHub에서 내용을 편집한 후 **Commit changes → Commit directly to the main branch**로 저장합니다. 파일 이름은 날짜와 영문 소문자, 숫자, 하이픈으로 만듭니다. 같은 날짜에도 서로 다른 파일 이름을 쓰면 여러 글을 게시할 수 있습니다.

메타데이터 예시:

```text
---
title: 오늘 배운 것
date: 2026-09-29
category: 개발
description: 글의 짧은 소개.
---

본문을 작성합니다.
```

`draft: true`를 추가하면 사이트에 노출되지 않습니다. 공개 저장소이므로 초안 원문은 GitHub에서 볼 수 있습니다.

## 기여 기록

본인 계정과 연결된 이메일로, 포크가 아닌 저장소의 기본 브랜치 main에 커밋해야 합니다. GitHub 웹 편집기에서 본인 계정으로 저장하는 방식을 권장합니다. 변경 사항마다 저장(커밋)해야 하며 단순 타이핑이나 내용이 같은 저장은 새 기여를 만들지 않습니다. 반영에는 최대 24시간이 걸릴 수 있습니다.

https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference

## 설정 및 배포

`site.json`에서 제목과 소개를 수정할 수 있습니다. 저장소 Settings → Pages → Source를 GitHub Actions로 설정합니다. main에 커밋하면 `.github/workflows/pages.yml`이 사이트를 빌드하고 배포합니다. 실패하면 Actions에서 오류를 확인하세요.

```sh
npm ci
npm run build
npm run preview
```

미리보기: http://127.0.0.1:4173

게시물 HTML은 신뢰하는 저장소 작성자가 관리한다는 전제입니다. 외부인의 글을 검토 없이 병합하지 마세요.
