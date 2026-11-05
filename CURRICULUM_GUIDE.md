# 커리큘럼 운영 메모

2026-11-06 사용자 요청으로 스크롤 그래픽 시안을 종료하고 정적인 흰색 화면으로 정리했다.

- 메인: 네 분야의 아이콘 카드와 짧은 요약. 카드와 Curriculum 링크는 기존 `#curriculum`으로 연결한다.
- 커리큘럼: 학습 방식·현재 공정 스터디 → 네 분야의 상세 목록 → 활동 캘린더 → 활동 기록 버튼 하나.
- 상세 목록은 소재·물성 / 반도체 공정 / 반도체 소자 / 산업·기술 동향 순서다. 일반 문서 스크롤이며 고정 무대나 이미지 등장·퇴장 모션이 없다. 모바일에서는 제목 다음에 설명을 배치한다.
- `index.html`에서 문구와 카드 아이콘을, `home-refinement.css`와 `curriculum.css`에서 화면 배치를 수정한다.
- 폐기한 `study-scenes.*`, `study-layers.js`, `assets/study/`, 관련 생성 도구·검사·예전 검토 문서는 제거했다. 이전 시안은 Git 이력에서 찾을 수 있다. 첫 화면의 웨이퍼와 실제 사용하는 PDF 예시·뷰어 파일은 유지한다.

## 일정 관리

`curriculum-data.js`의 `window.HISEM_CURRICULUM_EVENTS`에 확정된 학회 일정만 등록한다. 현재 사용자가 지정한 **2026-11-06 Kickoff**가 있다.

필드는 `date`(YYYY-MM-DD), `title`, 선택 항목 `endDate`와 `description`이다. 학사일정과 공휴일은 별도 데이터로 관리한다. 월간 화면에 이름과 기간 막대를 표시하고, 선택하면 오른쪽/아래에서 전체 내용을 읽는다. 월 이동·오늘·키보드 탐색을 유지한다.

공식 학사일정 자동 갱신: `ACADEMIC_CALENDAR_GUIDE.md`. 자료 등록·PDF/PPT 미리보기: `ARCHIVE_GUIDE.md`.

## 확인 명령

```text
node --test tests/*.test.cjs
node scripts/check-archive.cjs
python -m unittest discover -s tests -p test_academic_calendar.py
```

미리보기: 이 폴더에서 `python -m http.server 5174 --bind 127.0.0.1`을 실행하고 `http://127.0.0.1:5174/#home` 또는 `#curriculum`으로 접속한다.

작업 브랜치는 `feature/archive-study-materials`이며 main 병합과 GitHub Pages 공개 배포는 별도 요청으로 진행한다.

2026-11-06 이번 변경 확인: Node 검사 15개·Python 학사 파서 검사 4개, 자료 원본 2개 검사 통과. PC 1440×900·1920×1080 및 모바일 390×844·320×740에서 카드/상세 목록 배치, 가로 넘침 없음, 일반 스크롤, 카드와 메뉴 이동, 새로고침·뒤로가기를 직접 확인했다. 캘린더의 Kickoff와 12월 학사일정, PDF 보고서 2쪽 및 PPTX 원본 링크·별도 PDF 미리보기를 확인했다. 실제 휴대폰·Safari는 확인하지 않았다.
