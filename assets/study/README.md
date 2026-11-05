# 학습 분야 테마 이미지

## 현재 화면에 사용하는 생성 이미지

내장 imagegen 도구에서 새로 제작했다. 학회의 실제 활동 사진이나 정확한 공정·소자 단면도가 아닌 주제별 개념 비주얼이다. 실제 알파 채널로 배경이 투명하다. 2026-11-05에 01·04를 교체했으며 승인된 02·03 파일은 그대로다.

| 웹 파일 | 주제 |
| --- | --- |
| materials-cutout.webp | 기존 마름모 결정 모형으로 복원, 1254×1254 |
| process-cutout.webp | 웨이퍼를 가공하는 공정 챔버 |
| devices-cutout.webp | 은색 덮개와 분리된 소자·패키지 층 구조 |
| industry-euv.webp | 실제 EUV 장비의 외형을 참고한 모듈형 장비, 1774×887 |

같은 이름의 PNG가 생성 원본이다. 기존 번들 sharp로 WebP quality 90 / alphaQuality 100으로 압축했으며 원본 파일의 크롭·리사이즈·마스킹은 하지 않았다. 디코딩 후 알파 바이트가 원본과 동일함을 확인했다. 현재 웹 표시 파일 네 개 합계는 973,244바이트다. 예전 materials-cubic·industry-cutout 파일도 보존하며 현재 화면에는 사용하지 않는다. materials-cubic 이미지는 축 방향 원자 표현이 불완전해 사용자가 반려했으며 정확한 페로브스카이트 도면으로 재사용하지 않는다.

현재 스크롤 효과의 레이어·SVG 마스크·가려진 면 보완은 `study-layers.js`에 있다. 이미지 파일 자체는 변형하지 않고 원자·웨이퍼·재료 층을 독립 요소로 표시한다. 완성 상태는 원본 전체 이미지로 돌아간다.

최신 01·04 제작 프롬프트: [GENERATED_PROMPTS_2026-11-05.md](GENERATED_PROMPTS_2026-11-05.md). 02·03은 [GENERATED_PROMPTS.md](GENERATED_PROMPTS.md). `IMAGE_PROMPTS.md`는 생성 전의 옛 기획 기록이다.

## 이전 참고 사진 — 보관용

사용자가 시안에 사용하도록 직접 제공했던 이미지다. 현재 화면에서는 아래 사진 대신 위의 생성 이미지를 사용한다. 학회 실제 활동 기록이나 과학적으로 정확한 소자 단면 자료로 소개하지 않는다.

| 웹 파일 | 제공된 파일 | 용도 |
| --- | --- | --- |
| materials.webp | codex-clipboard-d71e3238-76f5-4e11-8daf-aa19175ea783.png | 소재·물성 |
| process.webp | codex-clipboard-c2fd450e-e062-4c12-994f-522d39e93d4c.png | 공정 |
| process-detail.webp | codex-clipboard-e86d57d7-673a-47a8-8909-abec050acc81.png | 참고 보관 — 현재 화면에서는 사용하지 않음 |
| devices.webp | codex-clipboard-edf0f278-fd2e-4951-99d6-a9963d0294a5.png | 소자 |
| chip-detail.webp | codex-clipboard-4ec93c07-253a-46a1-9a72-fa6e4b86edea.png | 참고 보관 — 현재 화면에서는 사용하지 않음 |
| industry.webp | codex-clipboard-a27fd199-e38c-40c9-9fd1-3d3c6a52e4dc.png | 산업·기술 동향 |

픽셀 크기를 유지한 채 WebP quality 88로 압축했다. 브라우저에서는 장면 비율에 맞춰 일부 이미지의 가장자리를 자른다.
