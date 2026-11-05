const fs = require('node:fs');
const path = require('node:path');
const { normalizeMaterial } = require('../archive.js');

function validateArchive(data, directory) {
  const errors = [];
  let count = 0;
  const checkedPaths = new Set();
  if (!Array.isArray(data)) return { errors: ['자료 설정은 주제 목록이어야 합니다.'], count };
  const ids = new Set();
  function check(entry, kind, label) {
    const material = normalizeMaterial(entry, kind);
    if (!material) { errors.push(label + ': 파일 경로나 확장자가 올바르지 않습니다.'); return; }
    let current = directory, exact = true;
    for (const part of material.path.split('/')) {
      if (!fs.existsSync(current) || !fs.statSync(current).isDirectory() || !fs.readdirSync(current).includes(part)) { exact = false; break; }
      current = path.join(current, part);
    }
    if (!exact || !fs.statSync(current).isFile()) { errors.push(label + ': 파일을 찾을 수 없습니다. 대소문자도 확인하세요. ' + material.path); return; }
    const bytes = fs.readFileSync(current);
    const valid = material.format === 'PDF' ? bytes.subarray(0, 5).toString() === '%PDF-' : material.format === 'PPT' ? bytes.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex')) : bytes.subarray(0, 2).toString() === 'PK' && bytes.includes(Buffer.from('[Content_Types].xml')) && bytes.includes(Buffer.from('ppt/presentation.xml'));
    if (!valid) errors.push(label + ': 확장자에 맞는 기본 파일 형식이 아닙니다.');
    else { checkedPaths.add(material.path); count = checkedPaths.size; }
  }
  data.forEach((topic, index) => {
    if (!topic || typeof topic.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic.id) || ids.has(topic.id)) { errors.push('주제 ' + (index + 1) + ': 고유한 영문 소문자 ID를 지정하세요.'); return; }
    ids.add(topic.id);
    if (typeof topic.title !== 'string' || !topic.title.trim()) errors.push(topic.id + ': 주제 이름이 필요합니다.');
    if (!Array.isArray(topic.files)) { errors.push(topic.id + ': files 목록이 필요합니다.'); return; }
    topic.files.forEach((file, i) => {
      const label = topic.id + '/자료' + (i + 1);
      if (!file || !['report', 'slides'].includes(file.kind)) { errors.push(label + ': report 또는 slides를 지정하세요.'); return; }
      check(file, file.kind, label);
      if (file.previewPath != null) check({ path: file.previewPath }, 'preview', label + '/미리보기');
    });
  });
  return { errors, count };
}
module.exports = { validateArchive };
if (require.main === module) {
  const data = require('../archive-data.js');
  const result = validateArchive(data, path.resolve(__dirname, '..'));
  if (result.errors.length) { process.stderr.write(result.errors.join('\n') + '\n'); process.exitCode = 1; }
  else process.stdout.write('아카이브 검사 통과: 등록 파일 ' + result.count + '개' + (result.count ? '' : ' (아직 등록된 자료 없음)') + '\n');
}
