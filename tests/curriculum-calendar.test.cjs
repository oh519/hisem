const test = require('node:test');
const assert = require('node:assert/strict');
const calendar = require('../curriculum-calendar.js');

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
