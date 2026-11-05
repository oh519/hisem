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
  var scheduled = false, enabled = false, inline = false, stickyTop = 93, canvasHeight = 700;
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
    layout.style.setProperty('--journey-scene-height', Math.max(760, window.innerHeight - 28) + 'px');
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
    // An upper reading line keeps the first assembly visible after the canvas pins.
    var focus = stickyTop + canvasHeight * .3;
    var weights = [], progress = [], desired = [], total = 0, desiredTotal = 0, dominant = 0;
    entries.forEach(function (entry, index) {
      var rect = entry.scene.getBoundingClientRect();
      // Overlapping 1.5-scene windows keep adjacent graphics visible through handoff.
      var p = clamp((focus - rect.top + rect.height * .25) / (rect.height * 1.5));
      // Handoff only overlaps the next chapter's first .08 of progress.
      // Longer assembly ranges remain independent from this short graphic crossfade.
      var weight = ramp(0, .08, p) * (1 - ramp(2 / 3, 2 / 3 + .08, p));
      progress[index] = p;
      desired[index] = weight;
      weights[index] = entry.wholeReady ? weight : 0;
      total += weights[index];
      desiredTotal += weight;
      if (weight > desired[dominant]) dominant = index;
    });
    // One slow chapter cannot hide all the other loaded illustrations.
    // Hold the nearest ready illustration until its replacement can paint.
    if (desiredTotal > 0 && total === 0) {
      var closest = -1;
      entries.forEach(function (entry, index) {
        if (entry.wholeReady && (closest < 0 || Math.abs(index - dominant) < Math.abs(closest - dominant))) closest = index;
      });
      if (closest >= 0) { weights[closest] = desiredTotal; total = desiredTotal; }
    } else if (total > 0 && total < desiredTotal) {
      weights = weights.map(function (weight) { return weight * desiredTotal / total; });
      total = desiredTotal;
    }
    var normalization = Math.max(1, total);
    var endRect = layout.getBoundingClientRect();
    var leaving = ramp(0, canvasHeight * .7, endRect.bottom - stickyTop);
    var color = [0, 0, 0];
    entries.forEach(function (entry, index) {
      var p = progress[index], alpha = weights[index] / normalization * leaving;
      entry.figure.style.opacity = alpha.toFixed(4);
      entry.figure.style.visibility = alpha > .0001 ? 'visible' : 'hidden';
      entry.figure.dataset.progress = p.toFixed(5);
      // Reuse the exact entrance timeline backwards after the reading interval.
      // The final chapter uses its remaining visible runway so it can finish
      // fading before the bottom archive action, even in tall viewports.
      var exit = index === entries.length - 1
        ? clamp((1.15 - (endRect.bottom - stickyTop) / canvasHeight) / .55)
        : clamp((p - .56) / (2 / 3 + .08 - .56));
      var playback = exit > 0 ? Math.min(p, entry.completeAt * (1 - exit)) : p;
      entry.figure.dataset.motionProgress = playback.toFixed(5);
      entry.figure.dataset.motionPhase = exit > 0 ? 'exit' : p >= entry.completeAt ? 'hold' : 'enter';
      var complete = playback >= entry.completeAt || !entry.layers.length || !entry.layersReady;
      entry.whole.style.visibility = complete ? 'visible' : 'hidden';
      entry.layers.forEach(function (layer) {
        layer.image.style.visibility = complete ? 'hidden' : 'visible';
        // Keep even hidden endpoints deterministic, without rewriting unchanged states.
        renderLayer(layer, playback);
      });
      entry.rgb.forEach(function (component, channel) { color[channel] += component * weights[index]; });
    });
    if (total > .0001) {
      section.style.setProperty('--journey-tint', 'rgb(' + color.map(function (value) { return Math.round(value / total); }).join(',') + ')');
    } else {
      section.style.setProperty('--journey-tint', scenes[progress[0] === 0 ? 0 : scenes.length - 1].dataset.tint);
    }
    if (total <= .0001) dominant = progress[0] === 0 ? 0 : entries.length - 1;
    else dominant = weights.indexOf(Math.max.apply(Math, weights));
    visuals.dataset.activeChapter = entries[dominant].key;
  }
  function schedule() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
  }
  function reconcile() {
    var visible = viewVisible();
    var next = desktop.matches && !reduced.matches && visible && entries.some(function (entry) { return entry.wholeReady; });
    enabled = next;
    inline = !desktop.matches && !reduced.matches && visible;
    section.classList.toggle('journey-scrubbed', next);
    section.classList.toggle('journey-inline-motion', inline);
    section.dataset.motionMode = !visible ? 'hidden' : reduced.matches ? 'reduced' : next ? 'desktop' : inline ? 'inline' : 'loading';
    section.dataset.readyScenes = String(entries.filter(function (entry) { return entry.wholeReady; }).length);
    if (!inline) entries.forEach(function (entry) {
      entry.source.style.removeProperty('opacity');
      entry.source.style.removeProperty('transform');
    });
    if (next) { metrics(); schedule(); }
    else {
      section.style.removeProperty('--journey-tint');
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
