const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function renderer(options = {}) {
  let scroll = 0, visible = true;
  const frames = [], listeners = new Map();
  function listen(type, fn) { const list = listeners.get(type) || []; list.push(fn); listeners.set(type, list); }
  class Node {
    constructor() {
      this.children = []; this.dataset = {}; this.attrs = {};
      this.naturalWidth = 1254; this.clientWidth = 640;
      this.style = { setProperty(key, value) { this[key] = value; }, removeProperty(key) { delete this[key]; } };
      const classes = new Set();
      this.classList = { toggle(key, on) { if (on) classes.add(key); else classes.delete(key); }, contains(key) { return classes.has(key); } };
    }
    appendChild(node) { this.children.push(node); return node; }
    setAttribute(key, value) { this.attrs[key] = value; }
    getAttribute(key) { return key === 'src' ? this.src : this.attrs[key]; }
    addEventListener() {}
    get complete() {
      return !(options.pendingLayers && this.className === 'journey-layer') &&
        !(options.pendingWhole && this.className === 'journey-whole' && this.src.includes(options.pendingWhole));
    }
    decode() { return options.pendingDecode ? new Promise(() => {}) : Promise.resolve(); }
    closest() { return null; }
  }
  const section = new Node(), layout = new Node(), visuals = new Node();
  section.closest = () => visible ? null : {};
  const sources = [];
  const scenes = ['materials','process','devices','industry'].map((key, index) => {
    const scene = new Node(), image = new Node(), media = new Node();
    sources.push(image);
    scene.dataset = { studyScene: key, tint: ['#f0f4f8','#f4f2fa','#eef6f3','#edf4fa'][index] };
    image.src = 'assets/study/' + key + '-cutout.webp';
    image.attrs = { width: '1254', height: '1254' };
    scene.querySelector = key => key === '.scene-media' ? media : image;
    scene.getBoundingClientRect = () => ({ top: 800 + index * 872 - scroll, height: 872 });
    media.getBoundingClientRect = () => ({ top: 1200 + index * 872 - scroll, bottom: 1600 + index * 872 - scroll, height: 400 });
    return scene;
  });
  layout.getBoundingClientRect = () => ({ top: 800 - scroll, bottom: 800 + 4 * 872 - scroll });
  section.querySelector = key => key === '.journey-layout' ? layout : visuals;
  section.querySelectorAll = () => scenes;
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
      mediaQueries.push(mq);
      return mq;
    } };
  const context = vm.createContext({ window, document, requestAnimationFrame: fn => frames.push(fn) });
  const root = path.join(__dirname, '..');
  vm.runInContext(fs.readFileSync(path.join(root, 'study-layers.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'study-scenes.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  function flush() {
    let budget = 20;
    while (frames.length && budget--) frames.shift()();
    assert.ok(budget > 0, 'animation frames must stop when the scroll stops');
  }
  flush();
  function emit(type) { for (const fn of listeners.get(type) || []) fn(); flush(); }
  function move(value) { scroll = value; emit('scroll'); }
  function setReduced(value) {
    const mq = mediaQueries.find(item => item.query.includes('prefers-reduced-motion'));
    mq.matches = value; mq.callbacks.forEach(callback => callback()); flush();
  }
  function setVisible(value) { visible = value; emit('hashchange'); }
  function state() {
    return visuals.children.map(figure => ({
      progress: figure.dataset.progress, opacity: figure.style.opacity,
      layers: figure.children[0].children.map(image => ({
        visibility: image.style.visibility, opacity: image.style.opacity, transform: image.style.transform
      }))
    }));
  }
  return { move, state, visuals, frames, section, layout, sources, setReduced, setVisible, definitions: window.HISEM_STUDY_LAYERS };
}

test('scroll state holds without a clock and rewinds to the identical rendered state', async () => {
  const app = await renderer();
  assert.ok(app.section.classList.contains('journey-scrubbed'));
  app.move(1680);
  const first = app.state();
  assert.equal(app.frames.length, 0);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(app.state(), first, 'elapsed time alone must not advance any layer');
  app.move(3100); app.move(1680);
  assert.deepEqual(app.state(), first, 'returning to a scroll position must rewind every layer');
});

test('native material layers fall vertically and complete art returns on forward/backward scrub', async () => {
  const app = await renderer();
  assert.ok(app.definitions.devices.layers.every(layer => layer.fromX === 0 && layer.fromY < 0));
  app.move(2200);
  const device = app.visuals.children[2];
  const before = app.state()[2];
  assert.equal(device.children[0].children[0].style.visibility, 'hidden');
  for (const layer of device.children[0].children.slice(1)) assert.match(layer.style.transform, /^translate\(0\.000%,/);
  app.move(2700);
  assert.equal(device.children[0].children[0].style.visibility, 'visible');
  app.move(2200);
  assert.deepEqual(app.state()[2], before);
});

test('adjacent chapter handoffs retain visible art without blank scroll intervals', async () => {
  const app = await renderer();
  for (let position = 600; position <= 3100; position += 25) {
    app.move(position);
    const states = app.state();
    const alpha = states.map(state => Number(state.opacity));
    assert.ok(Math.max(...alpha) > .35, 'blank or near-blank handoff at scroll ' + position);
    assert.ok(alpha.reduce((a, b) => a + b, 0) <= 1.001, 'chapter alpha must remain normalized');
    for (let index = 1; index < states.length; index++) {
      if (Number(states[index].progress) >= .081) assert.equal(alpha[index - 1], 0, 'previous graphic must disappear after the short handoff');
    }
  }
});

test('short desktop windows retain scrub motion and scale the canvas to available height', async () => {
  const app = await renderer({ width: 1100, height: 560 });
  assert.equal(app.section.dataset.motionMode, 'desktop');
  assert.ok(app.section.classList.contains('journey-scrubbed'));
  const height = parseFloat(app.layout.style['--journey-canvas-height']);
  assert.ok(height > 180 && height < 560);
  app.move(2200);
  const before = app.state();
  app.move(2250);
  assert.notDeepEqual(app.state(), before, 'short desktop viewport must still respond to scroll');
});

test('a stalled optional decoder or image does not block loaded chapter motion', async () => {
  const app = await renderer({ pendingDecode: true, pendingLayers: true, pendingWhole: 'devices' });
  assert.equal(app.section.dataset.motionMode, 'desktop');
  assert.equal(app.section.dataset.readyScenes, '3');
  app.move(2200);
  assert.ok(app.state().some(state => Number(state.opacity) > .35), 'hold ready art while one chapter is pending');
  assert.ok(app.visuals.children[1].children[0].children[0].style.visibility === 'visible', 'unready optional layers must retain complete art');
});

test('mobile reveal rewinds in ordinary flow, and reduced-motion clears all source transforms', async () => {
  const app = await renderer({ width: 390, height: 844 });
  assert.equal(app.section.dataset.motionMode, 'inline');
  assert.equal(app.section.classList.contains('journey-scrubbed'), false);
  const before = { ...app.sources[0].style };
  app.move(650);
  assert.notEqual(app.sources[0].style.transform, before.transform);
  app.move(0);
  assert.deepEqual(app.sources[0].style, before);
  app.setReduced(true);
  assert.equal(app.section.dataset.motionMode, 'reduced');
  assert.equal(app.sources[0].style.transform, undefined);
  assert.equal(app.sources[0].style.opacity, undefined);
});

test('route reentry recalculates the same scroll state and honors reduced motion', async () => {
  const app = await renderer();
  app.move(2200);
  const before = app.state();
  app.setVisible(false);
  assert.equal(app.section.dataset.motionMode, 'hidden');
  app.setVisible(true);
  assert.equal(app.section.dataset.motionMode, 'desktop');
  assert.deepEqual(app.state(), before);
  app.setReduced(true);
  assert.equal(app.section.classList.contains('journey-scrubbed'), false);
  app.setReduced(false);
  assert.deepEqual(app.state(), before);
});

test('every layered chapter exits by replaying its exact entrance in reverse', async () => {
  const app = await renderer();
  const top = parseFloat(app.layout.style['--journey-stage-top']);
  const canvas = parseFloat(app.layout.style['--journey-canvas-height']);
  const at = (index, p) => 800 + index * 872 - (top + canvas * .3 + 872 * .25) + p * 872 * 1.5;
  for (let index = 0; index < 3; index++) {
    const key = ['materials','process','devices'][index];
    const middle = app.definitions[key].completeAt * .5;
    app.move(at(index, middle));
    const entering = app.state()[index].layers;
    app.move(at(index, .56 + .5 * (2 / 3 + .08 - .56)));
    const figure = app.visuals.children[index];
    assert.equal(figure.dataset.motionPhase, 'exit');
    assert.equal(Number(figure.dataset.motionProgress), Number(middle.toFixed(5)));
    assert.deepEqual(app.state()[index].layers, entering, key + ' exit must match the actual entrance shapes/opacity/transform');
    const stopped = app.state();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(app.state(), stopped);
    app.move(at(index, .74));
    app.move(at(index, .56 + .5 * (2 / 3 + .08 - .56)));
    assert.deepEqual(app.state(), stopped, 'reverse scrolling must restore the exact exit state');
  }
});

test('last equipment only fades and fully exits before the bottom action', async () => {
  const app = await renderer();
  const equipment = app.definitions.industry.layers[0];
  assert.equal(equipment.fromX, 0);
  assert.equal(equipment.fromY, 0);
  // Last layout bottom remains visible, just above 60% of the art canvas.
  app.move(800 + 4 * 872 - (93 + 779 * .59));
  const figure = app.visuals.children[3];
  assert.equal(figure.dataset.motionPhase, 'exit');
  assert.equal(figure.dataset.motionProgress, '0.00000');
  const layer = figure.children[0].children[1];
  assert.equal(Number(layer.style.opacity), 0);
  assert.equal(layer.style.transform, 'translate(0.000%,0.000%) scale(1.0000)');
  app.move(3300);
  assert.ok(Number(layer.style.opacity) > 0, 'scrolling up restores the whole equipment');
});

test('mobile art reverses its reveal on exit and equipment never translates', async () => {
  const app = await renderer({ width: 390, height: 844 });
  app.move(1100);
  const readable = Number(app.sources[0].style.opacity);
  app.move(1480);
  assert.ok(Number(app.sources[0].style.opacity) < readable);
  app.move(1100);
  assert.equal(Number(app.sources[0].style.opacity), readable);
  assert.equal(app.sources[3].style.transform, 'translateY(0.000px)');
  app.setReduced(true);
  assert.equal(app.sources[0].style.opacity, undefined);
  assert.equal(app.sources[3].style.transform, undefined);
});
