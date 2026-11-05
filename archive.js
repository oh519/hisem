(function (root, factory) {
  'use strict';
  var archive = factory();
  if (typeof module === 'object' && module.exports) module.exports = archive;
  else {
    root.HISEMArchive = archive;
    function boot() { archive.mount(document, root.HISEM_MATERIALS || []); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function normalizeMaterial(entry, kind) {
    if (!entry || typeof entry.path !== 'string') return null;
    var path;
    try { path = decodeURIComponent(entry.path); } catch (_) { return null; }
    if (!path.startsWith('materials/') || /[\\?#%\x00-\x1f]/.test(path)) return null;
    if (path.split('/').some(function (part) { return !part || part === '.' || part === '..'; })) return null;
    var extension = path.split('.').pop().toLowerCase();
    if (kind === 'report' || kind === 'preview' ? extension !== 'pdf' : kind !== 'slides' || !['ppt', 'pptx', 'pdf'].includes(extension)) return null;
    var filename = entry.filename || path.split('/').pop();
    if (typeof filename !== 'string' || /[\\/\x00-\x1f]/.test(filename) || filename.split('.').pop().toLowerCase() !== extension) return null;
    return { path: path, filename: filename, format: extension.toUpperCase(), kind: kind };
  }

  function getPublishedTopics(data) {
    if (!Array.isArray(data)) return [];
    var seen = new Set();
    return data.reduce(function (topics, topic) {
      if (!topic || typeof topic.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic.id) || seen.has(topic.id) || typeof topic.title !== 'string' || !topic.title.trim()) return topics;
      var files = (Array.isArray(topic.files) ? topic.files : []).map(function (entry) {
        if (!entry || !['report', 'slides'].includes(entry.kind)) return null;
        var file = normalizeMaterial(entry, entry && entry.kind);
        if (!file) return null;
        file.label = typeof entry.label === 'string' && entry.label.trim() ? entry.label : (file.kind === 'report' ? '학습 보고서' : '발표 자료');
        file.preview = file.format === 'PDF' ? file : normalizeMaterial({ path: entry.previewPath }, 'preview');
        return file;
      }).filter(Boolean);
      if (files.length) { seen.add(topic.id); topics.push({ id: topic.id, title: topic.title.trim(), example: topic.example === true, files: files }); }
      return topics;
    }, []);
  }

  function mount(doc, data) {
    var root = doc.getElementById('material-archive');
    if (!root) return;
    var topics = getPublishedTopics(data);
    var listView = doc.getElementById('archive-list-view');
    var detailView = doc.getElementById('archive-detail-view');
    var list = doc.getElementById('archive-topics');
    var win = doc.defaultView;
    var stopPreview = function () {};
    function el(tag, className, text) {
      var node = doc.createElement(tag);
      if (className) node.className = className;
      if (text) node.textContent = text;
      return node;
    }
    function link(text, href, className) {
      var node = el('a', className, text); node.href = href; return node;
    }
    list.replaceChildren();
    topics.forEach(function (topic) {
      var card = link('', '#publication/' + topic.id, 'archive-topic');
      if (topic.example) card.appendChild(el('span', 'archive-example-label', '미리보기용 예시'));
      card.appendChild(el('h3', '', topic.title));
      card.appendChild(el('p', '', Array.from(new Set(topic.files.map(function (file) { return file.kind === 'report' ? '학습 보고서' : '발표 자료'; }))).join(' · ')));
      var arrow = el('span', 'archive-topic-arrow', '↗'); arrow.setAttribute('aria-hidden', 'true'); card.appendChild(arrow);
      list.appendChild(card);
    });
    doc.getElementById('archive-empty').hidden = topics.length > 0;

    function showTopic(topic) {
      detailView.appendChild(link('← 자료 목록', '#publication', 'archive-back'));
      detailView.appendChild(el('h2', 'archive-detail-title', topic.title));
      if (topic.example) detailView.appendChild(el('p', 'archive-example-note', '실제 활동 결과물이 아닌 미리보기용 예시입니다.'));
      var controls = el('div', 'material-controls');
      controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', '자료 선택');
      var panel = el('section', 'material-viewer');
      var heading = el('h3', 'viewer-title'); heading.id = 'viewer-title';
      panel.setAttribute('aria-labelledby', heading.id);
      var actions = el('div', 'viewer-actions');
      var display = el('div', 'preview-display');
      panel.append(heading, actions, display);
      var buttons = [];
      function select(index) {
        stopPreview();
        buttons.forEach(function (button, i) { button.setAttribute('aria-pressed', String(i === index)); });
        var file = topic.files[index];
        heading.textContent = file.label;
        actions.replaceChildren(); display.replaceChildren();
        var download = link(file.format + ' 다운로드 ↓', encodeURI(file.path), 'material-link');
        download.download = file.filename;
        download.setAttribute('aria-label', topic.title + ' ' + file.label + ' ' + file.format + ' 다운로드');
        actions.appendChild(download);
        if (file.preview) {
          var open = link('PDF 새 탭에서 보기 ↗', encodeURI(file.preview.path), 'material-link material-secondary');
          open.target = '_blank'; open.rel = 'noopener noreferrer'; actions.appendChild(open);
          var preview = el('div', 'material-preview');
          preview.setAttribute('aria-label', topic.title + ' ' + file.label + ' PDF 미리보기');
          display.appendChild(preview);
          if (win.HISEMPDFPreview) stopPreview = win.HISEMPDFPreview(preview, encodeURI(file.preview.path));
          else preview.appendChild(el('p', 'preview-unavailable', 'PDF 새 탭에서 보기를 눌러 자료를 열어주세요.'));
          display.appendChild(el('p', 'preview-help', '미리보기가 보이지 않으면 PDF를 새 탭에서 열어주세요.'));
        } else {
          display.appendChild(el('p', 'preview-unavailable', '발표 자료 미리보기 준비 중'));
        }
      }
      topic.files.forEach(function (file, i) {
        var button = el('button', 'material-choice', file.label);
        button.type = 'button'; button.setAttribute('aria-pressed', String(i === 0));
        button.addEventListener('click', function () { select(i); });
        buttons.push(button); controls.appendChild(button);
      });
      detailView.append(controls, panel);
      select(0);
      doc.title = topic.title + ' · 보고서·발표자료 · HISEM';
    }
    function render() {
      var hash = win.location.hash.slice(1);
      stopPreview(); stopPreview = function () {};
      if (hash !== 'publication' && !hash.startsWith('publication/')) { detailView.replaceChildren(); return; }
      var id = hash.slice('publication/'.length);
      var topic = hash.startsWith('publication/') ? topics.find(function (entry) { return entry.id === id; }) : null;
      var detail = hash.startsWith('publication/');
      listView.hidden = detail; detailView.hidden = !detail;
      detailView.replaceChildren();
      if (topic) showTopic(topic);
      else if (detail) {
        detailView.append(el('h2', 'archive-detail-title', '자료를 찾을 수 없습니다.'), link('자료 목록으로', '#publication', 'archive-back'));
      }
    }
    win.addEventListener('hashchange', render);
    render();
  }
  return { normalizeMaterial: normalizeMaterial, getPublishedTopics: getPublishedTopics, mount: mount };
});
