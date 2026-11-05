const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
function definitions() {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(path.join(root, 'study-layers.js'), 'utf8'), context);
  return context.window.HISEM_STUDY_LAYERS;
}

// Validate the actual geometry used to build the illustration, not a copied fixture.
test('diamond-cubic core has eight effective cell atoms and a complete nearest-neighbor shell', () => {
  const { sites, bonds, primaryCount } = definitions().materials.geometry;
  assert.equal(primaryCount, 18);
  assert.equal(sites.length, 46);
  assert.equal(bonds.length, 56);
  assert.equal(new Set(sites.map(site => site.join(','))).size, 46);
  for (const site of sites) {
    assert.ok(site.length === 3 && site.every(value => value >= -.25 && value <= 1.25));
    const quarter = site.map(value => value * 4);
    assert.ok(quarter.every(Number.isInteger), 'all sites must lie on the quarter-cell lattice');
    const phase = ((quarter.reduce((sum, value) => sum + value, 0) % 4) + 4) % 4;
    const even = quarter.every(value => value % 2 === 0);
    const odd = quarter.every(value => Math.abs(value % 2) === 1);
    assert.ok(even && phase === 0 || odd && phase === 3, 'site must belong to one of the two diamond FCC sublattices');
  }
  let effective = 0;
  for (const site of sites.slice(0, primaryCount)) {
    assert.ok(site.length === 3 && site.every(value => value >= 0 && value <= 1));
    const boundaries = site.filter(value => value === 0 || value === 1).length;
    assert.ok(boundaries === 0 || boundaries === 1 || boundaries === 3);
    effective += 1 / (2 ** boundaries);
  }
  assert.equal(effective, 8, 'shared corner/face atoms must not be counted as eighteen full atoms');
});

test('every core silicon atom has four tetrahedral neighbors and all displayed atoms form one connected diamond network', () => {
  const { sites, bonds, primaryCount } = definitions().materials.geometry;
  const unique = new Set();
  for (const [a, b] of bonds) {
    assert.ok(Number.isInteger(a) && Number.isInteger(b) && sites[a] && sites[b] && a !== b);
    const key = [Math.min(a, b), Math.max(a, b)].join(',');
    assert.equal(unique.has(key), false, 'duplicate chemical bond');
    unique.add(key);
    const length2 = sites[a].reduce((sum, value, axis) => sum + (value - sites[b][axis]) ** 2, 0);
    assert.equal(length2, 3 / 16);
  }
  for (let atom = 0; atom < primaryCount; atom++) {
    const neighbors = bonds.filter(bond => bond.includes(atom)).map(([a, b]) => a === atom ? b : a);
    assert.equal(new Set(neighbors).size, 4);
    const vectors = neighbors.map(neighbor => sites[neighbor].map((value, axis) => value - sites[atom][axis]));
    for (let a = 0; a < vectors.length; a++) for (let b = a + 1; b < vectors.length; b++) {
      const dot = vectors[a].reduce((sum, value, axis) => sum + value * vectors[b][axis], 0);
      assert.equal(dot, -1 / 16, 'the four neighbors must form a tetrahedron');
    }
  }
  const adjacency = sites.map(() => []);
  for (const [a, b] of bonds) { adjacency[a].push(b); adjacency[b].push(a); }
  assert.ok(adjacency.every(neighbors => neighbors.length > 0), 'a displayed atom cannot float without any chemical bond');
  const reached = new Set([0]), queue = [0];
  for (const atom of queue) for (const neighbor of adjacency[atom]) {
    if (!reached.has(neighbor)) { reached.add(neighbor); queue.push(neighbor); }
  }
  assert.equal(reached.size, sites.length, 'all visible atoms must belong to the same connected structure');
  // Independently enumerate every actual nearest-neighbor pair in the visible
  // shell: this catches missing boundary connections, not just invalid extras.
  for (let a = 0; a < sites.length; a++) for (let b = a + 1; b < sites.length; b++) {
    const length2 = sites[a].reduce((sum, value, axis) => sum + (value - sites[b][axis]) ** 2, 0);
    assert.equal(unique.has(a + ',' + b), length2 === 3 / 16, 'visible nearest neighbors must be connected without inventing long bonds');
  }
});

function svgSource(src) {
  if (src.startsWith('data:image/svg+xml')) return decodeURIComponent(src.slice(src.indexOf(',') + 1));
  assert.ok(fs.existsSync(path.join(root, src)), 'missing SVG source ' + src);
  return fs.readFileSync(path.join(root, src), 'utf8');
}

function shapeWithData(source, tag, name, id) {
  const shapes = Array.from(source.matchAll(new RegExp('<' + tag + '\\b[^>]*>', 'g')), match => match[0]);
  const matches = shapes.filter(shape => attributes(shape)['data-' + name] === String(id));
  assert.equal(matches.length, 1, 'expected one complete ' + name + ' ' + id);
  return matches[0];
}

test('silicon parts are complete native spheres and rounded bonds, with the same endpoint geometry as the static illustration', () => {
  const materials = definitions().materials;
  assert.equal(materials.layers.filter(layer => /^atom-\d+$/.test(layer.id)).length, 46);
  assert.equal(materials.layers.filter(layer => /^bond-\d+$/.test(layer.id)).length, 56);
  assert.equal(new Set(materials.layers.map(layer => layer.id)).size, materials.layers.length);
  const base = svgSource(materials.baseSrc);
  assert.doesNotMatch(base, /<(?:image|mask|clipPath)\b/, 'static geometry cannot contain cropped raster fragments');
  for (const layer of materials.layers) {
    assert.match(layer.src, /^data:image\/svg\+xml/, 'moving parts must be independently drawn geometry');
    assert.equal(layer.mask, undefined, 'do not cut a sphere or rod out of the flattened raster');
    assert.equal(layer.clip, undefined, 'do not expose artificial clipping faces');
    const source = svgSource(layer.src);
    assert.doesNotMatch(source, /<(?:image|mask|clipPath)\b/);
    assert.ok(layer.end <= materials.completeAt, 'all assembly must finish before the original base replaces it');
    const atom = /^atom-(\d+)$/.exec(layer.id);
    const bond = /^bond-(\d+)$/.exec(layer.id);
    if (atom) {
      const id = Number(atom[1]) - 1;
      const circle = shapeWithData(source, 'circle', 'atom', id);
      assert.equal((source.match(/<circle\b/g) || []).length, 1, 'one atom must be one complete sphere');
      assert.ok(Number(attributes(circle).r) > 0, 'each atom must be a complete sphere with a positive radius');
      assert.equal(shapeWithData(base, 'circle', 'atom', id), circle, 'switching to static art must not change sphere geometry');
    }
    if (bond) {
      const id = Number(bond[1]) - 1;
      const line = shapeWithData(source, 'line', 'bond', id);
      assert.equal(attributes(line)['stroke-linecap'], 'round', 'an unattached end must be a finished rounded rod');
      assert.equal(shapeWithData(base, 'line', 'bond', id), line, 'switching to static art must not change bond geometry');
    }
  }
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.includes('src="' + materials.baseSrc + '"'), 'mobile/static and moving illustration must use the same complete geometry');
});

test('bonds appear only after both endpoint atoms arrive and remain attached at their final coordinates', () => {
  const materials = definitions().materials;
  materials.geometry.bonds.forEach(([a, b], index) => {
    const bond = materials.layers.find(layer => layer.id === 'bond-' + (index + 1));
    const first = materials.layers.find(layer => layer.id === 'atom-' + (a + 1));
    const second = materials.layers.find(layer => layer.id === 'atom-' + (b + 1));
    assert.ok(bond.opacityStart >= Math.max(first.end, second.end), 'bond cannot reveal while either atom is still traveling');
    assert.equal(bond.fromX || 0, 0, 'bond must not detach sideways');
    assert.equal(bond.fromY || 0, 0, 'bond must not detach vertically');
    assert.equal(bond.fromScale == null ? 1 : bond.fromScale, 1, 'bond must keep its anchor coordinates');
    const line = attributes(shapeWithData(svgSource(bond.src), 'line', 'bond', index));
    const firstCircle = attributes(shapeWithData(svgSource(first.src), 'circle', 'atom', a));
    const secondCircle = attributes(shapeWithData(svgSource(second.src), 'circle', 'atom', b));
    assert.equal(Number(line.x1), Number(firstCircle.cx));
    assert.equal(Number(line.y1), Number(firstCircle.cy));
    assert.equal(Number(line.x2), Number(secondCircle.cx));
    assert.equal(Number(line.y2), Number(secondCircle.cy));
    assert.ok(bond.opacityEnd <= materials.completeAt);
  });
});

test('projected diamond network keeps every sphere distinct and core bonds clear of unrelated core atoms', () => {
  const materials = definitions().materials;
  const { sites, bonds, primaryCount } = materials.geometry;
  const base = svgSource(materials.baseSrc);
  const circles = sites.map((_, index) => {
    const shape = attributes(shapeWithData(base, 'circle', 'atom', index));
    return { x: Number(shape.cx), y: Number(shape.cy), r: Number(shape.r) };
  });
  for (const circle of circles) {
    assert.ok(circle.x - circle.r >= 0 && circle.x + circle.r <= materials.width);
    assert.ok(circle.y - circle.r >= 0 && circle.y + circle.r <= materials.height);
  }
  for (let a = 0; a < circles.length; a++) for (let b = a + 1; b < circles.length; b++) {
    const distance = Math.hypot(circles[a].x - circles[b].x, circles[a].y - circles[b].y);
    assert.ok(distance >= circles[a].r + circles[b].r, 'atom spheres ' + a + ' and ' + b + ' must not hide one another in projection');
  }
  bonds.forEach(([a, b], index) => {
    if (a >= primaryCount || b >= primaryCount) return;
    const line = attributes(shapeWithData(base, 'line', 'bond', index));
    const x1 = Number(line.x1), y1 = Number(line.y1);
    const dx = Number(line.x2) - x1, dy = Number(line.y2) - y1;
    const halfWidth = Number(line['stroke-width']) / 2;
    for (let atom = 0; atom < primaryCount; atom++) {
      if (atom === a || atom === b) continue;
      const circle = circles[atom];
      const t = Math.max(0, Math.min(1, ((circle.x - x1) * dx + (circle.y - y1) * dy) / (dx * dx + dy * dy)));
      const distance = Math.hypot(circle.x - x1 - t * dx, circle.y - y1 - t * dy);
      assert.ok(distance >= circle.r + halfWidth - .01, 'core bond ' + index + ' cannot disappear behind unrelated core atom ' + atom);
    }
  });
});

test('industry equipment remains one uncut silhouette at every intermediate scroll position', () => {
  const industry = definitions().industry;
  assert.equal(industry.layers.length, 1, 'vertical slices expose surfaces that do not exist in the image');
  const equipment = industry.layers[0];
  assert.equal(equipment.id, 'equipment');
  assert.equal(equipment.src, industry.baseSrc);
  assert.equal(equipment.mask, undefined);
  assert.equal(equipment.clip, undefined);
  assert.ok(Math.abs(equipment.fromX || 0) <= 3 && Math.abs(equipment.fromY || 0) <= 3, 'use restrained whole-object movement');
  assert.ok(equipment.end <= industry.completeAt && equipment.opacityEnd <= industry.completeAt);
});

function attributes(tag) {
  return Object.fromEntries(Array.from(tag.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g), match => [match[1], match[2]]));
}

test('curriculum cleanup retains one archive action outside the four scenes and valid calendar/script wiring', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const calendar = fs.readFileSync(path.join(root, 'curriculum-calendar.js'), 'utf8');
  for (const removed of ['설명과 그림으로 자세히 보기', '확정된 활동 일정을 확인하는 공간입니다.', '이번 달에 등록된 일정이 없습니다.', '스크롤하며 살펴보세요']) {
    assert.equal((html + calendar).includes(removed), false, 'removed helper text returned: ' + removed);
  }
  assert.doesNotMatch(html + calendar, /curriculum-explore|calendar-month-status|journey-scroll-note|study-detail-link/);
  for (const match of calendar.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)) {
    assert.ok(html.includes('id="' + match[1] + '"'), 'calendar still refers to removed element ' + match[1]);
  }
  const start = html.indexOf('<section class="view" id="v-curriculum"');
  const end = html.indexOf('<!-- ARCHIVE -->', start);
  assert.ok(start >= 0 && end > start);
  const curriculum = html.slice(start, end);
  const stack = [], actions = [];
  const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  for (const match of curriculum.matchAll(/<\/?([a-z][\w:-]*)\b[^>]*>/gi)) {
    const tag = match[0], name = match[1].toLowerCase();
    if (tag.startsWith('</')) {
      const index = stack.findLastIndex(node => node.name === name);
      if (index >= 0) stack.splice(index);
      continue;
    }
    const attrs = attributes(tag), classes = (attrs.class || '').split(/\s+/);
    if (name === 'a' && attrs.href === '#activity') {
      assert.ok(stack.some(node => node.classes.includes('curriculum-archive-cta')));
      assert.equal(stack.some(node => node.classes.includes('study-scene') || node.classes.includes('journey-scenes')), false);
      actions.push(tag);
    }
    if (!voidTags.has(name) && !tag.endsWith('/>')) stack.push({ name, classes });
  }
  assert.equal(actions.length, 1);
  assert.equal((curriculum.match(/data-study-scene=/g) || []).length, 4);
  const scripts = Array.from(html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi), match => match[1]);
  const local = scripts.filter(src => !/^(?:[a-z]+:)?\/\//i.test(src));
  for (const src of local) assert.ok(fs.existsSync(path.join(root, src.split(/[?#]/)[0])), 'missing script file ' + src);
  const names = scripts.map(src => src.split(/[?#]/)[0]);
  assert.ok(names.indexOf('study-layers.js') >= 0 && names.indexOf('study-layers.js') < names.indexOf('study-scenes.js'), 'layer definitions must load before their renderer');
});
