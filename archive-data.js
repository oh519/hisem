/* Replace the clearly labelled example with real study materials when ready. */
(function (root) {
  var topics = [{
    id: 'preview-example',
    title: '자료 미리보기 예시',
    example: true,
    files: [
      { kind: 'report', label: '학습 보고서 예시', path: 'materials/examples/HISEM-preview-example.pdf', filename: 'HISEM_미리보기_예시.pdf' },
      { kind: 'slides', label: '발표 자료 예시', path: 'materials/examples/HISEM-preview-example.pptx', filename: 'HISEM_미리보기_예시.pptx', previewPath: 'materials/examples/HISEM-preview-example.pdf' }
    ]
  }];
  if (typeof module === 'object' && module.exports) module.exports = topics;
  else root.HISEM_MATERIALS = topics;
})(typeof globalThis !== 'undefined' ? globalThis : this);
