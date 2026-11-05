(function () {
  'use strict';
  var section = document.getElementById('curriculum-study');
  if (!section) return;
  var layout = section.querySelector('.journey-layout');
  var visuals = section.querySelector('.journey-visuals');
  var scenes = Array.from(section.querySelectorAll('[data-study-scene]'));
  if (!layout || !visuals || !scenes.length || !window.matchMedia) return;

  var desktop = window.matchMedia('(min-width: 901px)');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var definitions = window.HISEM_STUDY_LAYERS || {};
  var scheduled = false, enabled = false, inline = false, stickyTop = 93, canvasHeight = 700, cycleScroll = 1125;
  var clamp = function (value) { return Math.max(0, Math.min(1, value)); };
  function ramp(start, end, value) {
    if (end <= start) return value >= end ? 1 : 0;
    var p = clamp((value - start) / (end - start));
    return p * p * (3 - 2 * p);
  }
  function imageReady(image) {
    return new Promise(function (resolve) {
      function decode() {
        // A loaded image can paint without awaiting an optional decode() promise.
        // Some SVG decoders never settle while their containing view is hidden.
        resolve(image.naturalWidth > 0);
      }
      if (image.complete) decode();
      else {
        image.addEventListener('load', decode, { once: true });
        image.addEventListener('error', function () { resolve(false); }, { once: true });
      }
    });
  }
  function createImage(src, className) {
    var image = document.createElement('img');
    image.className = className;
    image.alt = '';
    image.loading = 'eager';
    image.decoding = 'async';
    image.draggable = false;
    image.src = src;
    return image;
  }
  visuals.setAttribute('aria-hidden', 'true');
  var entries = scenes.map(function (scene) {
    var source = scene.querySelector('.scene-primary');
    var key = scene.dataset.studyScene;
    var definition = definitions[key] || {};
    var figure = document.createElement('figure');
    figure.className = 'journey-graphic';
    figure.dataset.chapter = key;
    var plane = document.createElement('div');
    plane.className = 'journey-plane';
    var whole = createImage(definition.baseSrc || source.getAttribute('src'), 'journey-whole');
    plane.appendChild(whole);
    var layers = (definition.layers || []).map(function (spec) {
      var image = createImage(spec.src || whole.getAttribute('src'), 'journey-layer');
      image.dataset.layer = spec.id || '';
      image.style.zIndex = String(spec.z || 0);
      if (spec.mask) {
        var mask = spec.mask.indexOf('data:') === 0 ? 'url("' + spec.mask + '")' : spec.mask;
        image.style.maskImage = mask;
        image.style.webkitMaskImage = mask;
      }
      if (spec.clip) image.style.clipPath = spec.clip;
      plane.appendChild(image);
      return { image: image, spec: spec };
    });
    figure.appendChild(plane);
    visuals.appendChild(figure);
    return {
      scene: scene, source: source, media: scene.querySelector('.scene-media'), key: key,
      figure: figure, plane: plane, whole: whole, layers: layers, wholeReady: false, layersReady: false,
      width: definition.width || Number(source.getAttribute('width')) || 1,
      height: definition.height || Number(source.getAttribute('height')) || 1,
      completeAt: definition.completeAt == null ? .5 : definition.completeAt,
      rgb: (scene.dataset.tint.match(/[a-f\d]{2}/gi) || ['f0', 'f4', 'f8']).map(function (part) { return parseInt(part, 16); })
    };
  });

  function viewVisible() { return !section.closest('[hidden]'); }
  function metrics() {
    var header = document.querySelector('.site-header');
    stickyTop = Math.max(88, Math.ceil(header ? header.getBoundingClientRect().height : 68) + 24);
    canvasHeight = Math.max(180, Math.min(850, window.innerHeight - stickyTop - 28));
    layout.style.setProperty('--journey-stage-top', stickyTop + 'px');
    layout.style.setProperty('--journey-canvas-height', canvasHeight + 'px');
    // Give a wheel notch only a small part of a chapter. The stage stays pinned,
    // so this adds reading time rather than an empty gap between illustrations.
    cycleScroll = Math.max(960, Math.min(1440, window.innerHeight * 1.25));
    layout.style.setProperty('--journey-cycle-scroll', cycleScroll + 'px');
    layout.style.setProperty('--journey-runway-height', (canvasHeight + entries.length * cycleScroll) + 'px');
    var width = visuals.clientWidth;
    entries.forEach(function (entry) {
      // Fit the native canvas once. Masks and every layer share these exact coordinates.
      var inset = Math.min(24, width * .035);
      var scale = Math.min((width - inset * 2) / entry.width, (canvasHeight - inset * 2) / entry.height);
      entry.plane.style.width = Math.max(1, entry.width * scale) + 'px';
      entry.plane.style.height = Math.max(1, entry.height * scale) + 'px';
    });
  }
  function renderLayer(layer, progress) {
    if (layer.progress === progress) return;
    layer.progress = progress;
    var spec = layer.spec;
    var amount = ramp(spec.start == null ? 0 : spec.start, spec.end == null ? .35 : spec.end, progress);
    var remaining = 1 - amount;
    var x = (spec.fromX || 0) * remaining;
    var y = (spec.fromY || 0) * remaining;
    var scale = 1 + ((spec.fromScale == null ? 1 : spec.fromScale) - 1) * remaining;
    layer.image.style.transform = 'translate(' + x.toFixed(3) + '%,' + y.toFixed(3) + '%) scale(' + scale.toFixed(4) + ')';
    layer.image.style.opacity = ramp(spec.opacityStart == null ? 0 : spec.opacityStart, spec.opacityEnd == null ? .1 : spec.opacityEnd, progress).toFixed(4);
  }
  function update() {
    scheduled = false;
    if (!viewVisible()) return;
    if (inline) {
      entries.forEach(function (entry) {
        var rect = entry.media.getBoundingClientRect();
        var arrive = ramp(0, 1, (window.innerHeight - rect.top) / (window.innerHeight * .65));
        var leave = ramp(0, 1, (rect.bottom - stickyTop) / (window.innerHeight * .35));
        var p = Math.min(arrive, leave);
        entry.source.style.opacity = (entry.key === 'industry' ? p : .4 + .6 * p).toFixed(4);
        entry.source.style.transform = 'translateY(' + (entry.key === 'industry' ? '0.000' : (32 * (1 - p)).toFixed(3)) + 'px)';
      });
      return;
    }
    if (!enabled) return;
    // Native scrolling advances a measured timeline inside ONE pinned viewport.
    // No wheel/touch interception: release occurs only after every exit is done.
    var overall = Math.max(0, (stickyTop - layout.getBoundingClientRect().top) / cycleScroll);
    var active = Math.min(entries.length - 1, Math.floor(overall));
    var local = overall >= entries.length ? 1 : overall - active;
    entries.forEach(function (entry, index) {
      var p = index === active ? local : index < active ? 1 : 0;
      var phase = p < .30 ? 'enter' : p < .68 ? 'hold' : p < .97 ? 'exit' : 'clear';
      var playback = phase === 'enter' ? entry.completeAt * clamp(p / .30)
        : phase === 'hold' ? entry.completeAt
        : phase === 'exit' ? entry.completeAt * clamp(1 - (p - .68) / .29) : 0;
      var on = index === active && phase !== 'clear';
      var textAlpha = on ? (index === 0 ? 1 : ramp(0, .12, p)) * (1 - ramp(.82, .97, p)) : 0;
      entry.scene.style.opacity = textAlpha.toFixed(4);
      entry.scene.style.visibility = textAlpha > .0001 ? 'visible' : 'hidden';
      entry.scene.setAttribute('aria-hidden', String(!on || textAlpha < .0001));
      entry.figure.style.opacity = on && entry.wholeReady ? '1' : '0';
      entry.figure.style.visibility = on && entry.wholeReady ? 'visible' : 'hidden';
      entry.figure.dataset.progress = p.toFixed(5);
      entry.figure.dataset.motionProgress = playback.toFixed(5);
      entry.figure.dataset.motionPhase = phase;
      var complete = playback >= entry.completeAt || !entry.layers.length || !entry.layersReady;
      entry.whole.style.visibility = complete ? 'visible' : 'hidden';
      // If optional layers fail, the whole illustration still fades out fully.
      entry.whole.style.opacity = !entry.layersReady ? (on ? ramp(0, .30, p) * (1 - ramp(.68, .97, p)) : 0).toFixed(4) : '1';
      entry.layers.forEach(function (layer) {
        layer.image.style.visibility = complete ? 'hidden' : 'visible';
        renderLayer(layer, playback);
      });
    });
    section.style.setProperty('--journey-tint', scenes[active].dataset.tint);
    visuals.dataset.activeChapter = entries[active].key;
  }
  function schedule() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
  }
  function reconcile() {
    var visible = viewVisible();
    var next = desktop.matches && window.innerHeight >= 520 && !reduced.matches && visible && entries.some(function (entry) { return entry.wholeReady; });
    enabled = next;
    inline = !desktop.matches && !reduced.matches && visible;
    section.classList.toggle('journey-scrubbed', next);
    section.classList.toggle('journey-inline-motion', inline);
    section.dataset.motionMode = !visible ? 'hidden' : reduced.matches ? 'reduced' : next ? 'desktop' : inline ? 'inline' : entries.some(function (entry) { return entry.wholeReady; }) ? 'static' : 'loading';
    section.dataset.readyScenes = String(entries.filter(function (entry) { return entry.wholeReady; }).length);
    if (!inline) entries.forEach(function (entry) {
      entry.source.style.removeProperty('opacity');
      entry.source.style.removeProperty('transform');
    });
    if (next) { metrics(); schedule(); }
    else {
      section.style.removeProperty('--journey-tint');
      entries.forEach(function (entry) {
        entry.scene.style.removeProperty('opacity');
        entry.scene.style.removeProperty('visibility');
        entry.scene.removeAttribute('aria-hidden');
      });
      if (inline) schedule();
    }
  }
  function afterRoute() {
    // The existing router can reset scroll later in the same hashchange dispatch.
    requestAnimationFrame(function () { requestAnimationFrame(reconcile); });
  }
  desktop.addEventListener('change', reconcile);
  reduced.addEventListener('change', reconcile);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', reconcile, { passive: true });
  window.addEventListener('hashchange', afterRoute);
  window.addEventListener('pageshow', afterRoute);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) afterRoute(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(reconcile);
  entries.forEach(function (entry) {
    imageReady(entry.whole).then(function (ok) {
      entry.wholeReady = ok;
      reconcile();
    });
    Promise.all(entry.layers.map(function (layer) { return imageReady(layer.image); })).then(function (ready) {
      entry.layersReady = ready.every(Boolean);
      schedule();
    });
  });
  reconcile();
})();
