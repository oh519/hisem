const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise production with controllable layout/scroll. One shared pinned stage
// holds both the original accessible text and its illustration.
async function renderer(options = {}) {
  let scroll = 0, visible = true;
  const frames = [], listeners = new Map();
  function listen(type, fn) { const list = listeners.get(type) || []; list.push(fn); listeners.set(type, list); }
  class Node {
    constructor() {
      this.children = []; this.dataset = {}; this.attrs = {};
      this.naturalWidth = 1254; this.clientWidth = 640; this.scrollHeight = 310;
      this.style = { setProperty(key, value) { this[key] = value; }, removeProperty(key) { delete this[key]; }, getPropertyValue(key) { return this[key] || ''; } };
      const classes = new Set();
      this.classList = { toggle(key, on) { if (on) classes.add(key); else classes.delete(key); }, contains(key) { return classes.has(key); } };
    }
    appendChild(node) { this.children.push(node); return node; }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    removeAttribute(key) { delete this.attrs[key]; }
    getAttribute(key) { return key === 'src' ? this.src : this.attrs[key]; }
    addEventListener() {}
    get complete() {
      return !(options.pendingLayers && this.className === 'journey-layer') &&
        !(options.pendingWhole && this.className === 'journey-whole' && this.src.includes(options.pendingWhole));
    }
    decode() { return options.pendingDecode ? new Promise(() => {}) : Promise.resolve(); }
    closest() { return null; }
  }
  const section = new Node(), layout = new Node(), stage = new Node(), reading = new Node(), sceneList = new Node(), visuals = new Node();
  section.closest = () => visible ? null : {};
  const sources = [], copies = [];
  const scenes = ['materials','process','devices','industry'].map((key, index) => {
    const scene = new Node(), image = new Node(), media = new Node(), copy = new Node();
    sources.push(image); copies.push(copy);
    scene.dataset = { studyScene: key, tint: ['#f0f4f8','#f4f2fa','#eef6f3','#edf4fa'][index] };
    image.src = 'assets/study/' + key + '-cutout.webp';
    image.attrs = { width: '1254', height: '1254' };
    scene.querySelector = selector => ({ '.scene-media': media, '.scene-primary': image, '.study-copy': copy }[selector]);
    scene.getBoundingClientRect = () => section.classList.contains('journey-scrubbed') ? stage.getBoundingClientRect() : { top: 800 + index * 872 - scroll, height: 872 };
    media.getBoundingClientRect = () => ({ top: 1200 + index * 872 - scroll, bottom: 1600 + index * 872 - scroll, height: 400 });
    copy.getBoundingClientRect = () => ({ top: stage.getBoundingClientRect().top + 50, height: copy.scrollHeight });
    return scene;
  });
  const number = key => parseFloat(layout.style[key]);
  layout.getBoundingClientRect = () => ({ top: 800 - scroll, bottom: 800 + (number('--journey-runway-height') || 3488) - scroll, height: number('--journey-runway-height') || 3488 });
  stage.getBoundingClientRect = () => {
    const rect = layout.getBoundingClientRect(), height = number('--journey-canvas-height') || 700;
    const top = section.classList.contains('journey-scrubbed') ? Math.min(Math.max(rect.top, number('--journey-stage-top')), rect.bottom - height) : rect.top;
    return { top, bottom: top + height, height, width: 1280 };
  };
  section.querySelector = selector => ({ '.journey-layout': layout, '.journey-stage': stage, '.journey-reading': reading, '.journey-scenes': sceneList, '.journey-visuals': visuals }[selector]);
  section.querySelectorAll = () => scenes;
  sceneList.children = scenes; reading.children = [sceneList]; stage.children = [reading, visuals]; layout.children = [stage];
  const document = {
    getElementById: () => section,
    querySelector: () => ({ getBoundingClientRect: () => ({ height: 68 }) }),
    createElement: () => new Node(), addEventListener: listen
  };
  const mediaQueries = [];
  const window = { innerHeight: options.height || 900, addEventListener: listen,
    matchMedia: query => {
      const mq = { query, matches: query.includes('prefers-reduced-motion') ? !!options.reduced : (options.width || 1440) >= 901,
        callbacks: [], addEventListener(type, callback) { this.callbacks.push(callback); } };
      mediaQueries.push(mq); return mq;
    } };
  const context = vm.createContext({ window, document, requestAnimationFrame: fn => frames.push(fn) });
  const root = path.join(__dirname, '..');
  vm.runInContext(fs.readFileSync(path.join(root, 'study-layers.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'study-scenes.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  function flush() {
    let budget = 30;
    while (frames.length && budget--) frames.shift()();
    assert.ok(budget > 0, 'animation frames must stop when the scroll stops');
  }
  flush();
  function emit(type) { for (const fn of listeners.get(type) || []) fn(); flush(); }
  function move(value) { scroll = value; emit('scroll'); }
  function at(index, local) { return 800 - number('--journey-stage-top') + (index + local) * number('--journey-cycle-scroll'); }
  function setReduced(value) {
    const mq = mediaQueries.find(item => item.query.includes('prefers-reduced-motion'));
    mq.matches = value; mq.callbacks.forEach(callback => callback()); flush();
  }
  function setVisible(value) { visible = value; emit('hashchange'); }
  function state() {
    return visuals.children.map(figure => ({
      progress: figure.dataset.progress, motion: figure.dataset.motionProgress, phase: figure.dataset.motionPhase, opacity: figure.style.opacity,
      layers: figure.children[0].children.map(image => ({ visibility: image.style.visibility, opacity: image.style.opacity, transform: image.style.transform }))
    }));
  }
  return { move, at, state, visuals, frames, section, layout, stage, scenes, sources, copies, setReduced, setVisible, definitions: window.HISEM_STUDY_LAYERS };
}

test('one pinned stage holds text and art while every chapter finishes its exit', async () => {
  const app = await renderer();
  assert.equal(app.section.dataset.motionMode, 'desktop');
  const expectedTop = parseFloat(app.layout.style['--journey-stage-top']);
  for (let index = 0; index < 4; index++) {
    for (const local of [.15, .45, .75, .91]) {
      app.move(app.at(index, local));
      assert.equal(app.stage.getBoundingClientRect().top, expectedTop);
      assert.equal(app.copies[index].getBoundingClientRect().top, expectedTop + 50);
      assert.equal(app.scenes[index].attrs['aria-hidden'], 'false');
    }
    app.move(app.at(index, .985));
    assert.equal(app.state()[index].phase, 'clear');
    assert.ok(app.state().every(item => Number(item.opacity) === 0), 'clear interval must precede the next illustration');
  }
  app.move(app.at(4, .03));
  assert.ok(app.stage.getBoundingClientRect().top < expectedTop, 'stage may release only after the final exit is over');
  assert.ok(app.state().every(item => Number(item.opacity) === 0));
});

test('chapter distance leaves a substantial reading hold without intercepting scrolling', async () => {
  for (const height of [560, 900, 1080, 1440]) {
    const app = await renderer({ height });
    const cycle = app.at(1, .45) - app.at(0, .45);
    const canvas = parseFloat(app.layout.style['--journey-canvas-height']);
    assert.ok(cycle >= 960 && cycle <= 1440, 'one chapter must not pass in a small scroll gesture');
    assert.ok((.68 - .30) * cycle >= 360, 'the complete-art reading hold needs at least three 120px wheel increments');
    assert.equal(parseFloat(app.layout.style['--journey-runway-height']), canvas + cycle * 4);
  }
  const source = fs.readFileSync(path.join(__dirname, '..', 'study-scenes.js'), 'utf8');
  assert.doesNotMatch(source, /preventDefault\s*\(|addEventListener\s*\(\s*['"](?:wheel|touchmove)['"]|\bscrollTo\s*\(/);
});

test('one 120px wheel tick in the reading hold keeps the completed chapter in place', async () => {
  for (const height of [560, 900, 1080]) {
    const app = await renderer({ height });
    const stageTop = parseFloat(app.layout.style['--journey-stage-top']);
    for (let index = 0; index < 4; index++) {
      const start = app.at(index, .45);
      app.move(start);
      const complete = app.state()[index].layers;
      assert.equal(app.state()[index].phase, 'hold');
      app.move(start + 120);
      const current = app.state();
      assert.equal(current[index].phase, 'hold', 'a single wheel tick must not trigger exit or the next chapter');
      assert.equal(Number(current[index].opacity), 1);
      assert.deepEqual(current[index].layers, complete, 'completed artwork must remain assembled while reading');
      assert.equal(app.stage.getBoundingClientRect().top, stageTop);
      assert.equal(app.copies[index].getBoundingClientRect().top, stageTop + 50);
      assert.equal(app.scenes[index].attrs['aria-hidden'], 'false');
      assert.ok(current.every((item, other) => other === index || Number(item.opacity) === 0));
    }
  }
});

test('each exit matches the actual entrance in reverse and holds without a clock', async () => {
  const app = await renderer();
  for (let index = 0; index < 4; index++) {
    app.move(app.at(index, .15));
    const entrance = app.state()[index].layers;
    app.move(app.at(index, .825));
    assert.equal(app.state()[index].phase, 'exit');
    assert.deepEqual(app.state()[index].layers, entrance, 'halfway exit must equal halfway entrance');
    const stopped = app.state();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(app.state(), stopped);
    assert.equal(app.frames.length, 0);
    app.move(app.at(index, .985)); app.move(app.at(index, .825));
    assert.deepEqual(app.state(), stopped, 'same scroll position must restore every exact layer state');
  }
});

test('chapter handoff never overlaps illustrations, including fast scroll and reverse jumps', async () => {
  const app = await renderer();
  const positions = [0.2, 0.7, 0.91, 0.96, 0.985, 1.04, 1.5, 1.9, 2.4, 3.7, 4.1, 3.45, 1.2, .82];
  for (const position of positions) {
    app.move(app.at(0, position));
    const states = app.state();
    assert.ok(states.filter(item => Number(item.opacity) > 0).length <= 1, 'two graphics overlap at ' + position);
    const active = Math.min(3, Math.floor(position));
    states.forEach((item, index) => { if (index !== active) assert.equal(Number(item.opacity), 0); });
    const exposedText = app.scenes.filter(scene => scene.attrs['aria-hidden'] === 'false');
    assert.ok(exposedText.length <= 1, 'invisible copy must not remain exposed to assistive technology');
  }
});

test('short desktop windows still pin while fitting their available height', async () => {
  const app = await renderer({ width: 1100, height: 560 });
  assert.equal(app.section.dataset.motionMode, 'desktop');
  const canvas = parseFloat(app.layout.style['--journey-canvas-height']);
  assert.ok(canvas > 180 && canvas < 560);
  app.move(app.at(2, .18)); const before = app.state();
  app.move(app.at(2, .24)); assert.notDeepEqual(app.state(), before);
  assert.equal(app.stage.getBoundingClientRect().top, parseFloat(app.layout.style['--journey-stage-top']));
});

test('optional stalled layers cannot block loaded whole chapter art', async () => {
  const app = await renderer({ pendingDecode: true, pendingLayers: true, pendingWhole: 'devices' });
  assert.equal(app.section.dataset.motionMode, 'desktop');
  assert.equal(app.section.dataset.readyScenes, '3');
  app.move(app.at(1, .45));
  assert.ok(Number(app.state()[1].opacity) > 0);
  assert.equal(app.visuals.children[1].children[0].children[0].style.visibility, 'visible');
  assert.ok(app.state().filter(item => Number(item.opacity) > 0).length <= 1);
});

test('very short viewports retain readable ordinary content instead of clipping a pinned stage', async () => {
  const app = await renderer({ width: 1100, height: 420 });
  assert.equal(app.section.dataset.motionMode, 'static');
  assert.equal(app.section.classList.contains('journey-scrubbed'), false);
  for (const scene of app.scenes) {
    assert.notEqual(scene.attrs['aria-hidden'], 'true');
    assert.notEqual(scene.style.visibility, 'hidden');
  }
});

test('reduced motion restores all readable source scenes and clears hidden states', async () => {
  const app = await renderer();
  app.move(app.at(2, .7)); app.setReduced(true);
  assert.equal(app.section.dataset.motionMode, 'reduced');
  assert.equal(app.section.classList.contains('journey-scrubbed'), false);
  for (const scene of app.scenes) {
    assert.notEqual(scene.attrs['aria-hidden'], 'true');
    assert.notEqual(scene.style.visibility, 'hidden');
    assert.ok(scene.style.opacity == null || Number(scene.style.opacity) === 1);
  }
});

test('route reentry recalculates the same pinned position after another view or reduced motion', async () => {
  const app = await renderer();
  app.move(app.at(2, .74)); const before = app.state();
  app.setVisible(false); assert.equal(app.section.dataset.motionMode, 'hidden');
  app.setVisible(true); assert.deepEqual(app.state(), before);
  app.setReduced(true); app.setReduced(false); assert.deepEqual(app.state(), before);
});

test('mobile keeps ordinary content flow, reversible reveal, and stationary equipment', async () => {
  const app = await renderer({ width: 390, height: 844 });
  assert.equal(app.section.dataset.motionMode, 'inline');
  assert.equal(app.section.classList.contains('journey-scrubbed'), false);
  app.move(1100); const readable = Number(app.sources[0].style.opacity);
  app.move(1480); assert.ok(Number(app.sources[0].style.opacity) < readable);
  app.move(1100); assert.equal(Number(app.sources[0].style.opacity), readable);
  assert.equal(app.sources[3].style.transform, 'translateY(0.000px)');
  app.setReduced(true);
  assert.equal(app.sources[0].style.opacity, undefined);
  assert.equal(app.sources[3].style.transform, undefined);
});
