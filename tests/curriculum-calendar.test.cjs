const test = require('node:test');
const assert = require('node:assert/strict');
const calendar = require('../curriculum-calendar.js');
const fs = require('node:fs');
const vm = require('node:vm');
const fallbackContext = { window: {} };
vm.runInNewContext(fs.readFileSync(require.resolve('../data/academic-calendar-fallback.js'), 'utf8'), fallbackContext);
const fallback = fallbackContext.window.HISEM_ACADEMIC_FALLBACK;

test('a blocked JSON request keeps real dated events and month notices from the bundled snapshot', async () => {
  const result = await calendar.loadAcademicSnapshot(() => Promise.reject(new Error('Failed to fetch')), fallback);
  assert.equal(result.saved, true);
  assert.equal(calendar.eventsOn(calendar.academicEvents(result.data), '2026-12-15').length, 2);
  assert.equal(calendar.noticesInMonth(result.data.notices, '2026-11').length, 3);
  assert.ok(result.data.fetchedAt);
});

test('HTTP errors, invalid JSON and empty data fall back, while fresh valid data wins', async () => {
  for (const response of [
    { ok: false },
    { ok: true, json: async () => { throw new SyntaxError('Not JSON'); } },
    { ok: true, json: async () => ({ schemaVersion: 1, events: [] }) }
  ]) assert.equal((await calendar.loadAcademicSnapshot(async () => response, fallback)).saved, true);
  const fresh = { ...fallback, fetchedAt: '2026-11-06T00:00:00Z' };
  const result = await calendar.loadAcademicSnapshot(async () => ({ ok: true, json: async () => fresh }), fallback);
  assert.equal(result.saved, false);
  assert.equal(result.data, fresh);
  await assert.rejects(calendar.loadAcademicSnapshot(async () => ({ ok: false }), null));
});

test('calendar handles leap February and month-spanning weeks with 42 unique dates', () => {
  const cells = calendar.monthCells(2024, 1);
  assert.equal(cells.length, 42);
  assert.equal(new Set(cells.map(cell => cell.date)).size, 42);
  assert.equal(cells[0].date, '2024-01-28');
  assert.equal(cells.filter(cell => cell.inMonth).length, 29);
  assert.ok(cells.some(cell => cell.date === '2024-02-29' && cell.inMonth));
});
test('month navigation clamps end dates and crosses year boundaries', () => {
  assert.equal(calendar.moveMonth('2024-01-31', 1), '2024-02-29');
  assert.equal(calendar.moveMonth('2025-01-31', 1), '2025-02-28');
  assert.equal(calendar.moveMonth('2026-12-15', 1), '2027-01-15');
  assert.equal(calendar.moveMonth('2026-01-15', -1), '2025-12-15');
});
test('only real, named events on the chosen date appear; empty data stays empty', () => {
  assert.equal(calendar.validDate('2026-02-30'), false);
  assert.equal(calendar.validDate('2024-02-29'), true);
  assert.deepEqual(calendar.eventsOn([], '2026-11-05'), []);
  const events = [{ date: '2026-11-05', title: '확정 활동' }, { date: '2026-11-06', title: '다른 날' }, { date: '2026-11-05', title: '' }];
  assert.deepEqual(calendar.eventsOn(events, '2026-11-05'), [events[0]]);
});

test('academic spans include both ends across months and retain the academic label', () => {
  const data = { schemaVersion: 1, events: [{ date: '2026-12-15', endDate: '2027-01-04', title: '공식 성적 정정', type: 'academic' }] };
  const events = calendar.academicEvents(data);
  assert.equal(events[0].type, 'academic');
  for (const date of ['2026-12-15', '2026-12-31', '2027-01-04']) assert.equal(calendar.eventsOn(events, date).length, 1);
  for (const date of ['2026-12-14', '2027-01-05']) assert.equal(calendar.eventsOn(events, date).length, 0);
  assert.deepEqual(calendar.academicEvents({ schemaVersion: 1, events: [{ date: '2026-02-30', endDate: '2026-03-01', title: 'Invalid', type: 'academic' }] }), []);
});

test('month-only notices are not treated as dated daily activities', () => {
  const notice = { startMonth: '2026-11', endMonth: '2026-12', title: '장학금 신청 (기간 별도 공지)' };
  assert.deepEqual(calendar.noticesInMonth([notice], '2026-11'), [notice]);
  assert.deepEqual(calendar.noticesInMonth([notice], '2027-01'), []);
  assert.deepEqual(calendar.eventsOn([notice], '2026-11-05'), []);
});
