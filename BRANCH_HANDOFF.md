# HISEM 작업 브랜치 안내

브랜치: `feature/archive-study-materials`

2026-11-05 사용자의 요청으로 현재 로컬 작업을 별도 브랜치에 업로드한다. 다른 작업자 변경의 병합, main 반영, 공개 배포는 포함하지 않는다.

- 기준 커밋: `ea46f1ac978d6bb07e28181c4c7d5a2bd95f056d`. 업로드 직전 확인한 원격 main은 `4d304b28471820f9525aae42ee9198bce230472e`이며 해당 변경을 합치지 않았다.
- 포함: PDF·발표자료 아카이브와 예시 파일, 메인 디테일, 커리큘럼 요약·캘린더·스크롤 그림·등장/퇴장 모션, 이미지 원본·이전 시안·운영 문서·검사 코드.
- 기존 다른 작업 폴더의 메인 개편·Introduction 작업은 이 브랜치에 자동으로 합치지 않았다.
- 검증: `node --test tests/archive.test.cjs tests/curriculum-calendar.test.cjs tests/study-scenes.test.cjs tests/study-illustrations.test.cjs` 24개 통과. `node scripts/check-archive.cjs` 통과.
- 미리보기: 이 폴더에서 `python -m http.server 5174 --bind 127.0.0.1` 실행 후 `http://127.0.0.1:5174/#curriculum` 접속.
- 최신 모션 작업 기록: `MOTION_EXIT_WORKLOG.md`. 자료 등록: `ARCHIVE_GUIDE.md`. 확정 일정은 `curriculum-data.js`에서 관리하며 현재 실제 등록 일정은 없다.

이 브랜치를 main에 합칠지는 추후 별도 검토한다.
