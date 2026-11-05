/* PDF.js is loaded only when a real PDF preview is opened. */
(function () {
  'use strict';
  var library;
  var base = new URL('vendor/pdfjs/', document.baseURI).href;
  function loadLibrary() {
    if (!library) library = import(base + 'legacy/build/pdf.min.mjs').then(function (pdfjs) {
      pdfjs.GlobalWorkerOptions.workerSrc = base + 'legacy/build/pdf.worker.min.mjs';
      return pdfjs;
    }).catch(function (error) { library = null; throw error; });
    return library;
  }
  window.HISEMPDFPreview = function (host, url) {
    var doc = host.ownerDocument;
    var destroyed = false, loading, pdf, renderTask, rendering = false, pending = false;
    var pageNumber = 1, lastWidth = 0;
    function el(tag, cls, text) {
      var node = doc.createElement(tag); node.className = cls;
      if (text) node.textContent = text;
      return node;
    }
    var controls = el('div', 'pdf-controls');
    var previous = el('button', 'pdf-page-button', '← 이전');
    var next = el('button', 'pdf-page-button', '다음 →');
    previous.type = next.type = 'button'; previous.disabled = next.disabled = true;
    previous.setAttribute('aria-label', '이전 PDF 페이지'); next.setAttribute('aria-label', '다음 PDF 페이지');
    var counter = el('span', 'pdf-counter', 'PDF 불러오는 중'); counter.setAttribute('aria-live', 'polite');
    controls.append(previous, counter, next);
    var stage = el('div', 'pdf-stage');
    var canvas = el('canvas', 'pdf-page'); canvas.setAttribute('aria-hidden', 'true'); canvas.hidden = true;
    var text = el('div', 'pdf-readable-text'); text.setAttribute('aria-label', '현재 PDF 페이지 내용');
    var status = el('p', 'pdf-status', 'PDF를 불러오는 중입니다.'); status.setAttribute('role', 'status');
    stage.append(canvas, status); host.append(controls, stage, text);
    function fail() {
      if (destroyed) return;
      canvas.hidden = true;
      status.hidden = false; status.textContent = '미리보기를 불러오지 못했습니다. PDF를 새 탭에서 열어주세요.';
      counter.textContent = '미리보기 사용 불가'; previous.disabled = next.disabled = true;
    }
    async function render() {
      if (destroyed || !pdf) return;
      if (rendering) { pending = true; if (renderTask) renderTask.cancel(); return; }
      rendering = true;
      var currentPage = pageNumber;
      try {
        var page = await pdf.getPage(currentPage);
        if (destroyed) return;
        var width = Math.max(100, stage.clientWidth);
        lastWidth = width;
        var natural = page.getViewport({ scale: 1 });
        var viewport = page.getViewport({ scale: Math.min(width, 1200) / natural.width });
        var ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * ratio); canvas.height = Math.floor(viewport.height * ratio);
        renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport, transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0] });
        await renderTask.promise;
        if (destroyed || pending) return;
        canvas.hidden = false; status.hidden = true;
        counter.textContent = currentPage + ' / ' + pdf.numPages;
        previous.disabled = currentPage <= 1; next.disabled = currentPage >= pdf.numPages;
        var contents = await page.getTextContent();
        if (!destroyed && currentPage === pageNumber) text.textContent = contents.items.map(function (item) { return item.str; }).join(' ');
      } catch (error) {
        if (error.name !== 'RenderingCancelledException') fail();
      } finally {
        rendering = false; renderTask = null;
        if (pending && !destroyed) { pending = false; render(); }
      }
    }
    previous.addEventListener('click', function () { if (pdf && pageNumber > 1) { pageNumber--; render(); } });
    next.addEventListener('click', function () { if (pdf && pageNumber < pdf.numPages) { pageNumber++; render(); } });
    var observer = 'ResizeObserver' in window ? new ResizeObserver(function () {
      if (pdf && Math.abs(stage.clientWidth - lastWidth) > 1) render();
    }) : null;
    if (observer) observer.observe(stage);
    loadLibrary().then(async function (pdfjs) {
      if (destroyed) return;
      loading = pdfjs.getDocument({ url: url, cMapUrl: base + 'cmaps/', cMapPacked: true, standardFontDataUrl: base + 'standard_fonts/', wasmUrl: base + 'wasm/' });
      pdf = await loading.promise;
      if (!destroyed) render();
    }).catch(fail);
    return function () {
      destroyed = true;
      if (observer) observer.disconnect();
      if (renderTask) renderTask.cancel();
      if (loading) { var cleanup = loading.destroy(); if (cleanup && cleanup.catch) cleanup.catch(function () {}); }
    };
  };
})();
