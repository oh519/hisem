const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const archive = require('../archive.js');
const { validateArchive } = require('../scripts/check-archive.cjs');

test('only subjects with registered files are published, grouped into one entry', () => {
  assert.deepEqual(archive.getPublishedTopics([]), []);
  const example = archive.getPublishedTopics(require('../archive-data.js'));
  assert.equal(example.length, 1);
  assert.equal(example[0].example, true);
  assert.deepEqual(example[0].files.map(file => file.format), ['PDF', 'PPTX']);
  const topics = archive.getPublishedTopics([
    { id: 'empty', title: '빈 주제', files: [] },
    { id: 'photo-etch', title: '포토·식각', files: [
      { kind: 'report', path: 'materials/report.pdf' },
      { kind: 'slides', path: 'materials/slides.pptx', previewPath: 'materials/slides-preview.pdf' }
    ] },
    { id: 'photo-etch', title: '중복', files: [{ kind: 'report', path: 'materials/other.pdf' }] }
  ]);
  assert.equal(topics.length, 1);
  assert.equal(topics[0].files.length, 2);
  assert.equal(topics[0].files[0].preview.path, 'materials/report.pdf');
  assert.equal(topics[0].files[1].preview.path, 'materials/slides-preview.pdf');
});

test('presentation originals and PDF previews stay independent', () => {
  for (const extension of ['ppt', 'pptx', 'pdf']) {
    const file = archive.getPublishedTopics([{ id: 'thin-film', title: '박막', files: [{ kind: 'slides', path: 'materials/slides.' + extension }] }])[0].files[0];
    assert.equal(file.format, extension.toUpperCase());
    assert.equal(Boolean(file.preview), extension === 'pdf');
  }
  assert.equal(archive.normalizeMaterial({ path: 'materials/file.pptx' }, 'report'), null);
});

test('reject unsafe file paths and unsupported material types', () => {
  for (const path of ['https://example.com/a.pdf', 'javascript:alert(1)', 'materials/../a.pdf', 'materials/%2e%2e/a.pdf', 'materials/%252e%252e/a.pdf', 'materials/a.pdf#x', 'materials/a.pdf?x', 'materials/a\\b.pdf']) assert.equal(archive.normalizeMaterial({ path }, 'report'), null, path);
  assert.equal(archive.normalizeMaterial({ path: 'materials/report.pdf', filename: 'report.pptx' }, 'report'), null);
  assert.equal(archive.getPublishedTopics([{ id: 'x', title: 'x', files: [{ kind: 'preview', path: 'materials/x.pdf' }] }]).length, 0);
});

test('validate originals, preview existence, case and file signatures', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'hisem-archive-'));
  try {
    fs.mkdirSync(path.join(temporary, 'materials'));
    const configured = [{ id: 'diffusion', title: '확산', files: [{ kind: 'report', path: 'materials/Report.pdf' }] }];
    assert.equal(validateArchive(configured, temporary).errors.length, 1);
    fs.writeFileSync(path.join(temporary, 'materials', 'Report.pdf'), '%PDF-1.4\nfixture header');
    assert.equal(validateArchive(configured, temporary).count, 1);
    configured[0].files[0].previewPath = 'materials/missing.pdf';
    assert.equal(validateArchive(configured, temporary).errors.length, 1);
    delete configured[0].files[0].previewPath;
    configured[0].files[0].path = 'materials/report.pdf';
    assert.equal(validateArchive(configured, temporary).errors.length, 1);
    configured[0].files[0].path = 'materials/Report.pdf';
    fs.writeFileSync(path.join(temporary, 'materials', 'Report.pdf'), 'Not a PDF');
    assert.equal(validateArchive(configured, temporary).errors.length, 1);
    assert.equal(validateArchive([configured[0], configured[0]], temporary).errors.length, 2);
  } finally {
    const cleanupPath = path.resolve(temporary);
    assert.equal(path.dirname(cleanupPath), path.resolve(os.tmpdir()));
    assert.ok(path.basename(cleanupPath).startsWith('hisem-archive-'));
    fs.rmSync(cleanupPath, { recursive: true, force: true });
  }
});
