# Metric Bloom

소셜 플랫폼을 직접 키우고 운영하는 한국어 2D 픽셀 아트 방치형 게임입니다. 처음엔 방에서 글을 올리고, 팔로워·루틴·크루를 모은 뒤 독립 네트워크 블룸과 도시의 대개화를 이끕니다. 마지막까지 피드에 어떤 목소리를 담을지 선택하세요.

## 바로 실행하기

Windows에서는 `run.bat`을 더블 클릭하세요. Node.js와 npm이 필요합니다. 처음 실행하고 의존성을 설치한 후 브라우저에서 게임을 엽니다.

터미널에서는 다음 명령을 사용합니다.

```powershell
npm ci
npm run dev
```

브라우저에서 첫 글을 올리고, 탭에서 루틴과 업그레이드를 운영합니다. 대화 사건은 게임 속 메시지에서 열 수 있으며, 선택은 저장되고 엔딩에 반영됩니다. 기존 저장 데이터는 유지됩니다.

## 개발 확인

```powershell
npm test
npm run build
npm run sim -- --summary
```

## GitHub Pages

현재 공개 사이트는 [GitHub Pages](https://legerdo.github.io/metric-bloom-opus-5-5/)에서 플레이할 수 있습니다. 배포 방식은 `main` 브랜치의 `docs/` 폴더를 Pages 원본으로 사용합니다.

## GPT-6 Pro 비교판

별도 프로젝트 [Metric Bloom GPT-6 Pro](comparison/gpt6-pro/)를 같은 저장소에 보존하고, 비교 페이지에서 두 버전을 선택해 플레이할 수 있습니다.

- [두 버전 비교 페이지](https://legerdo.github.io/metric-bloom-opus-5-5/comparison/)
- [GPT-6 Pro 버전 바로 플레이](https://legerdo.github.io/metric-bloom-opus-5-5/comparison/gpt6-pro/)
- [GPT-6 Pro 버전 소스와 실행 안내](comparison/gpt6-pro/README.md)

Pages용 파일을 다시 만들 때는 프로젝트 폴더에서 다음 명령을 실행합니다.

```powershell
npm ci
npm run build:pages
```

성공하면 두 게임의 변경된 페이지 파일을 커밋해 `main`에 올립니다. `docs/` 폴더는 생성된 사이트 파일이므로 `npm run build:pages`가 두 게임을 모두 빌드해 다시 만듭니다. Pages 원본 변경은 GitHub의 저장소 설정에서 관리합니다.

## 변경 기록과 원본 프롬프트

- [이번 게임 및 UI 개선 기록](release-notes/CHANGELOG_KO.md)
- [보존한 기존 원샷 프롬프트](Metric_Bloom_Opus_5_5_OneShot_Prompt.md)

원샷 프롬프트는 수정하지 않고 원본 파일을 그대로 포함했습니다.
